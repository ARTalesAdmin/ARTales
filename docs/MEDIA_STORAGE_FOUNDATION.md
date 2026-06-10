# ARTales Media Storage Foundation

ARTales uses Supabase Storage for production images that are rendered by the app.

## Bucket

- Bucket: `artales-images`
- Public: yes
- App upload limit for work covers: 5 MB
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`

The Supabase Free plan upload limit is higher than the ARTales app limit. ARTales keeps its own smaller limit so the reader, gallery and future PDF/export pipeline stay lightweight.

## Current paths

```txt
works/{work_slug}/cover/{timestamp}-{file_name}.{ext}
```

The path is stored in `works.cover_image_path`. Public UI should not rely on a manually pasted URL; it should resolve the storage path through `getPublicStorageImageUrl()`.

## Current editorial flow

1. Editor opens a work in `/member/works/.../edit` or creates a new work.
2. Editor uploads a cover directly in the work form.
3. The file is uploaded to Supabase Storage.
4. The generated storage path is written into the hidden `cover_image_path` form value.
5. Editor saves the work to persist the path in the database.

## Later branches

- Author portrait upload.
- Collection cover upload.
- Inline image block upload.
- Optional image transformation/thumbnail pipeline.
- Optional external import sources such as Google Drive or crawler-assisted ingestion.
