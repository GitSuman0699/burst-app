import { NextResponse } from 'next/server';
import { releaseSpot } from '@/lib/db/claims';
import { auth } from '@/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dropId: string }> }
) {
  try {
    const { dropId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reservationId } = await request.json();
    if (!reservationId) {
      return NextResponse.json({ error: 'reservationId required' }, { status: 400 });
    }

    const result = await releaseSpot(dropId, session.user.id, reservationId);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error, message: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Release API error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
