# ARTales v0.10.7k — versioned media uploads

This patch changes cover/portrait upload paths from stable overwrite paths to versioned paths.

## Why

Supabase public storage, browser cache, and Next/Image can keep serving an old image when a file is overwritten at the same public URL.

Old pattern:

```txt
works/my-work/cover/cover.webp
collections/my-collection/cover/cover.webp
authors/my-author/portrait/portrait.webp
```

New pattern:

```txt
works/my-work/cover/cover-<timestamp-random>.webp
collections/my-collection/cover/cover-<timestamp-random>.webp
authors/my-author/portrait/portrait-<timestamp-random>.webp
```

The database still stores only the current selected path in the existing `*_image_path` field.

## Behaviour

- New upload creates a new path.
- Public URL changes automatically.
- CDN/browser cache is bypassed without manual refresh tricks.
- Replacing an image in the same unsaved form session still cleans up the previous unsaved upload on a best-effort basis.
- Previously saved images are preserved in storage to avoid breaking the DB if the editor uploads a replacement but does not save the record.

## Future multi-cover support

This is compatible with a future `work_media` / `work_covers` table where multiple uploaded covers are kept and one is marked as primary.
