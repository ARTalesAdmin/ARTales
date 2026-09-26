-- ARTales P1-1A — lightweight work candidates foundation.
-- Candidates exist before accepted works and are visible only to active editors/admins.

create table if not exists public.work_candidates (
  id uuid primary key default gen_random_uuid(),
  proposed_title text not null check (length(trim(proposed_title)) > 0),
  proposed_author_name text not null check (length(trim(proposed_author_name)) > 0),

  origin text not null default 'manual'
    check (origin in ('manual','internal_list','reader_request','nexus','other')),
  origin_reference text null,

  status text not null default 'new'
    check (status in ('new','checking','ready','accepted','deferred','review_required','rejected')),
  priority smallint not null default 50 check (priority between 0 and 100),

  matched_author_id uuid null references public.authors(id) on delete set null,
  matched_work_id uuid null references public.works(id) on delete set null,

  discovery_status text not null default 'unknown'
    check (discovery_status in ('unknown','pending','complete','needs_review')),
  rights_status text not null default 'unknown'
    check (rights_status in ('unknown','clear','partial','alternate_edition_required','review_required','deferred','blocked')),
  rights_reason text null,

  jurisdiction text not null default 'EU_CZ',
  not_before date null,
  review_required boolean not null default false,

  selected_source_type text null,
  selected_source_reference text null,
  selected_source_url text null,

  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_candidates_status_priority_idx
  on public.work_candidates(status, priority desc, created_at asc);

create index if not exists work_candidates_not_before_idx
  on public.work_candidates(not_before)
  where not_before is not null;

create index if not exists work_candidates_matched_work_idx
  on public.work_candidates(matched_work_id)
  where matched_work_id is not null;

alter table public.work_candidates enable row level security;

revoke all on table public.work_candidates from anon;
grant select, insert, update on table public.work_candidates to authenticated;
grant select, insert, update on table public.work_candidates to service_role;

drop policy if exists "Editors can read work candidates" on public.work_candidates;
create policy "Editors can read work candidates"
on public.work_candidates for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.is_active = true and p.role in ('admin','editor')
));

drop policy if exists "Editors can create work candidates" on public.work_candidates;
create policy "Editors can create work candidates"
on public.work_candidates for insert to authenticated
with check (
  created_by = auth.uid()
  and updated_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.role in ('admin','editor')
  )
);

drop policy if exists "Editors can update work candidates" on public.work_candidates;
create policy "Editors can update work candidates"
on public.work_candidates for update to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.is_active = true and p.role in ('admin','editor')
))
with check (
  updated_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.role in ('admin','editor')
  )
);

