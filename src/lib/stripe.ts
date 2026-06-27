// ============================================================
// Burst — Stripe Client & Helpers
// ============================================================

import Stripe from 'stripe';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';

if (!STRIPE_KEY) {
  console.warn('[Burst] STRIPE_SECRET_KEY not set — payment features will not work.');
}

export const stripe = STRIPE_KEY
  ? new Stripe(STRIPE_KEY, { typescript: true })
  : (null as unknown as Stripe);

// Create a Checkout Session for a reservation
export async function createCheckoutSession(params: {
  dropTitle: string;
  priceInCents: number;
  reservationId: string;
  dropId: string;
  userId: string;
  imageUrl?: string;
  expiresAt: number; // Unix epoch (reservation expiry)
}): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: params.dropTitle,
            images: params.imageUrl ? [params.imageUrl] : [],
          },
          unit_amount: params.priceInCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      reservationId: params.reservationId,
      dropId: params.dropId,
      userId: params.userId,
    },
    success_url: `${getBaseUrl()}/drop/${params.dropId}/confirmed?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getBaseUrl()}/drop/${params.dropId}`,
  });

  return session.url!;
}

function getBaseUrl() {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

// Verify Stripe webhook signature
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
}
