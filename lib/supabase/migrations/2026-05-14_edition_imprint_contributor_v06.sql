-- ARTales v0.6 – Edition / Imprint / Contributor layer
-- MVP approach: edition fields live on works for immediate editor/public use.
-- Structured contributor table is prepared for the next workflow phase.

alter table public.works
  add column if not exists edition_title text,
  add column if not exists edition_version text,
  add column if not exists edition_language text,
  add column if not exists original_language text,
  add column if not exists edition_source_url text,
  add column if not exists edition_license text,
  add column if not exists edition_publisher text,
  add column if not exists publication_year text,
  add column if not exists isbn text,
  add column if not exists isbn_status text not null default 'not_required',
  add column if not exists isbn_note text,
  add column if not exists edition_note_public text,
  add column if not exists edition_note_internal text,
  add column if not exists contributor_summary text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'works_isbn_status_check'
  ) then
    alter table public.works
      add constraint works_isbn_status_check
      check (isbn_status in ('not_required', 'planned', 'requested', 'assigned', 'external', 'not_applicable'));
  end if;
end $$;

comment on column public.works.edition_title is
  'Public/internal title of the concrete ARTales edition, e.g. ARTales public-domain edition.';
comment on column public.works.edition_version is
  'Edition version or label, e.g. v1.0, draft, annotated edition.';
comment on column public.works.edition_language is
  'Language code of the concrete edition. May differ from original_language.';
comment on column public.works.original_language is
  'Original language code of the source work, when known/relevant.';
comment on column public.works.edition_source_url is
  'Source URL for the edition/source text, if public or useful.';
comment on column public.works.edition_license is
  'Public/internal rights or license note for this edition.';
comment on column public.works.edition_publisher is
  'Publisher/imprint label for this edition, e.g. ARTales.';
comment on column public.works.publication_year is
  'Publication year for this ARTales edition or planned edition.';
comment on column public.works.isbn is
  'ISBN assigned to a concrete edition/format. Do not use as internal work ID.';
comment on column public.works.isbn_status is
  'ISBN state: not_required, planned, requested, assigned, external, not_applicable.';
comment on column public.works.isbn_note is
  'Internal note about ISBN handling. Public output should show ISBN only when assigned/external.';
comment on column public.works.edition_note_public is
  'Public edition note shown in About this edition.';
comment on column public.works.edition_note_internal is
  'Internal non-public edition note.';
comment on column public.works.contributor_summary is
  'MVP public contributor/tiraz summary. Later replace/augment with work_contributors.';

create table if not exists public.work_contributors (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_id uuid references public.authors(id) on delete set null,
  display_name text not null,
  role text not null,
  display_order integer not null default 100,
  public_note text,
  internal_note text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_contributors_role_check check (
    role in (
      'author',
      'original_author',
      'translator',
      'editor',
      'proofreader',
      'illustrator',
      'curator',
      'publisher',
      'technical_editor',
      'narrator',
      'audio_editor',
      'other'
    )
  )
);

create index if not exists work_contributors_work_id_idx
  on public.work_contributors(work_id);

create index if not exists work_contributors_role_idx
  on public.work_contributors(role);

comment on table public.work_contributors is
  'Structured contributor layer prepared for ARTales edition/workflow roles. v0.6 UI uses contributor_summary as MVP; this table is ready for later expansion.';
