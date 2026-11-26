-- Synthetic disposable database only. Historical function bodies are loaded
-- from their original repository files, never from production data.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
create table public.profiles (id uuid primary key);
create table public.works (id uuid primary key);
create table public.membership_plans (
  code text primary key, name text not null, description text not null default '',
  intro_price_eur numeric not null default 0, future_price_eur numeric not null default 0,
  intro_unlock_note text not null default '', monthly_online_unlocks integer not null default 0,
  monthly_at_credits integer not null default 0, unlimited_online_reading boolean not null default false,
  is_promotional boolean not null default false, display_order integer not null default 100,
  is_active boolean not null default true, updated_at timestamptz not null default now()
);
create table public.reader_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id), credit_type text not null default 'at_credit',
  amount integer not null, source text not null, related_work_id uuid references public.works(id),
  note text, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.reader_member_unlock_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id), amount integer not null, source text not null,
  related_work_id uuid references public.works(id), note text, metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.reader_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id), work_id uuid references public.works(id),
  entitlement_type text not null, source text not null, is_active boolean not null default true,
  starts_at timestamptz not null default now(), expires_at timestamptz,
  granted_by_user_id uuid references public.profiles(id), note text,
  metadata jsonb not null default '{}', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (entitlement_type = 'membership_access' or work_id is not null)
);
alter table public.reader_credit_ledger enable row level security;
alter table public.reader_member_unlock_ledger enable row level security;
alter table public.reader_entitlements enable row level security;
grant all on all tables in schema public to service_role;
\ir ../../lib/supabase/migrations/2026-07-06_member_unlock_spend_v01013h.sql
\ir ../../lib/supabase/migrations/2026-07-06_membership_at_wallet_cleanup_v01013j.sql
-- Model explicit platform grants as well as PostgreSQL's default PUBLIC grant.
grant execute on function public.activate_reader_membership_with_credits(uuid,text,integer,integer,integer,boolean) to anon, authenticated, service_role;
grant execute on function public.use_at_credit_online_unlock(uuid,uuid) to anon, authenticated, service_role;
grant execute on function public.use_member_online_unlock(uuid,uuid) to anon, authenticated, service_role;
insert into public.profiles values ('11111111-1111-4111-8111-111111111111');
insert into public.works values ('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');
insert into public.reader_credit_ledger(user_id,amount,source) values ('11111111-1111-4111-8111-111111111111',3,'purchase');

do $$
declare f regprocedure;
begin
  foreach f in array array[
    'public.activate_reader_membership_with_credits(uuid,text,integer,integer,integer,boolean)'::regprocedure,
    'public.use_at_credit_online_unlock(uuid,uuid)'::regprocedure,
    'public.use_member_online_unlock(uuid,uuid)'::regprocedure
  ] loop
    if not has_function_privilege('anon',f,'EXECUTE') or not has_function_privilege('authenticated',f,'EXECUTE') then
      raise exception 'Fixture does not reproduce original privileges';
    end if;
  end loop;
end;
$$;
