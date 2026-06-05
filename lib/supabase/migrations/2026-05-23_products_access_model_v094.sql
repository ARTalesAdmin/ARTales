-- ARTales v0.9.4 – Products & Access Model foundation
-- Products describe what can be unlocked/bought. Entitlements describe what a user already has.
-- Checkout/orders are intentionally not enabled in this migration.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  work_id uuid references public.works(id) on delete cascade,
  product_type text not null check (product_type in ('online_unlock', 'pdf_download', 'epub_download', 'pdf_epub_bundle', 'print')),
  title text not null,
  description text not null default '',
  entitlement_type text check (entitlement_type in ('online_read', 'pdf_download', 'epub_download', 'print_discount')),
  availability text not null default 'coming_soon' check (availability in ('available', 'coming_soon', 'internal_only')),
  checkout_enabled boolean not null default false,
  fulfillment_ready boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_unique_work_type unique (work_id, product_type),
  constraint products_work_required_for_work_products check (work_id is not null)
);

create table if not exists public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  price_context text not null default 'standard' check (price_context in ('standard', 'reader', 'basic', 'plus', 'library', 'launch')),
  membership_code text references public.membership_plans(code) on delete set null,
  currency text not null default 'EUR',
  amount_cents integer not null check (amount_cents >= 0),
  label text not null default 'Standard',
  is_intro boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 100,
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_prices_unique_context unique (product_id, price_context, currency)
);

create index if not exists products_work_idx on public.products(work_id);
create index if not exists products_type_idx on public.products(product_type, is_active);
create index if not exists product_prices_product_idx on public.product_prices(product_id);
create index if not exists product_prices_context_idx on public.product_prices(price_context, is_active);

alter table public.products enable row level security;
alter table public.product_prices enable row level security;

-- Public catalogue data. Purchases/orders are not implemented yet.
drop policy if exists "active products are readable" on public.products;
create policy "active products are readable"
  on public.products for select
  using (is_active = true);

drop policy if exists "active product prices are readable" on public.product_prices;
create policy "active product prices are readable"
  on public.product_prices for select
  using (is_active = true);

-- Seed default product catalogue for existing works.
-- Online checkout remains disabled until payment/order layers are added.
insert into public.products (
  work_id,
  product_type,
  title,
  description,
  entitlement_type,
  availability,
  checkout_enabled,
  fulfillment_ready,
  is_active,
  display_order
)
select
  w.id,
  product_seed.product_type,
  product_seed.title,
  product_seed.description,
  product_seed.entitlement_type,
  product_seed.availability,
  false,
  product_seed.fulfillment_ready,
  true,
  product_seed.display_order
from public.works w
cross join (
  values
    ('online_unlock', 'Online unlock', 'Permanent online reading access in the reader library.', 'online_read', 'coming_soon', false, 10),
    ('pdf_download', 'PDF edition', 'Downloadable PDF edition. Delivery is coming after PDF export is ready.', 'pdf_download', 'coming_soon', false, 20),
    ('epub_download', 'EPUB edition', 'Downloadable EPUB edition for e-readers. Coming after export tooling is ready.', 'epub_download', 'coming_soon', false, 30),
    ('pdf_epub_bundle', 'PDF + EPUB bundle', 'Combined digital edition package.', null, 'coming_soon', false, 40),
    ('print', 'Print edition', 'Printed edition placeholder. Price will vary by title.', 'print_discount', 'coming_soon', false, 50)
) as product_seed(product_type, title, description, entitlement_type, availability, fulfillment_ready, display_order)
where w.status = 'published'
on conflict (work_id, product_type) do update set
  title = excluded.title,
  description = excluded.description,
  entitlement_type = excluded.entitlement_type,
  availability = excluded.availability,
  checkout_enabled = false,
  fulfillment_ready = excluded.fulfillment_ready,
  is_active = true,
  display_order = excluded.display_order,
  updated_at = now();

-- Seed default prices for digital products.
insert into public.product_prices (
  product_id,
  price_context,
  currency,
  amount_cents,
  label,
  is_intro,
  is_active,
  display_order
)
select
  p.id,
  'standard',
  'EUR',
  case p.product_type
    when 'online_unlock' then 100
    when 'pdf_download' then 200
    when 'epub_download' then 200
    when 'pdf_epub_bundle' then 300
    else 0
  end,
  case p.product_type
    when 'online_unlock' then 'Standard online unlock'
    when 'pdf_download' then 'Standard PDF price'
    when 'epub_download' then 'Standard EPUB price'
    when 'pdf_epub_bundle' then 'Digital bundle price'
    else 'Price not set'
  end,
  false,
  p.product_type <> 'print',
  10
from public.products p
where p.product_type in ('online_unlock', 'pdf_download', 'epub_download', 'pdf_epub_bundle', 'print')
on conflict (product_id, price_context, currency) do update set
  amount_cents = excluded.amount_cents,
  label = excluded.label,
  is_intro = excluded.is_intro,
  is_active = excluded.is_active,
  display_order = excluded.display_order,
  updated_at = now();
