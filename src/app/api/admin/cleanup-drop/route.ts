import { NextRequest, NextResponse } from 'next/server';
import { getDropReservations, releaseSpot } from '@/lib/db/claims';
import { getDrop, activateDrop } from '@/lib/db/drops';
import type { ApiError } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key');
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' } satisfies ApiError,
        { status: 401 },
      );
    }

    const body = await request.json();
    const { dropId } = body;

    if (!dropId) {
      return NextResponse.json(
        { error: 'dropId is required', code: 'VALIDATION_ERROR' } satisfies ApiError,
        { status: 400 },
      );
    }

    const drop = await getDrop(dropId);
    if (!drop) {
      return NextResponse.json(
        { error: 'Drop not found', code: 'NOT_FOUND' } satisfies ApiError,
        { status: 404 },
      );
    }

    // Fetch all reservations for this drop
    const reservations = await getDropReservations(dropId);
    
    // Filter for reservations to clean up:
    // 1. Any reservation that is naturally 'expired' (past 10 mins)
    // 2. ANY simulated reservation that hasn't checked out yet (makes testing faster)
    const toCleanup = reservations.filter(
      r => r.status === 'expired' || (r.userId.startsWith('sim-') && r.status === 'reserved')
    );

    let releasedCount = 0;
    const errors = [];

    // Process them
    for (const res of toCleanup) {
      const result = await releaseSpot(dropId, res.userId, res.reservationId);
      if (result.success) {
        releasedCount++;
      } else {
        errors.push(res.reservationId);
      }
    }

    // If we released inventory, unconditionally ensure it is set back to live
    if (releasedCount > 0) {
      await activateDrop(dropId).catch(e => console.error('Reactivation silently failed', e)); 
    }

    return NextResponse.json({
      success: true,
      releasedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[API] POST /api/admin/cleanup-drop error:', error);
    return NextResponse.json(
      { error: 'Failed to clean up', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500 },
    );
  }
}
