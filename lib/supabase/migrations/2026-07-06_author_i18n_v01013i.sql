-- ARTales v0.10.13i
-- Bilingual author metadata foundation.

alter table public.authors
  add column if not exists name_cs text,
  add column if not exists name_en text,
  add column if not exists bio_cs text,
  add column if not exists bio_en text;

update public.authors
set
  name_cs = coalesce(name_cs, name),
  name_en = coalesce(name_en, name),
  bio_cs = coalesce(bio_cs, bio),
  bio_en = coalesce(bio_en, bio)
where
  name_cs is null
  or name_en is null
  or (bio is not null and (bio_cs is null or bio_en is null));

comment on column public.authors.name_cs is 'Czech public display name for author pages and work cards. Falls back to name.';
comment on column public.authors.name_en is 'English public display name for author pages and work cards. Falls back to name.';
comment on column public.authors.bio_cs is 'Czech public author biography. Falls back to bio.';
comment on column public.authors.bio_en is 'English public author biography. Falls back to bio.';
