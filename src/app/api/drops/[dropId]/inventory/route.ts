// GET /api/drops/[dropId]/inventory

import { NextRequest, NextResponse } from 'next/server';
import { getInventory } from '@/lib/db/drops';
import type { ApiError } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dropId: string }> },
) {
  try {
    const { dropId } = await params;
    const inventory = await getInventory(dropId);

    if (!inventory) {
      return NextResponse.json(
        { error: 'Inventory not found', code: 'NOT_FOUND' } satisfies ApiError,
        { status: 404 },
      );
    }

    return NextResponse.json({ inventory });
  } catch (error) {
    console.error('[API] GET /api/drops/[dropId]/inventory error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500 },
    );
  }
}
