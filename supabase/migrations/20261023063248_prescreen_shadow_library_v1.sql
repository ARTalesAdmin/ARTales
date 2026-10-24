-- ARTales isolated shadow-library v1. Source-only migration; NOT applied by creating this file.
-- Dependencies: existing public.profiles and public.works + public.authors. No work_candidates dependency.
begin;
create table public.prescreen_shadow_policy(
  id smallint primary key check(id=1),
  form_weights jsonb not null,
  theme_weights jsonb not null,
  revision integer not null default 1 check(revision>0),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.prescreen_shadow_policy(id,form_weights,theme_weights) values(
  1,
  '{"prose":45,"poetry":15,"drama":10,"fairy_tale":15,"essay":10,"other":5}',
  '{"horror":12,"romance":12,"detective":12,"science_fiction":10,"fantasy":10,"adventure":16,"humor":8,"historical":8,"mystery":7,"social":5}'
);
create table public.prescreen_shadow_titles(
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'openlibrary' check(provider='openlibrary'),
  source_work_key text not null unique check(length(source_work_key) between 8 and 120),
  identity_key text not null check(length(identity_key) between 3 and 700),
  title text not null check(length(title) between 1 and 300),
  author text not null check(length(author) between 1 and 200),
  author_key text,
  source_url text,
  form text not null check(form in ('prose','poetry','drama','fairy_tale','essay','other')),
  themes jsonb not null default '[]'::jsonb check(jsonb_typeof(themes)='array'),
  primary_theme text null check(primary_theme in ('horror','romance','detective','science_fiction','fantasy','adventure','humor','historical','mystery','social')),
  first_published integer,
  author_born integer,
  author_died integer,
  author_count integer not null default 1 check(author_count>=1),
  state text not null check(state in ('suggested','deferred','review','duplicate')),
  reason text not null,
  standard_term_end_year integer,
  reconsider_year integer,
  last_assessed_year integer not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_run_id uuid null,
  constraint prescreen_shadow_dates check(
    (author_born is null or author_born between 1000 and 2100)
    and (author_died is null or author_died between 1000 and 2100)
    and (first_published is null or first_published between 1000 and 2100)
  )
);
create index prescreen_shadow_titles_identity_idx on public.prescreen_shadow_titles(identity_key);
create index prescreen_shadow_titles_reconsider_idx on public.prescreen_shadow_titles(reconsider_year) where reconsider_year is not null;
create table public.prescreen_shadow_runs(
  id uuid primary key default gen_random_uuid(),
  requested integer not null check(requested between 1 and 12),
  status text not null default 'collecting' check(status in ('collecting','complete','incomplete')),
  started_by uuid not null references public.profiles(id),
  policy_revision integer not null,
  planned_queries jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create table public.prescreen_shadow_assessments(
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.prescreen_shadow_titles(id) on delete cascade,
  run_id uuid references public.prescreen_shadow_runs(id),
  outcome text not null check(outcome in ('suggested','deferred','review','duplicate')),
  reason text not null,
  assessed_year integer not null,
  evidence jsonb not null default '{}'::jsonb,
  assessed_at timestamptz not null default now()
);
create index prescreen_shadow_assessments_title_idx on public.prescreen_shadow_assessments(title_id,assessed_at desc);
create table public.prescreen_shadow_cursors(
  query_key text primary key check(length(query_key) between 3 and 160),
  next_offset integer not null default 0 check(next_offset>=0),
  updated_at timestamptz not null default now()
);
create table public.prescreen_shadow_handoffs(
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null unique references public.prescreen_shadow_titles(id) on delete cascade,
  state text not null default 'queued' check(state in ('queued','withdrawn','transferred')),
  selected_by uuid not null references public.profiles(id),
  selected_at timestamptz not null default now(),
  transferred_candidate_id uuid null,
  transferred_at timestamptz null
);
-- No automatic candidate creation and no dependency on candidate schema.
alter table public.prescreen_shadow_titles add constraint prescreen_shadow_title_run_fk
 foreign key(last_run_id) references public.prescreen_shadow_runs(id);
-- Full admin-only row access, bounded to existing active profile role.
alter table public.prescreen_shadow_policy enable row level security;
alter table public.prescreen_shadow_titles enable row level security;
alter table public.prescreen_shadow_runs enable row level security;
alter table public.prescreen_shadow_assessments enable row level security;
alter table public.prescreen_shadow_cursors enable row level security;
alter table public.prescreen_shadow_handoffs enable row level security;
revoke all on public.prescreen_shadow_policy,public.prescreen_shadow_titles,
 public.prescreen_shadow_runs,public.prescreen_shadow_assessments,
 public.prescreen_shadow_cursors,public.prescreen_shadow_handoffs from public,anon,authenticated;
grant select,update on public.prescreen_shadow_policy to authenticated;
grant select,insert,update on public.prescreen_shadow_titles,public.prescreen_shadow_runs,
 public.prescreen_shadow_cursors,public.prescreen_shadow_handoffs to authenticated;
grant select,insert on public.prescreen_shadow_assessments to authenticated;
do $$
declare tbl text;
begin
 foreach tbl in array array['prescreen_shadow_policy','prescreen_shadow_titles','prescreen_shadow_runs',
  'prescreen_shadow_assessments','prescreen_shadow_cursors','prescreen_shadow_handoffs'] loop
  execute format('create policy %I on public.%I for all to authenticated using
    (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role=''admin'' and p.is_active))
    with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role=''admin'' and p.is_active))',
    tbl||'_admin_all',tbl);
 end loop;
end $$;
commit;
