// POST /api/admin/seed

import { NextRequest, NextResponse } from 'next/server';
import { seedDemoData } from '@/lib/db/seed';
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

    console.log('[Admin] Starting demo data seed...');
    const result = await seedDemoData();
    console.log('[Admin] Seed complete:', result);

    return NextResponse.json({
      success: true,
      message: 'Demo data seeded successfully',
      ...result,
    });
  } catch (error) {
    console.error('[API] POST /api/admin/seed error:', error);
    return NextResponse.json(
      { error: 'Failed to seed data', code: 'INTERNAL_ERROR' } satisfies ApiError,
      { status: 500 },
    );
  }
}
