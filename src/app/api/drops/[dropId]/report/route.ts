// GET /api/drops/[dropId]/report

import { NextRequest, NextResponse } from 'next/server';
import { getDropReport } from '@/lib/db/queue';
import type { ApiError } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dropId: string }> },
) {
  try {
    const { dropId } = await params;
    const report = await getDropReport(dropId);

    if (!report) {
      return NextResponse.json(
        { error: 'Drop not found', code: 'NOT_FOUND' } satisfies ApiError,
        { status: 404 },
      );
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error('[API] GET /api/drops/[dropId]/report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500 },
    );
  }
}
