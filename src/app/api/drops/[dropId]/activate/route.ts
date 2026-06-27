// POST /api/drops/[dropId]/activate

import { NextRequest, NextResponse } from 'next/server';
import { activateDrop } from '@/lib/db/drops';
import type { ApiError } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dropId: string }> },
) {
  try {
    const adminKey = request.headers.get('x-admin-key');
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' } satisfies ApiError,
        { status: 401 },
      );
    }

    const { dropId } = await params;
    const drop = await activateDrop(dropId);
    return NextResponse.json({ drop });
  } catch (error) {
    console.error('[API] POST /api/drops/[dropId]/activate error:', error);
    return NextResponse.json(
      { error: 'Failed to activate drop', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500 },
    );
  }
}
