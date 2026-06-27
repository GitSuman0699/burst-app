// ============================================================
// Burst — Demo Data Seeding
// ============================================================
// Seeds realistic demo data for judging:
// - 3 drops (completed/sold-out, live/active, upcoming)
// - Queue entries for the completed drop (Drop Report demo)
// - Reservations for the live drop
// ============================================================

import { putItem, generateId } from '../dynamodb';
import { createDrop, activateDrop, markSoldOut } from './drops';
import { logQueueEntry } from './queue';
import { getOrCreateUser } from './users';
import { ALL_REGION_CODES } from '../regions';

export async function seedDemoData(): Promise<{
  drops: number;
  queueEntries: number;
  users: number;
}> {
  let queueEntryCount = 0;
  let userCount = 0;

  // ---- Drop 1: Completed / Sold Out ----
  // This is the drop that has a full Drop Report with queue entries
  const drop1 = await createDrop({
    title: 'Sony PlayStation 5 Pro — 30th Anniversary Limited Edition Bundle',
    description: "Celebrate three decades of play with the ultra-rare 30th Anniversary PS5 Pro Bundle. Includes the PS5 Pro console featuring the original PS1 gray colorway, DualSense Edge controller, and exclusive collector's items. Strictly limited to 50 units globally.",
    imageUrl: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800&q=80',
    price: 99999, // $999.99
    totalInventory: 50,
    scheduledStart: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    sellerId: 'seller-sony-demo',
  });

  // Activate and sell out
  await activateDrop(drop1.dropId);

  // Simulate queue entries for Drop Report

  const userIds: string[] = [];

  // Create 30 demo users
  for (let i = 0; i < 30; i++) {
    const userId = `demo-user-${generateId()}`;
    userIds.push(userId);
    await getOrCreateUser(userId);
    userCount++;
  }

  // Simulate 10 successful claims + 5 failed attempts
  for (let i = 0; i < 10; i++) {

    const userId = userIds[Math.floor(Math.random() * userIds.length)];
    const region = ALL_REGION_CODES[Math.floor(Math.random() * ALL_REGION_CODES.length)];

    await logQueueEntry({
      dropId: drop1.dropId,
      userId,
      action: 'claim_success',
      region,
      userAgent: 'Mozilla/5.0 (demo)',
    });
    queueEntryCount++;
  }

  // Failed attempts (sold out + duplicates)
  for (let i = 0; i < 5; i++) {

    const userId = userIds[Math.floor(Math.random() * userIds.length)];
    const region = ALL_REGION_CODES[Math.floor(Math.random() * ALL_REGION_CODES.length)];

    await logQueueEntry({
      dropId: drop1.dropId,
      userId,
      action: Math.random() > 0.3 ? 'claim_failed_sold_out' : 'claim_failed_duplicate',
      region,
      userAgent: 'Mozilla/5.0 (demo)',
    });
    queueEntryCount++;
  }

  // Set inventory to 0 to reflect sold out
  await putItem({
    PK: `DROP#${drop1.dropId}`,
    SK: 'INVENTORY',
    entityType: 'INVENTORY',
    available: 0,
    reserved: 50,
  });
  await markSoldOut(drop1.dropId);

  console.log(`[Seed] Drop 1 created: ${drop1.title} (SOLD OUT, ${queueEntryCount} queue entries)`);

  // ---- Drop 2: Live / Active ----
  // This is the drop judges can interact with
  const drop2 = await createDrop({
    title: 'NVIDIA GeForce RTX 5090 Founders Edition',
    description: 'The ultimate GPU has arrived. Featuring the next-generation Blackwell architecture, 32GB of GDDR7 memory, and unrivaled AI performance. Claim your spot in line to secure the most sought-after piece of hardware on the planet.',
    imageUrl: '/images/rtx-5090.png',
    price: 199900, // $1999.00
    totalInventory: 100,
    scheduledStart: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // started 10 min ago
    sellerId: 'seller-nvidia-demo',
  });

  await activateDrop(drop2.dropId);

  // Set inventory to show some have been claimed
  await putItem({
    PK: `DROP#${drop2.dropId}`,
    SK: 'INVENTORY',
    entityType: 'INVENTORY',
    available: 67,
    reserved: 33,
  });

  // Add some queue entries for the live drop
  for (let i = 0; i < 5; i++) {
    const userId = userIds[Math.floor(Math.random() * userIds.length)];
    const region = ALL_REGION_CODES[Math.floor(Math.random() * ALL_REGION_CODES.length)];
    await logQueueEntry({
      dropId: drop2.dropId,
      userId,
      action: i < 33 ? 'claim_success' : 'claim_failed_duplicate',
      region,
      userAgent: 'Mozilla/5.0 (demo)',
    });
    queueEntryCount++;
  }

  console.log(`[Seed] Drop 2 created: ${drop2.title} (LIVE, 67 remaining)`);

  // ---- Drop 3: Upcoming ----
  const drop3 = await createDrop({
    title: 'Tesla Cybertruck Foundation Series — Priority Delivery Token',
    description: 'Skip the massive waitlist. This exclusive reservation token guarantees priority delivery of your dual-motor Foundation Series Cybertruck within the next 30 days. Fully refundable deposit.',
    imageUrl: '/images/cybertruck.png',
    price: 100000, // $1000.00
    totalInventory: 200,
    scheduledStart: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    sellerId: 'seller-tesla-demo',
  });

  console.log(`[Seed] Drop 3 created: ${drop3.title} (UPCOMING)`);

  return {
    drops: 3,
    queueEntries: queueEntryCount,
    users: userCount,
  };
}
