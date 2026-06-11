# ARTales Media Storage Foundation

ARTales uses Supabase Storage for production images that are rendered by the app.

## Bucket

- Bucket: `artales-images`
- Public: yes
- ARTales app upload limit: 5 MB per image
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`

The Supabase Free plan upload limit is higher than the ARTales app limit. ARTales keeps its own smaller limit so the reader, gallery and future PDF/export pipeline stay lightweight.

## Current paths

```txt
works/{work_slug}/cover/cover.{ext}
authors/{author_slug}/portrait/portrait.{ext}
collections/{collection_slug}/cover/cover.{ext}
```

The paths are stored in:

```txt
works.cover_image_path
authors.portrait_image_path
collections.cover_image_path
```

Public UI should not rely on manually pasted URLs. It should resolve clean storage paths through `getPublicStorageImageUrl()`.

## Current editorial flow

1. Editor opens a work, author or collection in member/editor zone.
2. Editor uploads the image directly in the form.
3. The file is uploaded to Supabase Storage.
4. The generated storage path is written into a hidden form value.
5. Editor saves the record to persist the path in the database.

## Cleanup policy

Current uploads use stable paths and `upsert: true`. Uploading the same image type again replaces the previous file of the same format instead of creating timestamped copies.

If the editor uploads an image and removes/replaces it during the same editing session, the app performs best-effort cleanup. Historical orphaned files are not deleted automatically yet; a future admin media cleanup tool can compare Storage files against DB references.

## Later branches

- Inline image block upload.
- Parser `::image` integration polish.
- Optional image transformation/thumbnail pipeline.
- Optional external import sources such as Google Drive or crawler-assisted ingestion.
- Future cover variant model for web/print/light/dark/special editions.
