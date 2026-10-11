# Blend & Beam Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BLEND & BEAM PLATFORM                              │
│                  Premium Salon Equipment Commerce Platform                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND LAYER                                   │
│                         Next.js 16 App Router                                 │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   STOREFRONT  │           │   ADMIN PANEL │           │   AUTH PAGES  │
│               │           │               │           │               │
│ • Home        │           │ • Dashboard   │           │ • Login       │
│ • Shop        │           │ • Products    │           │ • MFA Setup   │
│ • Products    │           │ • Inventory   │           │ • Account     │
│ • Cart        │           │ • Orders      │           │ • Callbacks   │
│ • Checkout    │           │ • Customers   │           │               │
│ • Pages       │           │ • Staff       │           │               │
└───────────────┘           └───────────────┘           └───────────────┘
        │                             │                             │
        └─────────────────────────────┼─────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              BUSINESS LOGIC LAYER                             │
│                         src/lib/                                              │
└──────────────────────────────────────────────────────────────────────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  catalog.ts   │   │ admin-auth.ts │   │ admin-resources│
│               │   │               │   │       .ts      │
│ • Product data│   │ • Staff auth  │   │ • Admin forms  │
│ • Categories  │   │ • MFA check   │   │ • Permissions  │
│ • Money utils │   │ • Permission  │   │ • CRUD schemas│
└───────────────┘   └───────────────┘   └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            DATA ACCESS LAYER                                  │
│                         src/lib/supabase/                                     │
└──────────────────────────────────────────────────────────────────────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  server.ts    │   │  browser.ts   │   │   types.ts    │
│               │   │               │   │               │
│ • Server client│   • Browser     │   • Generated    │
│ • Cookie mgmt │   • Client       │   • TypeScript   │
│ • Auth state  │   • Auth state   │   • DB schemas   │
└───────────────┘   └───────────────┘   └───────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES LAYER                              │
└──────────────────────────────────────────────────────────────────────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   SUPABASE    │   │   PAYSTACK    │   │   RESEND      │
│               │   │               │   │   (Future)    │
│ • PostgreSQL  │   • Payments      │   • Transactional │
│ • Auth        │   • Webhooks     │   • Email         │
│ • Storage     │   • Ghana GHS    │   • Notifications │
│ • RLS         │   • Security     │   │               │
└───────────────┘   └───────────────┘   └───────────────┘
```

## Database Schema Structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE POSTGRESQL DATABASE                          │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                           CATALOG ENTITIES                                    │
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  products    │  │  categories  │  │    brands    │  │  product_    │
│              │  │              │  │              │  │  variants    │
│ • id         │  │ • id         │  │ • id         │  │ • id         │
│ • name       │  │ • name       │  │ • name       │  │ • product_id │
│ • slug       │  │ • slug       │  │ • slug       │  │ • name       │
│ • sku        │  │ • parent_id  │  │ • logo_path  │  │ • sku        │
│ • price_     │  │ • sort_order │  │ • is_active  │  │ • price_     │
│   minor      │  │ • is_active  │  └──────────────┘  │   minor      │
│ • cost_      │  └──────────────┘                    │ • options     │
│   minor      │                                       │ • status     │
│ • status     │  ┌──────────────┐  ┌──────────────┐  └──────────────┘
│ • is_        │  │  product_    │  │  product_    │
│   featured   │  │  categories │  │  images     │
│ • track_     │  │              │  │              │
│   inventory  │  │ • product_id │  │ • id         │
└──────────────┘  │ • category_id│  │ • product_id │
                  └──────────────┘  │ • path       │
                                     │ • alt_text   │
                                     │ • sort_order │
                                     └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                         INVENTORY MANAGEMENT                                  │
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────────┐  ┌──────────────────────────────────────────────────────────┐
│  inventory   │  │               inventory_movements                         │
│              │  │                                                           │
│ • id         │  │ • id                                                      │
│ • product_id │  │ • inventory_id                                            │
│ • variant_id │  │ • quantity_delta                                         │
│ • quantity   │  │ • reason                                                  │
│ • low_stock  │  │ • actor_id                                                │
│   threshold  │  │ • reference_id                                            │
└──────────────┘  │ • reference_type                                          │
                  │ • created_at                                              │
                  └──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                         ORDER MANAGEMENT                                      │
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
│    orders    │  │  order_items │  │  order_      │  │      addresses       │
│              │  │              │  │  status_     │  │                      │
│ • id         │  │ • id         │  │  history     │  │ • id                 │
│ • order_     │  │ • order_id   │  │              │  │ • user_id            │
│   number     │  │ • product_id │  │ • id         │  │ • full_name          │
│ • user_id    │  │ • variant_id │  │ • order_id   │  │ • phone              │
│ • status     │  │ • quantity   │  │ • status     │  │ • address_line       │
│ • payment_   │  │ • unit_price │  │ • actor_id   │  │ • city               │
│   status     │  │   _minor     │  │ • note       │  │ • region             │
│ • subtotal_  │  │ • total_     │  │ • created_at │  │ • ghana_post_gps     │
│   minor      │  │   _minor     │  └──────────────┘  │ • delivery_notes     │
│ • total_     │  │ • sku        │                     │ • is_default         │
│   minor      │  │ • product_   │                     └──────────────┘
│ • shipping_  │  │   _name      │
│   minor      │  │ • options    │
│ • discount_  │  └──────────────┘
│   minor      │
│ • shipping_  │
│   address    │
│ • billing_   │
│   address    │
└──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                         PAYMENT PROCESSING                                    │
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────────┐  ┌──────────────────────────────────────────────────────────┐
│   payments   │  │               payment_events                             │
│              │  │                                                           │
│ • id         │  │ • id                                                      │
│ • order_id   │  │ • provider_event_id                                       │
│ • amount_    │  │ • event_type                                              │
│   minor      │  │ • payload                                                 │
│ • currency   │  │ • processed_at                                            │
│ • provider   │  │ • error                                                   │
│ • reference  │  │ • created_at                                              │
│ • status     │  └──────────────────────────────────────────────────────────┘
│ • provider_  │
│   response   │
│ • verified_  │
│   at         │
└──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY & ADMIN                                       │
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│    roles     │  │  permissions │  │ user_roles   │  │role_         │
│              │  │              │  │              │  │permissions   │
│ • id         │  │ • id         │  │ • user_id    │  │              │
│ • name       │  │ • key       │  │ • role_id    │  │ • role_id    │
└──────────────┘  └──────────────┘  └──────────────┘  │ • permission_ │
                                                   │   id         │
┌──────────────┐  ┌──────────────┐                 └──────────────┘
│  audit_logs  │  │discount_codes│
│              │  │              │
│ • id         │  │ • id         │
│ • entity_    │  │ • code       │
│   type       │  │ • kind       │
│ • entity_id  │  │ • value      │
│ • action     │  │ • minimum_   │
│ • actor_id   │  │   minor      │
│ • metadata   │  │ • is_active  │
│ • created_at │  └──────────────┘
└──────────────┘
```

