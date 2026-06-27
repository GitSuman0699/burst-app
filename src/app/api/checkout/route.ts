// POST /api/checkout — Create Stripe Checkout Session
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createCheckoutSession } from '@/lib/stripe';
import { getDrop } from '@/lib/db/drops';
import { getItem } from '@/lib/dynamodb';
import type { ReservationItem } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reservationId, dropId } = await request.json();

    if (!reservationId || !dropId) {
      return NextResponse.json(
        { error: 'reservationId and dropId are required' },
        { status: 400 },
      );
    }

    // Fetch reservation
    const reservation = await getItem<ReservationItem>(
      `DROP#${dropId}`,
      `RESERVATION#${reservationId}`,
    );

    if (!reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 },
      );
    }

    // Verify ownership
    if (reservation.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'This reservation belongs to another user' },
        { status: 403 },
      );
    }

    // Check not expired
    if (reservation.expiresAt * 1000 < Date.now()) {
      return NextResponse.json(
        { error: 'Reservation has expired' },
        { status: 410 },
      );
    }

    // Check not already confirmed
    if (reservation.status === 'confirmed') {
      return NextResponse.json(
        { error: 'This reservation is already confirmed' },
        { status: 409 },
      );
    }

    // Get drop details for Stripe line item
    const drop = await getDrop(dropId);
    if (!drop) {
      return NextResponse.json(
        { error: 'Drop not found' },
        { status: 404 },
      );
    }

    // Create Stripe Checkout Session
    const checkoutUrl = await createCheckoutSession({
      dropTitle: drop.title,
      priceInCents: drop.price,
      reservationId,
      dropId,
      userId: session.user.id,
      imageUrl: drop.imageUrl,
      expiresAt: reservation.expiresAt,
    });

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error('[API] Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
