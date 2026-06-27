// POST /api/drops/[dropId]/claim THE CORE API

import { NextRequest, NextResponse } from 'next/server';
import { claimSpot } from '@/lib/db/claims';
import { logQueueEntry } from '@/lib/db/queue';
import { getDrop } from '@/lib/db/drops';
import { auth } from '@/auth';
import type { ApiError } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dropId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' } satisfies ApiError,
        { status: 401 },
      );
    }
    const userId = session.user.id;
    
    const { dropId } = await params;
    const body = await request.json();
    const { region } = body;

    if (!region) {
      return NextResponse.json(
        { error: 'region is required', code: 'VALIDATION_ERROR' } satisfies ApiError,
        { status: 400 },
      );
    }

 // Verify drop is live
 const drop = await getDrop(dropId);
 if (!drop) {
 return NextResponse.json(
 { error: 'Drop not found', code: 'NOT_FOUND' } satisfies ApiError,
 { status: 404 },
 );
 }
 if (drop.status !== 'live') {
 return NextResponse.json({
 success: false,
 error: 'DROP_NOT_LIVE',
 message: `This drop is ${drop.status}`,
 });
 }

 // Execute the TransactWriteItems claim
 const result = await claimSpot(dropId, userId);

 // Log the queue entry regardless of outcome
 const userAgent = request.headers.get('user-agent') || 'unknown';
 await logQueueEntry({
 dropId,
 userId,
 action: result.success ? 'claim_success' : 
 result.error === 'ALREADY_CLAIMED' ? 'claim_failed_duplicate' :
 'claim_failed_sold_out',
 region,
 userAgent,
 });

 if (result.success) {
 return NextResponse.json(result);
 } else {
 const statusCode = result.error === 'SOLD_OUT' ? 409 : 
 result.error === 'ALREADY_CLAIMED' ? 409 : 500;
 return NextResponse.json(result, { status: statusCode });
 }
 } catch (error) {
 console.error('[API] POST /api/drops/[dropId]/claim error:', error);
 return NextResponse.json(
 { error: 'Internal error', code: 'INTERNAL_ERROR' } satisfies ApiError,
 { status: 500 },
 );
 }
}