## Application Flow Diagrams

### 1. Customer Shopping Flow

```
┌──────────────┐
│   HOME PAGE  │
│  /page.tsx   │
└──────────────┘
        │
        ├──► Browse Categories ──► /shop?category=X
        │                           │
        │                           ├──► Filter Products
        │                           ├──► View Product Cards
        │                           └──► Add to Cart (localStorage)
        │
        ├──► View Product ─────────► /products/[slug]
        │                           │
        │                           ├──► Product Details
        │                           ├──► Specs & Description
        │                           └──► Add to Cart (localStorage)
        │
        └──► View Cart ────────────► /cart
                                    │
                                    ├──► Review Items
                                    ├──► Update Quantities
                                    ├──► Remove Items
                                    └──► Proceed to Checkout
                                    │
                                    ▼
                            ┌──────────────┐
                            │  CHECKOUT    │
                            │ /checkout    │
                            └──────────────┘
                                    │
                                    ├──► Delivery Form
                                    ├──► Address Validation
                                    ├──► [Payment Integration - Not Live]
                                    └──► Order Creation [Server-Side]
```

### 2. Admin Authentication Flow

```
┌──────────────┐
│  /ADMIN      │
│  Access      │
└──────────────┘
        │
        ▼
┌─────────────────────────┐
│ requireStaff() Check     │
│ (admin-auth.ts)          │
└─────────────────────────┘
        │
        ├──► Not Authenticated? ──► /login
        │
        ├──► Email Not Confirmed? ──► /login
        │
        ├──► Not Staff Member? ──► /access-denied
        │
        ├──► No MFA (AAL2)? ──► /account/security
        │                           │
        │                           ├──► Enroll TOTP
        │                           └──► Verify Code
        │
        └──► Permission Check? ──► /access-denied
                                    │
                                    ▼
                            ┌──────────────┐
                            │  ADMIN DASH  │
                            │  /admin      │
                            └──────────────┘
                                    │
                                    ├──► Products (products.manage)
                                    ├──► Inventory (inventory.manage)
                                    ├──► Orders (orders.manage)
                                    ├──► Customers (customers.read)
                                    ├──► Payments (payments.read)
                                    ├──► Staff (staff.manage)
                                    └──► Audit Logs (audit.read)
```

### 3. Payment Webhook Flow

