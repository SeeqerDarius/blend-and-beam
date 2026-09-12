# Security posture

Implemented foundations: RLS on every commerce table with explicit least-privilege grants (no automatic PostgREST exposure), database-backed permissions, server-only privileged clients, integer money, separate order/payment states, immutable line snapshots, signed Paystack webhooks, unique event IDs, and non-public cost/internal-note data.

## Admin authorization model

`private.has_permission(key)` — the function every admin RLS policy and RPC checks — requires all of: the caller holds a role granting that permission (`public.role_permissions`), their email is confirmed and they are not banned, **and their session is at AAL2** (`auth.jwt()->>'aal' = 'aal2'`). In practice this means every staff member must enrol a TOTP authenticator (`/admin` prompts for this automatically) before any admin action succeeds — a password-only session can authenticate as staff but cannot read or write any privileged data. `private.staff_member()` (no AAL requirement) is used only to decide whether to show the MFA gate at all.

Sensitive fields that must never reach a customer are not in any anon/authenticated column grant (e.g. `products.cost_minor`, `orders.admin_note`, `orders.billing_address`) — the admin UI reads them through `SECURITY DEFINER` RPCs (`admin_products`, `admin_product`, `admin_order`) that re-check `has_permission` internally instead. Do not add these columns to a direct table grant; a row-visibility policy cannot scope a column grant to "staff only" when customers can also see the same row.

Privileged writes that need atomicity or a state machine — `adjust_stock`, `transition_order`, `assign_staff`, `set_order_note` — are RPCs, not direct table updates, mirroring the "server owns totals, inventory mutation, authorization" rule above. Every write to catalog, orders, inventory, discounts, content, and staff assignment tables is captured automatically by an audit trigger (`private.audit_change`) into `audit_logs` — application code does not need to log these itself.

`carts`, `cart_items`, and `payment_events` are RLS-enabled with no policies (deny-all except service-role) — intentional for now, not a bug: carts aren't yet persisted server-side (the storefront cart is still `localStorage`-only) and raw webhook payloads are kept for audit but not surfaced in the admin UI.

## Production gates still required

Atomic checkout RPC with row locking (the admin-side stock/order RPCs above do not yet cover checkout itself), rate limits, upload policies, exhaustive RLS tests, CSP, secret rotation, live webhook replay tests, refund controls, log-redaction verification, dependency remediation, and penetration testing. Until these pass, the platform is not approved for live payments.
