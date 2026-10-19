-- Prescreen genre control layer. Preview SQL, not applied to production.
-- Apply only after the canonical candidate foundation and required preflight.
begin;

create table if not exists public.prescreen_genre_policy (
  id smallint primary key default 1 check (id = 1),
  weights jsonb not null default '{"prose":25,"poetry":20,"drama":15,"fairy_tale":20,"essay":15,"other":5}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint prescreen_genre_weights_complete check (
    jsonb_typeof(weights) = 'object'
    and weights ?& array['prose','poetry','drama','fairy_tale','essay','other']
    and (weights->>'prose')::integer between 0 and 100
    and (weights->>'poetry')::integer between 0 and 100
    and (weights->>'drama')::integer between 0 and 100
    and (weights->>'fairy_tale')::integer between 0 and 100
    and (weights->>'essay')::integer between 0 and 100
    and (weights->>'other')::integer between 0 and 100
    and (weights->>'prose')::integer + (weights->>'poetry')::integer +
        (weights->>'drama')::integer + (weights->>'fairy_tale')::integer +
        (weights->>'essay')::integer + (weights->>'other')::integer = 100
  )
);
insert into public.prescreen_genre_policy(id) values (1) on conflict (id) do nothing;

create table if not exists public.prescreen_work_genres (
  work_id uuid primary key references public.works(id) on delete cascade,
  genre text not null check (genre in ('prose','poetry','drama','fairy_tale','essay','other')),
  basis text not null default 'admin_review' check (basis in ('admin_review','catalog_confirmed')),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.work_candidates
  add column if not exists prescreen_genre text null
  check (prescreen_genre is null or prescreen_genre in
         ('prose','poetry','drama','fairy_tale','essay','other'));

alter table public.prescreen_genre_policy enable row level security;
alter table public.prescreen_work_genres enable row level security;

revoke all on public.prescreen_genre_policy from public,anon;
revoke all on public.prescreen_work_genres from public,anon;
grant select,update on public.prescreen_genre_policy to authenticated;
grant select,insert,update on public.prescreen_work_genres to authenticated;

create policy prescreen_policy_admin_read on public.prescreen_genre_policy
 for select to authenticated
 using (exists (select 1 from public.profiles p
     where p.id = (select auth.uid()) and p.is_active and p.role='admin'));
create policy prescreen_policy_admin_update on public.prescreen_genre_policy
 for update to authenticated
 using (exists (select 1 from public.profiles p
     where p.id = (select auth.uid()) and p.is_active and p.role='admin'))
 with check (updated_by = (select auth.uid()) and exists (
     select 1 from public.profiles p
     where p.id = (select auth.uid()) and p.is_active and p.role='admin'));
create policy prescreen_work_genres_admin_select on public.prescreen_work_genres
 for select to authenticated
 using (exists (select 1 from public.profiles p
     where p.id = (select auth.uid()) and p.is_active and p.role='admin'));
create policy prescreen_work_genres_admin_insert on public.prescreen_work_genres
 for insert to authenticated
 with check (updated_by = (select auth.uid()) and exists (
     select 1 from public.profiles p
     where p.id = (select auth.uid()) and p.is_active and p.role='admin'));
create policy prescreen_work_genres_admin_update on public.prescreen_work_genres
 for update to authenticated
 using (exists (select 1 from public.profiles p
     where p.id = (select auth.uid()) and p.is_active and p.role='admin'))
 with check (updated_by = (select auth.uid()) and exists (
     select 1 from public.profiles p
     where p.id = (select auth.uid()) and p.is_active and p.role='admin'));

commit;
