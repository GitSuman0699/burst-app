// GET/POST /api/drops

import { NextRequest, NextResponse } from 'next/server';
import { listDrops, createDrop } from '@/lib/db/drops';
import type { DropStatus, ApiError } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get('status') as DropStatus | null;
    const sellerId = request.nextUrl.searchParams.get('sellerId');
    const drops = await listDrops(status || undefined, sellerId || undefined);
    return NextResponse.json({ drops });
  } catch (error) {
    console.error('[API] GET /api/drops error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drops', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500 },
    );
  }
}

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
    const { title, description, imageUrl, price, totalInventory, scheduledStart, sellerId } = body;

    if (!title || !description || !price || !totalInventory || !scheduledStart) {
      return NextResponse.json(
        { error: 'Missing required fields', code: 'VALIDATION_ERROR' } satisfies ApiError,
        { status: 400 },
      );
    }

    const drop = await createDrop({
      title,
      description,
      imageUrl: imageUrl || '',
      price: Number(price),
      totalInventory: Number(totalInventory),
      scheduledStart,
      sellerId: sellerId || 'anonymous',
    });

    return NextResponse.json({ drop }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/drops error:', error);
    return NextResponse.json(
      { error: 'Failed to create drop', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500 },
    );
  }
}
