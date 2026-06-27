# Burst

Burst is a specialized, serverless "Drop Engine" designed to handle extreme high-concurrency e-commerce events (hype drops, limited edition releases, sneaker drops, etc.) without crashing or double-booking inventory. 

Built entirely on **Vercel** and **AWS DynamoDB**, Burst proves you can solve complex transactional e-commerce problems without relying on massive, heavy-weight queueing infrastructure (like Redis or Kafka). It embraces a "Zero Stack" serverless philosophy to achieve virtually infinite scale and single-digit millisecond latency.

## Features & The Flow

### The "Drop" Experience
1. **Live Inventory Sync:** Users land on the storefront to view upcoming and live drops.
2. **High-Concurrency Claims:** When a drop goes live, users rush to claim a spot. 
3. **Atomic Transactions:** Instead of relying on a queue, Burst uses DynamoDB's `TransactWriteItems` to atomically decrement inventory and lock the user's claim in a single, ACID-compliant operation. If the item is sold out, or the user has already claimed a spot, the transaction elegantly fails and the UI reacts instantly.
4. **Payment Window (TTL):** Once a spot is claimed, the user is placed in a 10-minute checkout window. This is managed natively by DynamoDB TTLs (Time-To-Live). If the user doesn't pay in time, their reservation expires and the spot is thrown back into the public inventory pool.

### Architecture Highlights
- **Framework:** Next.js 16 (App Router)
- **Database:** AWS DynamoDB (Single-Table Design pattern for extreme performance)
- **Authentication:** NextAuth (Credentials provider + custom DB adapter pattern)
- **Payments:** Stripe Checkout + Webhook listener for secure server-to-server confirmation.
- **Styling:** Custom CSS Modules with a bespoke glassmorphic, dark-mode aesthetic. No generic component libraries.

## Local Development Setup

To run Burst locally, you will need an AWS account, a Stripe account, and Node.js.

### 1. Environment Variables
Create a `.env.local` file in the root directory and populate it with your credentials:

```env
# AWS Credentials (Requires DynamoDB Full Access)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your_aws_key"
AWS_SECRET_ACCESS_KEY="your_aws_secret"

# Stripe Credentials
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# NextAuth Secrets
NEXTAUTH_SECRET="your_random_secret"
NEXTAUTH_URL="http://localhost:3000"

# Admin Testing
ADMIN_SECRET="burst-admin-secret"
```

### 2. Database Initialization
Burst uses a Single-Table Design. You only need one DynamoDB table.
- **Table Name:** `burst-table` (or edit `TABLE_NAME` in `src/lib/dynamodb.ts`)
- **Partition Key (PK):** String
- **Sort Key (SK):** String
- **Global Secondary Index (GSI1):** 
  - Partition Key: `GSI1PK` (String)
  - Sort Key: `GSI1SK` (String)

### 3. Installation & Seeding

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Navigate to `http://localhost:3000/admin` and click **"Run Full Demo Seed"** to populate the database with a completed mock drop and a live interactive drop.

## Security Posture
Burst takes e-commerce security seriously:
- **Server-Side Validation:** The API never trusts the client for user identity. All protected routes (Claims, Orders, Checkouts) securely validate the HTTP-only NextAuth session cookie.
- **Webhook Hardening:** Payments are strictly finalized via Stripe Webhooks with signature validation, ensuring users cannot bypass the checkout flow.
- **Duplicate Prevention:** DynamoDB handles duplicate claims at the infrastructure level using conditional expressions.

## Design Philosophy
Burst embraces software craftsmanship. It eschews standard UI component libraries in favor of a tailor-made interface. By strictly controlling the full stack—from the `transactWrite` database operations to the `onConfirm` React states—Burst delivers an immediate, snappy, and cohesive user experience.
