-- ARTales v0.10.4 – Media Storage Foundation
-- Creates/updates the public artales-images bucket and allows active editors/admins
-- to manage image assets directly from the editorial UI.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artales-images',
  'artales-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read for public ARTales images. The bucket contains only assets meant
-- to be rendered publicly, such as work covers and later author/collection images.
drop policy if exists "Public can read ARTales images" on storage.objects;
create policy "Public can read ARTales images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'artales-images');

-- Only active editors/admins can upload or modify editorial image assets.
drop policy if exists "Editors can upload ARTales images" on storage.objects;
create policy "Editors can upload ARTales images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'artales-images'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
);

drop policy if exists "Editors can update ARTales images" on storage.objects;
create policy "Editors can update ARTales images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'artales-images'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
)
with check (
  bucket_id = 'artales-images'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
);

drop policy if exists "Editors can delete ARTales images" on storage.objects;
create policy "Editors can delete ARTales images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'artales-images'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
);
