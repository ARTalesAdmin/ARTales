-- ARTales v0.10.5 — Author portrait + collection cover metadata
-- Extends the existing artales-images Storage workflow to authors and collections.

alter table public.authors
  add column if not exists portrait_image_path text,
  add column if not exists portrait_image_alt text,
  add column if not exists portrait_image_caption text;

comment on column public.authors.portrait_image_path is
  'Path inside Supabase Storage bucket artales-images, e.g. authors/{author_slug}/portrait/portrait.webp.';

comment on column public.authors.portrait_image_alt is
  'Alt text for the public author portrait image.';

comment on column public.authors.portrait_image_caption is
  'Optional public caption or credit for the author portrait image.';

alter table public.collections
  add column if not exists cover_image_path text,
  add column if not exists cover_image_alt text,
  add column if not exists cover_image_caption text;

comment on column public.collections.cover_image_path is
  'Path inside Supabase Storage bucket artales-images, e.g. collections/{collection_slug}/cover/cover.webp.';

comment on column public.collections.cover_image_alt is
  'Alt text for the public collection cover image.';

comment on column public.collections.cover_image_caption is
  'Optional public caption or credit for the collection cover image.';
