// ============================================================
// Burst — TypeScript Type Definitions
// ============================================================
// Single source of truth for all entity shapes.
// DynamoDB is schemaless — these interfaces ARE the schema.
// ============================================================

// ---- Base DynamoDB Item ----

export interface BaseItem {
  PK: string;
  SK: string;
  entityType: string;
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK?: string;
  GSI2SK?: string;
  [key: string]: unknown; // Index signature for DynamoDB Document Client
}

// ---- Drop ----

export type DropStatus = 'upcoming' | 'live' | 'sold_out' | 'completed';

export interface DropItem extends BaseItem {
  entityType: 'DROP';
  dropId: string;
  title: string;
  description: string;
  imageUrl: string;
  price: number;           // in cents (e.g., 17000 = $170.00)
  totalInventory: number;  // original quantity, never changes
  scheduledStart: string;  // ISO 8601
  status: DropStatus;
  sellerId: string;
  createdAt: string;       // ISO 8601
}

export interface Drop {
  dropId: string;
  title: string;
  description: string;
  imageUrl: string;
  price: number;
  totalInventory: number;
  scheduledStart: string;
  status: DropStatus;
  sellerId: string;
  createdAt: string;
}

// ---- Inventory (separate item for transactional isolation) ----

export interface InventoryItem extends BaseItem {
  entityType: 'INVENTORY';
  available: number;
  reserved: number;
}

export interface Inventory {
  available: number;
  reserved: number;
  total: number;         // computed from drop's totalInventory
  percentRemaining: number;
}

// ---- Reservation ----

export type ReservationStatus = 'reserved' | 'expired' | 'confirmed';

export interface ReservationItem extends BaseItem {
  entityType: 'RESERVATION';
  reservationId: string;
  dropId: string;
  userId: string;
  queuePosition: number;
  status: ReservationStatus;
  createdAt: string;     // ISO 8601
  expiresAt: number;     // Unix epoch (DynamoDB TTL)
}

export interface Reservation {
  reservationId: string;
  dropId: string;
  userId: string;
  queuePosition: number;
  status: ReservationStatus;
  createdAt: string;
  expiresAt: number;
  timeRemainingMs: number;
}

// ---- Queue Entry (audit log — powers Drop Report) ----

export type QueueAction = 'claim_success' | 'claim_failed_sold_out' | 'claim_failed_duplicate';

export interface QueueEntryItem extends BaseItem {
  entityType: 'QUEUE_ENTRY';
  userId: string;
  dropId: string;
  action: QueueAction;
  timestamp: string;     // ISO 8601 high-precision
  region: string;        // NA, EU, AS, SA, AF, OC
  userAgent: string;
}

// ---- User Claim (prevents duplicate claims) ----

export interface UserClaimItem extends BaseItem {
  entityType: 'USER_CLAIM';
  userId: string;
  dropId: string;
  claimedAt: string;
}

// ---- User ----

export interface UserItem extends BaseItem {
  entityType: 'USER';
  userId: string;
  displayName: string;
  totalClaims: number;
  successfulClaims: number;
  joinedAt: string;      // ISO 8601
}

export interface User {
  userId: string;
  displayName: string;
  totalClaims: number;
  successfulClaims: number;
  joinedAt: string;
}

// ---- Drop Report (aggregated view) ----

export interface DropReport {
  dropId: string;
  title: string;
  totalInventory: number;
  totalAttempts: number;
  successfulClaims: number;
  failedSoldOut: number;
  failedDuplicate: number;
  uniqueUsers: number;
  fairnessScore: number;   // (uniqueUsers / totalAttempts) * 100
  inventoryTimeline: { timestamp: string; remaining: number }[];
  regionBreakdown: { region: string; count: number; percentage: number }[];
  peakSecond: { timestamp: string; attempts: number };
}

// ---- API Types ----

export interface ClaimRequest {
  userId: string;
  region: string;
}

export interface ClaimResponse {
  success: true;
  reservation: Reservation;
  queuePosition: number;
}

export interface ClaimError {
  success: false;
  error: 'SOLD_OUT' | 'ALREADY_CLAIMED' | 'DROP_NOT_LIVE' | 'INTERNAL_ERROR';
  message: string;
}

export interface CreateDropRequest {
  title: string;
  description: string;
  imageUrl: string;
  price: number;
  totalInventory: number;
  scheduledStart: string;
  sellerId: string;
}

export interface ApiError {
  error: string;
  code: string;
}

// ---- Simulate ----

export interface SimulateRequest {
  dropId: string;
  count: number;
  waves?: number;
}
