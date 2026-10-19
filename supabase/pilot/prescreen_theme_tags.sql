-- Additional thematic genre tags for ARTales prescreen.
-- Separate from mutually-exclusive literary form; not a live migration.
begin;
create table if not exists public.prescreen_theme_policy(
 id integer primary key default 1 check(id=1),
 weights jsonb not null default '{"horror":12,"romance":12,"detective":12,"science_fiction":10,"fantasy":10,"adventure":16,"humor":8,"historical":8,"mystery":7,"social":5}'::jsonb,
 revision integer not null default 1,
 updated_by uuid references public.profiles(id),
 updated_at timestamptz not null default now()
);
insert into public.prescreen_theme_policy(id) values (1) on conflict(id) do nothing;
create table if not exists public.prescreen_work_themes(
 work_id uuid not null references public.works(id) on delete cascade,
 theme text not null check(theme in ('horror','romance','detective','science_fiction','fantasy','adventure','humor','historical','mystery','social')),
 updated_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now(),
 primary key(work_id,theme)
);
create table if not exists public.prescreen_candidate_themes(
 candidate_id uuid not null references public.work_candidates(id) on delete cascade,
 theme text not null check(theme in ('horror','romance','detective','science_fiction','fantasy','adventure','humor','historical','mystery','social')),
 updated_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now(),
 primary key(candidate_id,theme)
);
alter table public.prescreen_theme_policy enable row level security;
alter table public.prescreen_work_themes enable row level security;
alter table public.prescreen_candidate_themes enable row level security;
revoke all on public.prescreen_theme_policy, public.prescreen_work_themes, public.prescreen_candidate_themes from anon,public;
grant select,update on public.prescreen_theme_policy to authenticated;
grant select,insert,delete on public.prescreen_work_themes,public.prescreen_candidate_themes to authenticated;
create policy prescreen_theme_policy_admin_read on public.prescreen_theme_policy
for select to authenticated using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
create policy prescreen_theme_policy_admin_update on public.prescreen_theme_policy
for update to authenticated
using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active))
with check (updated_by=(select auth.uid()));
create policy prescreen_work_themes_read on public.prescreen_work_themes
for select to authenticated using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
create policy prescreen_work_themes_insert on public.prescreen_work_themes
for insert to authenticated with check (updated_by=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
create policy prescreen_work_themes_delete on public.prescreen_work_themes
for delete to authenticated using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
create policy prescreen_candidate_themes_read on public.prescreen_candidate_themes
for select to authenticated using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
create policy prescreen_candidate_themes_insert on public.prescreen_candidate_themes
for insert to authenticated with check (updated_by=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
create policy prescreen_candidate_themes_delete on public.prescreen_candidate_themes
for delete to authenticated using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
commit;
