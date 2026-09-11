# Architecture

Blend & Beam is a modular Next.js application for Vercel. Server Components render read-heavy storefront pages; narrow Route Handlers isolate third-party callbacks. Supabase PostgreSQL is the source of truth and RLS is the final ownership boundary.

Commerce rules use integer minor units and immutable order-item snapshots. Order and payment lifecycles are distinct. Inventory changes are represented in a movement ledger; payment events have provider-level unique keys. The checkout transaction must validate server prices and delivery, lock inventory rows, create order snapshots, adjust stock, and record movements atomically.

Provider boundaries cover catalog repositories, payment gateways, mail, object storage, and analytics so future search, logistics, and currency providers need not leak into UI code.
