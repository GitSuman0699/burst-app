// ============================================================
// Burst — Claim Flow (TransactWriteItems)
// ============================================================
// THIS IS THE TECHNICAL CENTERPIECE OF THE ENTIRE APP.
//
// A single TransactWriteItems call atomically:
//   1. Checks inventory > 0 and decrements it
//   2. Creates a reservation with 10-minute TTL
//   3. Prevents duplicate claims by the same user
//
// If inventory = 0 → transaction fails → no oversell possible.
// If user already claimed → transaction fails → idempotent.
// This is not application-layer logic — it is a DynamoDB
// infrastructure guarantee.
// ============================================================

import {
  transactWrite,
  getItem,
  queryItems,
  updateItem,
  generateId,
  TABLE_NAME,
  TransactionCanceledError,
} from '../dynamodb';
import type {
  ReservationItem,
  Reservation,
  UserClaimItem,
  InventoryItem,
  ClaimResponse,
  ClaimError,
} from '../types';
import { getInventory, markSoldOut } from './drops';

// ---- Constants ----

const RESERVATION_TTL_SECONDS = 600; // 10 minutes

// ---- Mappers ----

function toReservationDomain(item: ReservationItem): Reservation {
  const now = Date.now();
  const expiresAtMs = item.expiresAt * 1000;
  return {
    reservationId: item.reservationId,
    dropId: item.dropId,
    userId: item.userId,
    queuePosition: item.queuePosition,
    status: expiresAtMs < now && item.status === 'reserved' ? 'expired' : item.status,
    createdAt: item.createdAt,
    expiresAt: item.expiresAt,
    timeRemainingMs: Math.max(0, expiresAtMs - now),
  };
}

// ============================================================
// claimSpot — The Core Transaction
// ============================================================

export async function claimSpot(
  dropId: string,
  userId: string,
): Promise<ClaimResponse | ClaimError> {
  const reservationId = generateId('res');
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = Math.floor(now.getTime() / 1000) + RESERVATION_TTL_SECONDS;

  try {
    // Get current inventory to calculate queue position
    const invItem = await getItem<InventoryItem>(`DROP#${dropId}`, 'INVENTORY');
    if (!invItem) {
      return {
        success: false,
        error: 'DROP_NOT_LIVE',
        message: 'Drop not found or inventory not initialized',
      };
    }

    const queuePosition = invItem.reserved + 1;

    // ========================================================
    // THE TRANSACTION — All-or-nothing atomic operation
    // ========================================================
    await transactWrite([
      // 1. CHECK & DECREMENT inventory
      //    ConditionExpression: available > 0
      //    If this fails → TransactionCanceledException → SOLD OUT
      {
        Update: {
          TableName: TABLE_NAME,
          Key: { PK: `DROP#${dropId}`, SK: 'INVENTORY' },
          UpdateExpression: 'SET available = available - :one, reserved = reserved + :one',
          ConditionExpression: 'available > :zero',
          ExpressionAttributeValues: { ':one': 1, ':zero': 0 },
        },
      },

      // 2. CREATE reservation with TTL
      //    The reservation auto-expires after 10 minutes (DynamoDB TTL)
      //    In production: payment must complete within this window
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            PK: `DROP#${dropId}`,
            SK: `RESERVATION#${reservationId}`,
            GSI1PK: `USER#${userId}#RESERVATIONS`,
            GSI1SK: nowIso,
            GSI2PK: `DROP#${dropId}#RESERVATIONS`,
            GSI2SK: nowIso,
            entityType: 'RESERVATION',
            reservationId,
            dropId,
            userId,
            queuePosition,
            status: 'reserved',
            createdAt: nowIso,
            expiresAt, // DynamoDB TTL attribute (Unix epoch)
          },
          ConditionExpression: 'attribute_not_exists(PK)', // Idempotency
        },
      },

      // 3. PREVENT duplicate claim by same user
      //    If this user already claimed this drop → transaction fails
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            PK: `USER#${userId}`,
            SK: `CLAIM#${dropId}`,
            entityType: 'USER_CLAIM',
            userId,
            dropId,
            claimedAt: nowIso,
          },
          ConditionExpression: 'attribute_not_exists(PK)', // Fails if already claimed
        },
      },
    ]);

    // Transaction succeeded — all 3 operations completed atomically
    console.log(`[Burst] Claim SUCCESS: user=${userId}, drop=${dropId}, position=${queuePosition}`);

    // Background check: if inventory hit 0, mark the drop as sold out.
    // We do this unconditionally because in high-concurrency (like the simulator),
    // the initial read of invItem might be way above 5, but the transaction drains it to 0.
    getInventory(dropId).then(inv => {
      if (inv && inv.available === 0) {
        markSoldOut(dropId).catch(console.error);
      }
    }).catch(console.error);

    const reservation: Reservation = {
      reservationId,
      dropId,
      userId,
      queuePosition,
      status: 'reserved',
      createdAt: nowIso,
      expiresAt,
      timeRemainingMs: RESERVATION_TTL_SECONDS * 1000,
    };

    return {
      success: true,
      reservation,
      queuePosition,
    };
  } catch (error) {
    if (error instanceof TransactionCanceledError) {
      // Parse which condition failed
      const reasons = error.cancellationReasons;
      console.log(`[Burst] Claim REJECTED: user=${userId}, drop=${dropId}, reasons=${reasons.join(',')}`);

      // If the first item (inventory check) failed → SOLD OUT
      // If the third item (duplicate check) failed → ALREADY CLAIMED
      // In practice, we check for specific error patterns
      if (reasons.includes('ConditionalCheckFailed')) {
        // Could be either sold out or already claimed
        // Check if user already has a claim
        const existingClaim = await checkUserClaimed(userId, dropId);
        if (existingClaim) {
          return {
            success: false,
            error: 'ALREADY_CLAIMED',
            message: 'You already have a reservation for this drop',
          };
        }
        return {
          success: false,
          error: 'SOLD_OUT',
          message: 'This drop is sold out. You just missed it!',
        };
      }

      return {
        success: false,
        error: 'SOLD_OUT',
        message: 'This drop is sold out',
      };
    }

    console.error('[Burst] Claim ERROR:', error);
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
    };
  }
}

