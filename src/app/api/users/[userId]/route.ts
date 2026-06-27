// GET /api/users/[userId]

import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile, getOrCreateUser } from '@/lib/db/users';
import { getUserReservations } from '@/lib/db/claims';
import type { ApiError } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;

    // Get or create the user profile
    const user = await getOrCreateUser(userId);

    // Get their reservations
    const reservations = await getUserReservations(userId);

    return NextResponse.json({ user, reservations });
  } catch (error) {
    console.error('[API] GET /api/users/[userId] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500 },
    );
  }
}
