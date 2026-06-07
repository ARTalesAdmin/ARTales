-- ARTales v0.9.6 – Purchase / Orders foundation + admin metrics
-- This migration prepares the accounting layer before real payment provider integration.
-- It does not enable paid checkout yet.

create table if not exists public.purchase_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  work_id uuid references public.works(id) on delete set null,
  status text not null default 'captured' check (status in ('captured', 'converted', 'cancelled', 'abandoned')),
  source_context text not null default 'checkout_coming_soon',
  user_role text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'pending_payment', 'paid', 'failed', 'cancelled', 'refunded', 'fulfilled')),
  payment_status text not null default 'not_started' check (payment_status in ('not_started', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  currency text not null default 'EUR',
  subtotal_amount_cents integer not null default 0 check (subtotal_amount_cents >= 0),
  discount_amount_cents integer not null default 0 check (discount_amount_cents >= 0),
  total_amount_cents integer not null default 0 check (total_amount_cents >= 0),
  provider text,
  provider_session_id text,
  provider_payment_id text,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  work_id uuid references public.works(id) on delete set null,
  product_type text not null check (product_type in ('online_unlock', 'pdf_download', 'epub_download', 'pdf_epub_bundle', 'print', 'membership')),
  title text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_amount_cents integer not null default 0 check (unit_amount_cents >= 0),
  total_amount_cents integer not null default 0 check (total_amount_cents >= 0),
  currency text not null default 'EUR',
  entitlement_type text check (entitlement_type in ('online_read', 'pdf_download', 'epub_download', 'print_discount', 'membership_access')),
  fulfillment_status text not null default 'not_ready' check (fulfillment_status in ('not_ready', 'pending', 'fulfilled', 'failed', 'manual_required')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  user_id uuid references public.profiles(id) on delete set null,
  path text not null,
  referrer text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists purchase_intents_user_idx on public.purchase_intents(user_id, created_at desc);
create index if not exists purchase_intents_product_idx on public.purchase_intents(product_id, created_at desc);
create index if not exists purchase_intents_work_idx on public.purchase_intents(work_id, created_at desc);
create index if not exists purchase_intents_status_idx on public.purchase_intents(status, created_at desc);

create index if not exists orders_user_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_idx on public.orders(status, created_at desc);
create index if not exists orders_paid_at_idx on public.orders(paid_at desc);

create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_product_type_idx on public.order_items(product_type, created_at desc);
create index if not exists order_items_work_idx on public.order_items(work_id, created_at desc);

create index if not exists page_views_created_idx on public.page_views(created_at desc);
create index if not exists page_views_path_idx on public.page_views(path, created_at desc);
create index if not exists page_views_user_idx on public.page_views(user_id, created_at desc);

alter table public.purchase_intents enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.page_views enable row level security;

-- Access is intentionally service-role/admin-only for now. User-facing order history
-- will get explicit RLS policies later when real checkout is connected.

drop policy if exists "users can read own purchase intents" on public.purchase_intents;
create policy "users can read own purchase intents"
  on public.purchase_intents for select
  using (auth.uid() = user_id);

drop policy if exists "users can read own orders" on public.orders;
create policy "users can read own orders"
  on public.orders for select
  using (auth.uid() = user_id);

drop policy if exists "users can read own order items" on public.order_items;
create policy "users can read own order items"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
    )
  );