// ---- Query Helpers ----

export async function checkUserClaimed(userId: string, dropId: string): Promise<boolean> {
  const item = await getItem<UserClaimItem>(`USER#${userId}`, `CLAIM#${dropId}`);
  return item !== null;
}

export async function getUserReservations(userId: string): Promise<Reservation[]> {
  const items = await queryItems<ReservationItem>(
    'GSI1PK = :pk',
    { ':pk': `USER#${userId}#RESERVATIONS` },
    { indexName: 'GSI1', scanForward: false },
  );
  return items.map(toReservationDomain);
}

export async function getDropReservations(dropId: string): Promise<Reservation[]> {
  const items = await queryItems<ReservationItem>(
    'GSI2PK = :pk',
    { ':pk': `DROP#${dropId}#RESERVATIONS` },
    { indexName: 'GSI2', scanForward: true },
  );
  return items.map(toReservationDomain);
}

// ---- Confirm Reservation (after Stripe payment) ----

export async function confirmReservation(
  dropId: string,
  reservationId: string,
): Promise<void> {
  await updateItem(
    `DROP#${dropId}`,
    `RESERVATION#${reservationId}`,
    'SET #status = :confirmed REMOVE expiresAt',
    { ':confirmed': 'confirmed' },
    undefined, // no condition expression
    { '#status': 'status' },
  );

  console.log(`[Burst] Reservation CONFIRMED: ${reservationId} in drop ${dropId}`);
}

// ---- Release Reservation (after expiration) ----

export async function releaseSpot(dropId: string, userId: string, reservationId: string) {
  try {
    await transactWrite([
      // 1. Delete the reservation
      {
        Delete: {
          TableName: TABLE_NAME,
          Key: { PK: `DROP#${dropId}`, SK: `RESERVATION#${reservationId}` },
        },
      },
      // 2. Restore inventory
      {
        Update: {
          TableName: TABLE_NAME,
          Key: { PK: `DROP#${dropId}`, SK: 'INVENTORY' },
          UpdateExpression: 'SET available = available + :one, reserved = reserved - :one',
          ExpressionAttributeValues: { ':one': 1 },
        },
      },
      // 3. Remove the user's claim lock so they can try again
      {
        Delete: {
          TableName: TABLE_NAME,
          Key: { PK: `USER#${userId}`, SK: `CLAIM#${dropId}` },
        },
      },
    ]);

    console.log(`[Burst] Spot RELEASED: user=${userId}, drop=${dropId}, res=${reservationId}`);
    return { success: true };
  } catch (error) {
    console.error('[Burst] Release ERROR:', error);
    return { success: false, error: 'INTERNAL_ERROR', message: 'Failed to release spot' };
  }
}

