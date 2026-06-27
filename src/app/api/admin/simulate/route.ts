// POST /api/admin/simulate

import { NextRequest, NextResponse } from 'next/server';
import { claimSpot } from '@/lib/db/claims';
import { logQueueEntry } from '@/lib/db/queue';
import { generateId } from '@/lib/dynamodb';
import { ALL_REGION_CODES } from '@/lib/regions';
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
    const { dropId, count = 10, waves = 3 } = body;

    if (!dropId) {
      return NextResponse.json(
        { error: 'dropId is required', code: 'VALIDATION_ERROR' } satisfies ApiError,
        { status: 400 },
      );
    }

    const claimCount = Math.min(count, 200); // Cap at 200
    const results: { success: number; soldOut: number; duplicate: number } = {
      success: 0,
      soldOut: 0,
      duplicate: 0,
    };

    // Simulate claims in waves
    const waveCount = Math.min(waves, 10);
    const perWave = Math.ceil(claimCount / waveCount);

    for (let wave = 0; wave < waveCount; wave++) {
      const promises = [];

      for (let i = 0; i < perWave && (wave * perWave + i) < claimCount; i++) {
        const userId = `sim-${generateId()}`;
        const region = ALL_REGION_CODES[Math.floor(Math.random() * ALL_REGION_CODES.length)];

        promises.push(
          claimSpot(dropId, userId).then(async (result) => {
            // Log queue entry
            await logQueueEntry({
              dropId,
              userId,
              action: result.success ? 'claim_success' : 'claim_failed_sold_out',
              region,
              userAgent: 'BurstSimulator/1.0',
            });

            if (result.success) results.success++;
            else if ('error' in result && result.error === 'SOLD_OUT') results.soldOut++;
            else results.duplicate++;
          }).catch(() => {
            results.soldOut++;
          }),
        );
      }

      // Execute wave
      await Promise.allSettled(promises);
    }

    console.log(`[Admin] Simulation complete: ${JSON.stringify(results)}`);

    return NextResponse.json({
      success: true,
      totalAttempts: claimCount,
      successfulClaims: results.success,
      soldOut: results.soldOut,
      duplicate: results.duplicate,
    });
  } catch (error) {
    console.error('[API] POST /api/admin/simulate error:', error);
    return NextResponse.json(
      { error: 'Failed to simulate', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500 },
    );
  }
}
