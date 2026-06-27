import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { queryItems, getItem } from '@/lib/dynamodb';
import type { ReservationItem, DropItem, Drop } from '@/lib/types';
import { toDropDomain } from '@/lib/db/drops'; 

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's reservations from GSI1
    const reservations = await queryItems<ReservationItem>(
      'GSI1PK = :pk',
      { ':pk': `USER#${userId}#RESERVATIONS` },
      { indexName: 'GSI1', scanForward: false } // Newest first
    );

    // Fetch drop details for each reservation
    const { getDrop } = await import('@/lib/db/drops');
    
    const orders = await Promise.all(
      reservations.map(async (res) => {
        const drop = await getDrop(res.dropId);
        return {
          ...res,
          drop
        };
      })
    );

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('[API] GET /api/orders error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
