import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { confirmReservation } from '@/lib/db/claims';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    const authSession = await auth();
    if (!authSession?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await request.json();

    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid' && session.metadata?.reservationId && session.metadata?.dropId) {
      await confirmReservation(session.metadata.dropId, session.metadata.reservationId);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Not paid or invalid metadata' }, { status: 400 });
  } catch (error) {
    console.error('[Verify] Error verifying checkout:', error);
    return NextResponse.json({ error: 'Failed to verify checkout' }, { status: 500 });
  }
}
