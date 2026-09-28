-- ARTales P1-2A persistence schema draft.
-- DRAFT ONLY: this file is intentionally not in supabase/migrations.
-- It must be converted into a canonical migration and proven on an ephemeral branch before any production apply.

begin;

-- 1) Allow incomplete draft works while preserving strict review/published/archived requirements.
alter table public.works
  drop constraint if exists works_content_not_blank,
  drop constraint if exists works_summary_length,
  drop constraint if exists works_summary_not_blank;

alter table public.works
  add constraint works_content_required_after_draft
    check (status = 'draft'::public.work_status or btrim(content) <> ''),
  add constraint works_summary_required_after_draft
    check (status = 'draft'::public.work_status or btrim(summary) <> ''),
  add constraint works_summary_length_after_draft
    check (
      status = 'draft'::public.work_status
      or char_length(summary) between 200 and 800
    );

comment on constraint works_content_required_after_draft on public.works is
  'Draft works may have empty content. Review/published/archived works must contain non-blank content.';

comment on constraint works_summary_required_after_draft on public.works is
  'Draft works may have an empty summary. Review/published/archived works must contain a non-blank summary.';

comment on constraint works_summary_length_after_draft on public.works is
  'Draft works may have an incomplete summary. Review/published/archived summaries must remain 200-800 characters.';

-- 2) Persist normalized discovery identity on the candidate.
alter table public.work_candidates
  add column if not exists normalized_title text null,
  add column if not exists normalized_author_name text null,
  add column if not exists normalized_author_birth_year integer null,
  add column if not exists normalized_author_death_year integer null,
  add column if not exists first_publication_year integer null,
  add column if not exists identity_status text not null default 'unknown'
    check (identity_status in ('unknown','matched','needs_review')),
  add column if not exists identity_reason text null,
  add column if not exists promoted_at timestamptz null,
  add column if not exists promoted_by uuid null references public.profiles(id) on delete set null;

alter table public.work_candidates
  drop constraint if exists work_candidates_normalized_author_birth_year_reasonable,
  drop constraint if exists work_candidates_normalized_author_death_year_reasonable,
  drop constraint if exists work_candidates_normalized_author_year_order,
  add constraint work_candidates_normalized_author_birth_year_reasonable
    check (normalized_author_birth_year is null or normalized_author_birth_year between 0 and 3000),
  add constraint work_candidates_normalized_author_death_year_reasonable
    check (normalized_author_death_year is null or normalized_author_death_year between 0 and 3000),
  add constraint work_candidates_normalized_author_year_order
    check (
      normalized_author_birth_year is null
      or normalized_author_death_year is null
      or normalized_author_death_year >= normalized_author_birth_year
    );

-- 3) Candidate source / edition shortlist.
create table if not exists public.work_candidate_sources (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.work_candidates(id) on delete cascade,

  provider text not null check (length(trim(provider)) > 0),
  source_type text not null check (length(trim(source_type)) > 0),
  source_reference text not null check (length(trim(source_reference)) > 0),
  source_url text null,
  canonical_identifier text null,

  language text null,
  publication_year integer null check (publication_year is null or publication_year between 0 and 3000),
  publisher text null,
  edition_title text null,
  publication_facts text null,

  identity_match text not null default 'uncertain'
    check (identity_match in ('strong','partial','uncertain')),
  status text not null default 'candidate'
    check (status in ('candidate','needs_review','rejected')),
  note text null,

  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, candidate_id)
);

create index if not exists work_candidate_sources_candidate_idx
  on public.work_candidate_sources(candidate_id, status, created_at asc);

create index if not exists work_candidate_sources_identity_idx
  on public.work_candidate_sources(candidate_id, identity_match);

-- Preferred source belongs to the candidate and is represented once on the candidate root.
alter table public.work_candidates
  add column if not exists preferred_source_id uuid null;

alter table public.work_candidates
  drop constraint if exists work_candidates_preferred_source_fk,
  add constraint work_candidates_preferred_source_fk
    foreign key (preferred_source_id, id)
    references public.work_candidate_sources(id, candidate_id)
    on delete no action
    deferrable initially deferred;

create index if not exists work_candidates_preferred_source_idx
  on public.work_candidates(preferred_source_id)
  where preferred_source_id is not null;

