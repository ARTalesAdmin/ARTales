-- ARTales images v0.1
-- Adds cover metadata to works. The actual files live in Supabase Storage
-- bucket: artales-images

alter table public.works
  add column if not exists cover_image_path text,
  add column if not exists cover_image_alt text,
  add column if not exists cover_image_caption text;

comment on column public.works.cover_image_path is
  'Path inside Supabase Storage bucket artales-images, e.g. works/{work_id}/cover/cover.webp. Do not store the full public URL unless temporarily necessary.';

comment on column public.works.cover_image_alt is
  'Alt text for the public cover image.';

comment on column public.works.cover_image_caption is
  'Optional public caption or credit for the cover image.';
