-- ARTales v0.9.0 – Entitlements / Library / Membership foundation
-- This migration creates the logical access layer before real payments are connected.

create table if not exists public.membership_plans (
  code text primary key,
  name text not null,
  description text not null default '',
  intro_price_eur numeric(8,2) not null default 0,
  future_price_eur numeric(8,2) not null default 0,
  intro_unlock_note text not null default '',
  monthly_online_unlocks integer not null default 0,
  monthly_at_credits integer not null default 0,
  unlimited_online_reading boolean not null default false,
  is_promotional boolean not null default false,
  display_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reader_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_id uuid references public.works(id) on delete cascade,
  entitlement_type text not null check (entitlement_type in ('online_read', 'pdf_download', 'epub_download', 'print_discount', 'membership_access')),
  source text not null check (source in ('welcome_unlock', 'manual_grant', 'subscription_monthly', 'credit_spend', 'purchase', 'admin_adjustment', 'promo')),
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  granted_by_user_id uuid references public.profiles(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reader_entitlements_work_required_for_products check (
    entitlement_type = 'membership_access' or work_id is not null
  )
);

create table if not exists public.reader_library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  item_type text not null check (item_type in ('saved', 'recent', 'unlocked', 'download')),
  source text not null default 'system',
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_id, item_type)
);

create table if not exists public.reader_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credit_type text not null default 'at_credit',
  amount integer not null,
  source text not null check (source in ('subscription_monthly', 'purchase', 'bonus', 'contribution', 'admin_adjustment', 'credit_spend', 'promo')),
  related_work_id uuid references public.works(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reader_entitlements_user_idx on public.reader_entitlements(user_id);
create index if not exists reader_entitlements_work_idx on public.reader_entitlements(work_id);
create index if not exists reader_entitlements_active_idx on public.reader_entitlements(user_id, entitlement_type, is_active);
create unique index if not exists reader_entitlements_active_unique_work_access_idx
  on public.reader_entitlements(user_id, work_id, entitlement_type)
  where is_active = true and work_id is not null;

create index if not exists reader_library_items_user_idx on public.reader_library_items(user_id);
create index if not exists reader_library_items_work_idx on public.reader_library_items(work_id);
create index if not exists reader_credit_ledger_user_idx on public.reader_credit_ledger(user_id);

alter table public.membership_plans enable row level security;
alter table public.reader_entitlements enable row level security;
alter table public.reader_library_items enable row level security;
alter table public.reader_credit_ledger enable row level security;

-- Membership plans are public read-only catalogue data.
drop policy if exists "membership plans are readable" on public.membership_plans;
create policy "membership plans are readable"
  on public.membership_plans for select
  using (is_active = true);

-- Users can read their own access/library/credit records. Inserts/updates stay server-side/admin for now.
drop policy if exists "users can read own entitlements" on public.reader_entitlements;
create policy "users can read own entitlements"
  on public.reader_entitlements for select
  using (auth.uid() = user_id);

drop policy if exists "users can read own library items" on public.reader_library_items;
create policy "users can read own library items"
  on public.reader_library_items for select
  using (auth.uid() = user_id);

drop policy if exists "users can read own credit ledger" on public.reader_credit_ledger;
create policy "users can read own credit ledger"
  on public.reader_credit_ledger for select
  using (auth.uid() = user_id);

insert into public.membership_plans (
  code,
  name,
  description,
  intro_price_eur,
  future_price_eur,
  intro_unlock_note,
  monthly_online_unlocks,
  monthly_at_credits,
  unlimited_online_reading,
  is_promotional,
  display_order,
  is_active
)
values
  ('free_reader', 'Free Reader', 'Registered reader account with profile-backed reader tools and one future welcome online unlock.', 0, 0, 'Free reader account. Welcome unlock will be connected in the entitlement layer.', 0, 0, false, false, 0, true),
  ('basic', 'Basic', 'Entry membership with monthly permanent online unlocks and member prices.', 1, 2, 'Intro price for the first 3 months or first 100 readers.', 2, 0, false, true, 10, true),
  ('plus', 'Plus', 'Best-value membership with more monthly online unlocks and AT Credits.', 2, 4, 'Intro price for the first 3 months or first 100 readers.', 5, 1, false, true, 20, true),
  ('library', 'Library', 'Full online reading while active, plus AT Credits and best member prices.', 4, 7, 'Intro price for the first 3 months or first 100 readers.', 0, 2, true, true, 30, true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  intro_price_eur = excluded.intro_price_eur,
  future_price_eur = excluded.future_price_eur,
  intro_unlock_note = excluded.intro_unlock_note,
  monthly_online_unlocks = excluded.monthly_online_unlocks,
  monthly_at_credits = excluded.monthly_at_credits,
  unlimited_online_reading = excluded.unlimited_online_reading,
  is_promotional = excluded.is_promotional,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();