-- 4) Rights decision per component of a concrete source.
create table if not exists public.work_candidate_component_rights (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null,
  source_id uuid not null,

  component_type text not null
    check (component_type in (
      'WORK_CONTENT',
      'EDITION_CONTENT',
      'TRANSLATION',
      'SOURCE_WRAPPER',
      'EDITORIAL_ADDITION',
      'ASSET',
      'UNKNOWN'
    )),
  decision text not null
    check (decision in (
      'usable',
      'exclude',
      'review_required',
      'alternate_edition_required',
      'blocked',
      'not_applicable'
    )),
  publication_effect text not null
    check (publication_effect in ('allow','exclude_component','block_source','review')),

  reason text not null check (length(trim(reason)) > 0),
  jurisdiction text not null default 'EU_CZ',
  not_before date null,

  reviewed_by uuid null references public.profiles(id) on delete set null,
  reviewed_at timestamptz null,

  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint work_candidate_component_rights_source_fk
    foreign key (source_id, candidate_id)
    references public.work_candidate_sources(id, candidate_id)
    on delete cascade,

  constraint work_candidate_component_rights_source_component_unique
    unique (source_id, component_type)
);

create index if not exists work_candidate_component_rights_candidate_idx
  on public.work_candidate_component_rights(candidate_id, source_id);

create index if not exists work_candidate_component_rights_review_idx
  on public.work_candidate_component_rights(candidate_id, publication_effect)
  where publication_effect in ('review','block_source');

-- 5) Append-only promotion audit.
create table if not exists public.work_candidate_promotion_attempts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.work_candidates(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id),
  preferred_source_id uuid null,

  result text not null
    check (result in ('allowed','blocked','promoted','failed')),
  blockers jsonb not null default '[]'::jsonb
    check (jsonb_typeof(blockers) = 'array'),
  gate_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(gate_snapshot) = 'object'),

  created_work_id uuid null references public.works(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint work_candidate_promotion_attempts_source_fk
    foreign key (preferred_source_id, candidate_id)
    references public.work_candidate_sources(id, candidate_id)
    on delete no action
    deferrable initially deferred,

  constraint work_candidate_promotion_promoted_has_work
    check (result <> 'promoted' or created_work_id is not null)
);

create index if not exists work_candidate_promotion_attempts_candidate_idx
  on public.work_candidate_promotion_attempts(candidate_id, created_at desc);

-- 6) RLS: editor/admin only, matching the candidate foundation.
alter table public.work_candidate_sources enable row level security;
alter table public.work_candidate_component_rights enable row level security;
alter table public.work_candidate_promotion_attempts enable row level security;

revoke all on table public.work_candidate_sources from anon;
revoke all on table public.work_candidate_component_rights from anon;
revoke all on table public.work_candidate_promotion_attempts from anon;

grant select, insert, update on table public.work_candidate_sources to authenticated;
grant select, insert, update on table public.work_candidate_component_rights to authenticated;
grant select, insert on table public.work_candidate_promotion_attempts to authenticated;

grant select, insert, update on table public.work_candidate_sources to service_role;
grant select, insert, update on table public.work_candidate_component_rights to service_role;
grant select, insert on table public.work_candidate_promotion_attempts to service_role;

drop policy if exists "Editors can read candidate sources" on public.work_candidate_sources;
create policy "Editors can read candidate sources"
on public.work_candidate_sources for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active = true
    and p.role in ('admin','editor')
));

drop policy if exists "Editors can create candidate sources" on public.work_candidate_sources;
create policy "Editors can create candidate sources"
on public.work_candidate_sources for insert to authenticated
with check (
  created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin','editor')
  )
);

drop policy if exists "Editors can update candidate sources" on public.work_candidate_sources;
create policy "Editors can update candidate sources"
on public.work_candidate_sources for update to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active = true
    and p.role in ('admin','editor')
))
with check (
  updated_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin','editor')
  )
);

drop policy if exists "Editors can read candidate component rights" on public.work_candidate_component_rights;
create policy "Editors can read candidate component rights"
on public.work_candidate_component_rights for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active = true
    and p.role in ('admin','editor')
));

drop policy if exists "Editors can create candidate component rights" on public.work_candidate_component_rights;
create policy "Editors can create candidate component rights"
on public.work_candidate_component_rights for insert to authenticated
with check (
  created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin','editor')
  )
);

drop policy if exists "Editors can update candidate component rights" on public.work_candidate_component_rights;
create policy "Editors can update candidate component rights"
on public.work_candidate_component_rights for update to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active = true
    and p.role in ('admin','editor')
))
with check (
  updated_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin','editor')
  )
);

drop policy if exists "Editors can read candidate promotion attempts" on public.work_candidate_promotion_attempts;
create policy "Editors can read candidate promotion attempts"
on public.work_candidate_promotion_attempts for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active = true
    and p.role in ('admin','editor')
));

drop policy if exists "Editors can create candidate promotion attempts" on public.work_candidate_promotion_attempts;
create policy "Editors can create candidate promotion attempts"
on public.work_candidate_promotion_attempts for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin','editor')
  )
);

commit;
