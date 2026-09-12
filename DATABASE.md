# Database and Supabase

Run every file in `supabase/migrations` through the Supabase CLI; never paste untracked production SQL. If a migration is ever applied directly against a project (Supabase dashboard, MCP `apply_migration`, `execute_sql`), write the exact SQL back into a matching-timestamped file in `supabase/migrations` in the same session — `supabase_migrations.schema_migrations` on the server is the source of truth for what's "already applied," and the repo drifting from it silently is how `secure_admin_workflows` and the RPCs below ended up undocumented until 2026-09-12.

The initial migration creates normalized product, variant, inventory, customer, order, payment, review, RBAC, and audit entities plus initial RLS. `secure_admin_workflows` (2026-09-12) replaced that first-pass RLS with explicit least-privilege grants on every table, added the AAL2 requirement described in SECURITY.md, seeded `role_permissions` for all six roles (the initial migration created the roles and permissions but never mapped one to the other — `has_permission` was unconditionally false until this landed), added `site_content` for admin-managed pages, and added the `adjust_stock` / `transition_order` / `assign_staff` RPCs. `admin_workspace_support` and `admin_product_detail_rpc` (also 2026-09-12) added `admin_products` / `admin_product` / `admin_order` / `set_order_note` / `my_permissions` and a staff read policy on `addresses`.

Create private storage buckets `products`, `categories`, `brands`, `content`, and `avatars`. Permit public reads only for published commerce media and require `products.manage` for writes. Validate MIME type, extension, and size before upload and randomize object names (the `products` bucket upload path in the admin UI does this). SVG is intentionally not an allowed MIME type on any bucket — it can carry active content.

After the owner creates the first auth user, assign `Super Admin` directly via SQL using that exact UUID — `assign_staff()` requires `staff.manage` to call at all, so it cannot bootstrap the first admin:

```sql
insert into public.user_roles (user_id, role_id)
select '<user-uuid>', id from public.roles where name = 'Super Admin';
```

That first Super Admin then needs to enrol an authenticator app at `/admin` before any admin action will work (AAL2 requirement — see SECURITY.md). Do not seed credentials. Test RLS against anonymous, customer A, customer B, staff, and service-role clients before launch.
