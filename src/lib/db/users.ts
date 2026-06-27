// ============================================================
// Burst — User Operations
// ============================================================

import { getItem, putItem, ConditionalCheckError } from '../dynamodb';
import { generateDisplayName } from '../names';
import type { UserItem, User } from '../types';

// ---- Key Builders ----

function userPK(userId: string): string { return `USER#${userId}`; }
const PROFILE_SK = 'PROFILE';

// ---- Mapper ----

function toUserDomain(item: UserItem): User {
  return {
    userId: item.userId,
    displayName: item.displayName,
    totalClaims: item.totalClaims,
    successfulClaims: item.successfulClaims,
    joinedAt: item.joinedAt,
  };
}

// ---- Operations ----

export async function getOrCreateUser(userId: string): Promise<User> {
  // Try to get existing user
  const existing = await getItem<UserItem>(userPK(userId), PROFILE_SK);
  if (existing) return toUserDomain(existing);

  // Create new user
  const now = new Date().toISOString();
  const displayName = generateDisplayName(userId);

  const item: UserItem = {
    PK: userPK(userId),
    SK: PROFILE_SK,
    entityType: 'USER',
    userId,
    displayName,
    totalClaims: 0,
    successfulClaims: 0,
    joinedAt: now,
  };

  try {
    await putItem(item, 'attribute_not_exists(PK)');
  } catch (error) {
    if (error instanceof ConditionalCheckError) {
      // Race condition: another request created the user first
      const freshItem = await getItem<UserItem>(userPK(userId), PROFILE_SK);
      if (freshItem) return toUserDomain(freshItem);
    }
    throw error;
  }

  return toUserDomain(item);
}

export async function getUserProfile(userId: string): Promise<User | null> {
  const item = await getItem<UserItem>(userPK(userId), PROFILE_SK);
  return item ? toUserDomain(item) : null;
}
