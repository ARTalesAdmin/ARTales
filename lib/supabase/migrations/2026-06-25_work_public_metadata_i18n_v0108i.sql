-- ARTales v0.10.8i — work public metadata i18n
-- Adds bilingual public metadata fields to works.
-- Existing legacy title/subtitle/summary values are treated as the current EN layer.

alter table public.works
  add column if not exists title_cs text,
  add column if not exists title_en text,
  add column if not exists subtitle_cs text,
  add column if not exists subtitle_en text,
  add column if not exists summary_cs text,
  add column if not exists summary_en text;

update public.works
set
  title_en = coalesce(nullif(title_en, ''), nullif(title, '')),
  subtitle_en = coalesce(nullif(subtitle_en, ''), nullif(subtitle, '')),
  summary_en = coalesce(nullif(summary_en, ''), nullif(summary, ''))
where
  title_en is null
  or title_en = ''
  or subtitle_en is null
  or subtitle_en = ''
  or summary_en is null
  or summary_en = '';

comment on column public.works.title_cs is 'Public Czech work title used by localized ARTales public surfaces.';
comment on column public.works.title_en is 'Public English work title used by localized ARTales public surfaces.';
comment on column public.works.subtitle_cs is 'Public Czech work subtitle used by localized ARTales public surfaces.';
comment on column public.works.subtitle_en is 'Public English work subtitle used by localized ARTales public surfaces.';
comment on column public.works.summary_cs is 'Public Czech work annotation/summary used by localized ARTales public surfaces.';
comment on column public.works.summary_en is 'Public English work annotation/summary used by localized ARTales public surfaces.';
