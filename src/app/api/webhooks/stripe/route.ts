// POST /api/webhooks/stripe — Stripe Webhook Handler
import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe';
import { confirmReservation } from '@/lib/db/claims';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event;
    try {
      event = constructWebhookEvent(body, signature);
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { reservationId, dropId } = session.metadata || {};

      if (reservationId && dropId) {
        console.log(`[Stripe Webhook] Payment confirmed: reservation=${reservationId}, drop=${dropId}`);
        
        try {
          await confirmReservation(dropId, reservationId);
          console.log(`[Stripe Webhook] Reservation ${reservationId} confirmed in DynamoDB`);
        } catch (error) {
          console.error(`[Stripe Webhook] Failed to confirm reservation:`, error);
          // Return 200 anyway — Stripe will retry if we return error
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}
