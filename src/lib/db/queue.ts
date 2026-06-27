// ============================================================
// Burst — Queue Entries & Drop Report Aggregation
// ============================================================
// Every claim attempt (success or failure) is logged as a
// QueueEntry. These entries power the Drop Report — the
// originality feature that no other drop platform offers.
// ============================================================

import { putItem, queryItems, generateId } from '../dynamodb';
import { getDrop } from './drops';
import type { QueueEntryItem, QueueAction, DropReport } from '../types';

// ---- Log a Queue Entry ----

export async function logQueueEntry(params: {
  dropId: string;
  userId: string;
  action: QueueAction;
  region: string;
  userAgent: string;
}): Promise<void> {
  const now = new Date();
  const timestamp = now.toISOString();
  const suffix = generateId();

  const item: QueueEntryItem = {
    PK: `DROP#${params.dropId}`,
    SK: `QUEUE#${timestamp}#${suffix}`,
    GSI2PK: `DROP#${params.dropId}#QUEUE`,
    GSI2SK: timestamp,
    entityType: 'QUEUE_ENTRY',
    userId: params.userId,
    dropId: params.dropId,
    action: params.action,
    timestamp,
    region: params.region,
    userAgent: params.userAgent,
  };

  await putItem(item);
}

// ---- Get Queue Entries for a Drop ----

export async function getQueueEntries(dropId: string): Promise<QueueEntryItem[]> {
  return queryItems<QueueEntryItem>(
    'GSI2PK = :pk',
    { ':pk': `DROP#${dropId}#QUEUE` },
    { indexName: 'GSI2', scanForward: true },
  );
}

// ============================================================
// Drop Report Aggregation
// ============================================================
// Processes raw queue entries into the Drop Report shape:
// - Inventory timeline (units remaining over time)
// - Geographic breakdown (claims by region)
// - Fairness score (unique users / total attempts)
// - Peak second (most attempts in a single second)
// ============================================================

export async function getDropReport(dropId: string): Promise<DropReport | null> {
  const [drop, entries] = await Promise.all([
    getDrop(dropId),
    getQueueEntries(dropId),
  ]);

  if (!drop) return null;

  // Aggregate counts
  let successfulClaims = 0;
  let failedSoldOut = 0;
  let failedDuplicate = 0;
  const uniqueUsers = new Set<string>();
  const regionCounts = new Map<string, number>();
  const secondCounts = new Map<string, number>();

  // Build inventory timeline
  let remaining = drop.totalInventory;
  const inventoryTimeline: { timestamp: string; remaining: number }[] = [];

  for (const entry of entries) {
    uniqueUsers.add(entry.userId);

    // Count by action
    switch (entry.action) {
      case 'claim_success':
        successfulClaims++;
        remaining = Math.max(0, remaining - 1);
        inventoryTimeline.push({ timestamp: entry.timestamp, remaining });
        break;
      case 'claim_failed_sold_out':
        failedSoldOut++;
        break;
      case 'claim_failed_duplicate':
        failedDuplicate++;
        break;
    }

    // Count by region
    regionCounts.set(entry.region, (regionCounts.get(entry.region) || 0) + 1);

    // Count by second (for peak detection)
    const second = entry.timestamp.substring(0, 19); // Truncate to second
    secondCounts.set(second, (secondCounts.get(second) || 0) + 1);
  }

  const totalAttempts = entries.length;

  // Build region breakdown
  const regionBreakdown = Array.from(regionCounts.entries())
    .map(([region, count]) => ({
      region,
      count,
      percentage: totalAttempts > 0 ? Math.round((count / totalAttempts) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Find peak second
  let peakSecond = { timestamp: '', attempts: 0 };
  for (const [ts, count] of secondCounts) {
    if (count > peakSecond.attempts) {
      peakSecond = { timestamp: ts, attempts: count };
    }
  }

  // Fairness score
  const fairnessScore = totalAttempts > 0
    ? Math.round((uniqueUsers.size / totalAttempts) * 100)
    : 100;

  return {
    dropId,
    title: drop.title,
    totalInventory: drop.totalInventory,
    totalAttempts,
    successfulClaims,
    failedSoldOut,
    failedDuplicate,
    uniqueUsers: uniqueUsers.size,
    fairnessScore,
    inventoryTimeline,
    regionBreakdown,
    peakSecond,
  };
}
