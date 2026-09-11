# Database and Supabase

Run every file in `supabase/migrations` through the Supabase CLI; never paste untracked production SQL. The initial migration creates normalized product, variant, inventory, customer, order, payment, review, RBAC, and audit entities plus initial RLS.

Create private storage buckets `products`, `categories`, `brands`, `content`, and `avatars`. Permit public reads only for published commerce media and require `products.manage` for writes. Validate MIME type, extension, and size before upload and randomize object names.

After the owner creates the first auth user, assign `Super Admin` using that exact UUID. Do not seed credentials. Test RLS against anonymous, customer A, customer B, staff, and service-role clients before launch.
