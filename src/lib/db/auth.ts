// ============================================================
// Burst — DynamoDB Auth Functions
// ============================================================
// User registration, login, and profile management.
// Passwords are hashed with bcrypt. OAuth accounts are linked
// via provider-specific keys.
// ============================================================

import { getItem, putItem, queryItems, generateId } from '../dynamodb';
import bcrypt from 'bcryptjs';

// ---- Types ----

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  image?: string;
  passwordHash?: string; // null for OAuth-only accounts
  emailVerified: boolean;
  provider: 'credentials' | 'github' | 'google';
  createdAt: string;
}

interface AuthUserItem {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  entityType: string;
  userId: string;
  email: string;
  name: string;
  image?: string;
  passwordHash?: string;
  emailVerified: boolean;
  provider: string;
  createdAt: string;
  [key: string]: unknown;
}

// ---- Registration ----

export async function registerUser(
  email: string,
  password: string,
  name: string,
): Promise<AuthUser> {
  // Check if email already exists
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error('EMAIL_EXISTS');
  }

  const userId = generateId('user');
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();

  const item: AuthUserItem = {
    PK: `AUTH_USER#${userId}`,
    SK: 'PROFILE',
    GSI1PK: `AUTH_EMAIL#${email.toLowerCase()}`,
    GSI1SK: 'PROFILE',
    entityType: 'AUTH_USER',
    userId,
    email: email.toLowerCase(),
    name,
    passwordHash,
    emailVerified: false, // Would require email service in production
    provider: 'credentials',
    createdAt: now,
  };

  await putItem(item);

  return {
    userId,
    email: email.toLowerCase(),
    name,
    emailVerified: false,
    provider: 'credentials',
    createdAt: now,
  };
}

// ---- Login ----

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const user = await findUserByEmail(email);
  if (!user || !user.passwordHash) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return user;
}

// ---- OAuth Account Linking ----

export async function findOrCreateOAuthUser(
  provider: 'github' | 'google',
  profile: {
    id: string;
    email: string;
    name: string;
    image?: string;
  },
): Promise<AuthUser> {
  // Check if this OAuth account is already linked
  const existingLink = await getItem<{ userId: string }>(
    `AUTH_OAUTH#${provider}#${profile.id}`,
    'LINK',
  );

  if (existingLink) {
    // User exists, fetch full profile
    const user = await findUserById(existingLink.userId);
    if (user) return user;
  }

  // Check if a user with this email exists (link accounts)
  const existingByEmail = await findUserByEmail(profile.email);
  if (existingByEmail) {
    // Link OAuth account to existing user
    await putItem({
      PK: `AUTH_OAUTH#${provider}#${profile.id}`,
      SK: 'LINK',
      entityType: 'AUTH_OAUTH_LINK',
      userId: existingByEmail.userId,
      provider,
      providerAccountId: profile.id,
      createdAt: new Date().toISOString(),
    });
    return existingByEmail;
  }

  // Create new user + OAuth link
  const userId = generateId('user');
  const now = new Date().toISOString();

  const userItem: AuthUserItem = {
    PK: `AUTH_USER#${userId}`,
    SK: 'PROFILE',
    GSI1PK: `AUTH_EMAIL#${profile.email.toLowerCase()}`,
    GSI1SK: 'PROFILE',
    entityType: 'AUTH_USER',
    userId,
    email: profile.email.toLowerCase(),
    name: profile.name,
    image: profile.image,
    emailVerified: true, // OAuth emails are pre-verified
    provider,
    createdAt: now,
  };

  await putItem(userItem);

  // Create OAuth link
  await putItem({
    PK: `AUTH_OAUTH#${provider}#${profile.id}`,
    SK: 'LINK',
    entityType: 'AUTH_OAUTH_LINK',
    userId,
    provider,
    providerAccountId: profile.id,
    createdAt: now,
  });

  return {
    userId,
    email: profile.email.toLowerCase(),
    name: profile.name,
    image: profile.image,
    emailVerified: true,
    provider,
    createdAt: now,
  };
}

// ---- Query Helpers ----

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const items = await queryItems<AuthUserItem>(
    'GSI1PK = :pk AND GSI1SK = :sk',
    { ':pk': `AUTH_EMAIL#${email.toLowerCase()}`, ':sk': 'PROFILE' },
    { indexName: 'GSI1' },
  );

  if (items.length === 0) return null;

  const item = items[0];
  return {
    userId: item.userId,
    email: item.email,
    name: item.name,
    image: item.image,
    passwordHash: item.passwordHash,
    emailVerified: item.emailVerified,
    provider: item.provider as AuthUser['provider'],
    createdAt: item.createdAt,
  };
}

export async function findUserById(userId: string): Promise<AuthUser | null> {
  const item = await getItem<AuthUserItem>(`AUTH_USER#${userId}`, 'PROFILE');
  if (!item) return null;

  return {
    userId: item.userId,
    email: item.email,
    name: item.name,
    image: item.image,
    passwordHash: item.passwordHash,
    emailVerified: item.emailVerified,
    provider: item.provider as AuthUser['provider'],
    createdAt: item.createdAt,
  };
}
