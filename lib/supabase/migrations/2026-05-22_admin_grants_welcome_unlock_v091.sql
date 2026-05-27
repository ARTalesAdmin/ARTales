-- ARTales v0.9.1 – Admin grants & welcome unlock
-- Manual access grants stay admin-only. Editors can create recommendations for admin review.

create table if not exists public.reader_entitlement_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by_user_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  request_type text not null default 'online_read_manual_grant' check (request_type in ('online_read_manual_grant')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  note text,
  admin_note text,
  reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reader_entitlement_requests_status_idx
  on public.reader_entitlement_requests(status, created_at desc);

create index if not exists reader_entitlement_requests_target_user_idx
  on public.reader_entitlement_requests(target_user_id);

create index if not exists reader_entitlement_requests_work_idx
  on public.reader_entitlement_requests(work_id);

alter table public.reader_entitlement_requests enable row level security;

-- Internal users can read their own recommendations; admins will access through service-role actions.
drop policy if exists "requesters can read own entitlement requests" on public.reader_entitlement_requests;
create policy "requesters can read own entitlement requests"
  on public.reader_entitlement_requests for select
  using (auth.uid() = requested_by_user_id);

-- No direct client-side inserts/updates. All writes go through server actions.