```
┌──────────────┐
│  PAYSTACK    │
│  Webhook     │
└──────────────┘
        │
        ▼
┌─────────────────────────┐
│ POST /api/paystack/     │
│ webhook/route.ts        │
└─────────────────────────┘
        │
        ├──► Verify Signature (HMAC-SHA512)
        │
        ├──► Parse Event JSON
        │
        ├──► Record to payment_events
        │   ├──► Check Duplicate (provider_event_id)
        │   └──► Store Raw Payload
        │
        └──► If charge.success:
            │
            ├──► Update payments table
            │   ├──► status = "paid"
            │   ├──► provider_response
            │   └──► verified_at timestamp
            │
            └──► Return {received: true}
```

### 4. Admin CRUD Operations

```
┌──────────────┐
│  ADMIN       │
│  SECTION     │
│ /admin/[section]│
└──────────────┘
        │
        ▼
┌─────────────────────────┐
│ requireStaff(permission)│
│ (admin-auth.ts)          │
└─────────────────────────┘
        │
        ▼
┌─────────────────────────┐
│ Load Resource Config    │
│ (admin-resources.ts)    │
│ • Table Schema          │
│ • Field Definitions     │
│ • Zod Validation        │
│ • Permission Check      │
└─────────────────────────┘
        │
        ├──► READ: Query via Supabase Client
        │   ├──► Apply RLS Policies
        │   └──► Filter by User Context
        │
        ├──► CREATE: Zod Validate → Insert
        │   ├──► Server-Side Validation
        │   ├──► Audit Trigger Fires
        │   └──► Return Success/Error
        │
        ├──► UPDATE: Zod Validate → Update
        │   ├──► Permission Check
        │   ├──► Audit Trigger Fires
        │   └──► Return Success/Error
        │
        └──► DELETE: Permission Check → Delete
            ├──► Soft Delete Preferred
            ├──► Audit Trigger Fires
            └──► Return Success/Error
```

## Security Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          SECURITY LAYERS                                      │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: SUPABASE RLS (Row Level Security)                                    │
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────────┐
│ • Every table has explicit RLS policies                                       │
│ • Anonymous users: Read-only on public catalog data                           │
│ • Authenticated users: Read own orders, addresses                             │
│ • Staff: Read/write based on role_permissions                                 │
│ • Service role: Full access (server-side only)                                │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 2: AUTHENTICATION & AUTHORIZATION                                        │
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────────┐
│ • Supabase Auth (JWT-based)                                                   │
│ • Email confirmation required                                                │
│ • MFA (AAL2) required for admin actions                                        │
│ • Role-based access control (RBAC)                                            │
│ • Permission keys (e.g., "products.manage", "orders.view")                     │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 3: SERVER-SIDE VALIDATION                                                │
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────────┐
│ • Zod schemas for all admin inputs                                            │
│ • Server-owned totals, inventory, pricing                                     │
│ • Immutable order snapshots                                                   │
│ • Integer minor units for money (GHS × 100)                                   │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 4: WEBHOOK SECURITY                                                      │
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────────┐
│ • HMAC-SHA512 signature verification                                          │
│ • Timing-safe comparison                                                      │
│ • Duplicate event detection (provider_event_id)                               │
│ • Secret key never exposed to client                                         │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 5: AUDIT & LOGGING                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────────┐
│ • Automatic audit triggers on privileged tables                               │
│ • Actor tracking (user_id)                                                    │
│ • Entity and action logging                                                    │
│ • Metadata storage for context                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

## File Structure Map

