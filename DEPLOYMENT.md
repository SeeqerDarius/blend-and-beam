# Production deployment

1. Create separate Supabase projects for development and production.
2. Apply tracked migrations and storage policies; create and role-map the first administrator.
3. Configure `.env.example` in Vercel. Keep service-role, Paystack secret, and Resend keys server-only.
4. In Paystack test mode configure `https://<deployment>/api/paystack/webhook`; test bad signatures, success, retries, amount mismatch, and duplicates.
5. Verify the transactional sender identity and production URLs.
6. Import this repository into Vercel and deploy only after all quality gates pass.
7. Smoke-test storefront, auth, ownership, checkout, payments, inventory, admin permissions, mobile UI, accessibility, and logs.
8. Add the domain in Vercel, set its DNS records, and update app URL, Paystack URLs, Supabase redirects, email links, and canonicals.

Previews must use test Paystack credentials and non-production Supabase data.
