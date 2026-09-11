# Blend & Beam

Premium Ghana-focused salon equipment commerce platform using Next.js App Router, strict TypeScript, Tailwind CSS, Supabase PostgreSQL/Auth/Storage, and Paystack.

## Setup

1. Use Node 20.19+ and run `npm install`.
2. Copy `.env.example` to `.env.local` and add development credentials.
3. Link Supabase, run `supabase db push`, and provision the buckets in `DATABASE.md`.
4. Run `npm run dev`.

Quality gates: `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.

`src/app` owns routes and integration endpoints, `src/components` reusable UI, `src/lib` business utilities and Supabase clients, and `supabase/migrations` the versioned data/security model. Amounts are integer minor units. The server owns totals, inventory mutation, authorization, and payment verification.

The current catalog is development content and must be replaced with owner-approved products and photography. Fake orders or analytics are never seeded.