```
blend-and-beam/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (fonts, metadata)
│   │   ├── page.tsx                  # Homepage
│   │   ├── globals.css              # Global styles
│   │   │
│   │   ├── shop/                     # Storefront
│   │   │   └── page.tsx              # Product listing
│   │   │
│   │   ├── products/[slug]/          # Product details
│   │   │   └── page.tsx
│   │   │
│   │   ├── cart/                     # Shopping cart
│   │   │   └── page.tsx              # localStorage-based
│   │   │
│   │   ├── checkout/                 # Checkout flow
│   │   │   └── page.tsx              # [Not fully connected]
│   │   │
│   │   ├── admin/                    # Admin panel
│   │   │   ├── layout.tsx            # Admin layout
│   │   │   ├── page.tsx              # Dashboard
│   │   │   ├── [section]/            # CRUD sections
│   │   │   │   └── page.tsx
│   │   │   └── actions.ts            # Server actions
│   │   │
│   │   ├── login/                    # Authentication
│   │   │   ├── page.tsx              # Login form
│   │   │   └── actions.ts            # Auth actions
│   │   │
│   │   ├── auth/callback/           # Supabase callback
│   │   │   └── route.ts
│   │   │
│   │   ├── account/                  # User account
│   │   │   ├── page.tsx              # Account overview
│   │   │   └── security/            # MFA setup
│   │   │       └── page.tsx
│   │   │
│   │   ├── api/                      # API routes
│   │   │   └── paystack/
│   │   │       └── webhook/
│   │   │           └── route.ts      # Payment webhooks
│   │   │
│   │   ├── about/                    # Info pages
│   │   ├── contact/
│   │   ├── faq/
│   │   ├── policies/[slug]/
│   │   └── bulk-orders/
│   │
│   ├── components/                    # Reusable UI
│   │   ├── store-header.tsx          # Store navigation
│   │   ├── product-card.tsx          # Product display
│   │   ├── add-to-cart.tsx           # Cart button
│   │   ├── brand-logo.tsx            # Logo component
│   │   ├── mfa-form.tsx              # MFA setup form
│   │   └── submit-button.tsx         # Form button
│   │
│   ├── lib/                          # Business logic
│   │   ├── catalog.ts                # Product data (dev only)
│   │   ├── admin-auth.ts             # Staff auth helpers
│   │   ├── admin-resources.ts        # Admin CRUD config
│   │   ├── auth-validation.ts        # Auth utilities
│   │   └── supabase/                 # Supabase clients
│   │       ├── server.ts             # Server client
│   │       ├── browser.ts           # Browser client
│   │       ├── proxy.ts              # Proxy client
│   │       └── types.ts              # Generated types
│   │
│   └── proxy.ts                      # API proxy
│
├── supabase/
│   └── migrations/                   # Database migrations
│       ├── 202609110001_initial_commerce.sql
│       ├── 20260911132101_harden_rls_and_storage.sql
│       ├── 20260911132628_restrict_auto_rls_trigger.sql
│       ├── 20260912170800_secure_admin_workflows.sql
│       ├── 20260912174426_admin_workspace_support.sql
│       └── 20260912175127_admin_product_detail_rpc.sql
│
├── public/                           # Static assets
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript config
├── next.config.ts                    # Next.js config
├── tailwind.config.*                 # Tailwind CSS
├── .env.example                      # Environment template
├── ARCHITECTURE.md                   # Architecture docs
├── DATABASE.md                       # Database docs
├── SECURITY.md                       # Security docs
├── DEPLOYMENT.md                     # Deployment guide
└── README.md                         # Project overview
```

## Key Design Patterns

### 1. Server Components for Read-Heavy Pages
- Homepage, shop, product pages use Server Components
- Data fetched server-side for performance
- SEO benefits with static generation

### 2. Client Components for Interactive UI
- Cart uses localStorage (client-side state)
- MFA form requires interactivity
- Admin forms use React state

### 3. Security-First Data Access
- All privileged data accessed via RPC functions
- Column-level security for sensitive fields
- Service role only on server-side

### 4. Immutable Order Snapshots
- Order items capture price at time of purchase
- Product price changes don't affect historical orders
- Audit trail for all changes

### 5. Permission-Based Access Control
- Fine-grained permissions (not just roles)
- Database-enforced via RLS and RPCs
- Runtime checks in application code

## Integration Points

### Currently Connected
- ✅ Supabase Auth (email/password, MFA)
- ✅ Supabase PostgreSQL (database)
- ✅ Supabase Storage (file buckets)
- ✅ Paystack Webhook (payment events)

### Planned/Not Yet Connected
- 🔄 Paystack Checkout (frontend integration)
- 🔄 Server-side cart persistence
- 🔄 Atomic checkout transaction
- 🔄 Resend Email (transactional emails)
- 🔄 Inventory reservation during checkout

## Development Workflow

```
1. Database Changes
   └─► Write migration in supabase/migrations/
   └─► Run: supabase db push
   └─► Regenerate types: Supabase CLI
   └─► Update src/lib/supabase/types.ts

2. Admin Features
   └─► Add resource to admin-resources.ts
   └─► Define fields, schema, permissions
   └─► Permission in database migration
   └─► Test with different staff roles

3. Storefront Changes
   └─► Update catalog.ts (dev data)
   └─► Or connect to database products
   └─► Update components as needed

4. Quality Gates
   └─► npm run typecheck
   └─► npm run lint
   └─► npm test
   └─► npm run build
```

## Technology Stack Summary

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth (MFA/AAL2)
- **Storage**: Supabase Storage
- **Payments**: Paystack (Ghana)
- **Validation**: Zod
- **Testing**: Vitest + Testing Library
- **Deployment**: Vercel (recommended)

## Key Architectural Decisions

1. **Integer Money**: All amounts in minor units (GHS × 100) to avoid floating-point errors
2. **Server-Side Authority**: Server owns totals, inventory, pricing validation
3. **Separate Order/Payment States**: Orders can exist without successful payments
4. **RLS as Final Boundary**: Database-level security is the ultimate access control
5. **AAL2 for Admin**: MFA required for all administrative actions
6. **Audit by Default**: All privileged writes automatically logged
7. **Provider Boundaries**: External services isolated behind abstraction layers
