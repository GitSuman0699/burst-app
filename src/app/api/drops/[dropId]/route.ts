// GET /api/drops/[dropId]

import { NextRequest, NextResponse } from 'next/server';
import { getDropWithInventory } from '@/lib/db/drops';
import { auth } from '@/auth';
import type { ApiError } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dropId: string }> },
) {
  try {
    const { dropId } = await params;
    
    // Securely get the user from the session, rather than trusting the query parameter
    const session = await auth();
    const userId = session?.user?.id;

    const data = await getDropWithInventory(dropId);

    if (!data) {
      return NextResponse.json(
        { error: 'Drop not found', code: 'NOT_FOUND' } satisfies ApiError,
        { status: 404 },
      );
    }

    let reservation = null;
    if (userId) {
      const { queryItems } = await import('@/lib/dynamodb');
      const items = await queryItems(
        'GSI1PK = :pk',
        { ':pk': `USER#${userId}#RESERVATIONS`, ':dropId': dropId },
        { 
          indexName: 'GSI1',
          filterExpression: 'dropId = :dropId'
        }
      );
      if (items && items.length > 0) {
        // Sort descending by createdAt to get the latest (though there should only be one per drop per user)
        items.sort((a, b) => (b as any).createdAt.localeCompare((a as any).createdAt));
        
        // Strip DynamoDB specific keys if needed, or just return the item.
        // We only return it if it hasn't expired (TTL hasn't kicked in or it's within the window)
        // Wait, DynamoDB TTL deletes the item, but we should double check expiresAt
        const latest = items[0] as any;
        if (latest.status === 'confirmed' || latest.expiresAt * 1000 > Date.now()) {
          reservation = latest;
        }
      }
    }

    return NextResponse.json({ ...data, reservation });
  } catch (error) {
    console.error('[API] GET /api/drops/[dropId] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drop', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500 },
    );
  }
}
