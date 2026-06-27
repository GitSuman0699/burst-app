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
    title: 'Air Jordan 1 Retro High OG — Chicago',
    description: 'The legendary Chicago colorway returns. Premium leather construction with the iconic red, white, and black color blocking. Limited to 500 pairs worldwide.',
    imageUrl: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=800&q=80',
    price: 17000, // $170.00
    totalInventory: 500,
    scheduledStart: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    sellerId: 'seller-nike-demo',
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

  // Simulate 500 successful claims + 200 failed attempts over 45 seconds
  for (let i = 0; i < 500; i++) {

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
  for (let i = 0; i < 150; i++) {

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
    reserved: 500,
  });
  await markSoldOut(drop1.dropId);

  console.log(`[Seed] Drop 1 created: ${drop1.title} (SOLD OUT, ${queueEntryCount} queue entries)`);

  // ---- Drop 2: Live / Active ----
  // This is the drop judges can interact with
  const drop2 = await createDrop({
    title: 'Neon Genesis Collection — Artist Print #001',
    description: 'First edition signed print by acclaimed digital artist VOID_MSTR. Gallery-quality giclée on 300gsm cotton rag. Each print includes a certificate of authenticity.',
    imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80',
    price: 25000, // $250.00
    totalInventory: 100,
    scheduledStart: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // started 10 min ago
    sellerId: 'seller-artist-demo',
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
  for (let i = 0; i < 40; i++) {
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
    title: 'Midnight Festival VIP Pass — Summer 2026',
    description: 'Exclusive VIP access to the Midnight Festival. Includes backstage access, artist meet & greet, premium viewing area, and festival merchandise bundle. Limited to 200 passes.',
    imageUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80',
    price: 35000, // $350.00
    totalInventory: 200,
    scheduledStart: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    sellerId: 'seller-festival-demo',
  });

  console.log(`[Seed] Drop 3 created: ${drop3.title} (UPCOMING)`);

  return {
    drops: 3,
    queueEntries: queueEntryCount,
    users: userCount,
  };
}
