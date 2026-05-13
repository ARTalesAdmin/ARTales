alter table public.authors
  add column if not exists writing_languages text[] not null default '{}';

comment on column public.authors.writing_languages is
  'Optional list of standardized language codes relevant to the author writing profile, e.g. en, fr, la.';

alter table public.works
  add column if not exists cover_image_request text;

comment on column public.works.cover_image_request is
  'Internal non-public note for editors: original cover file name or instruction. Technical storage path is filled later by an administrator.';
