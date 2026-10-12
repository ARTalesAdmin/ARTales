# ARTales source archive — production Storage checkpoint (2026-10-12)

## Deployed, explicitly authorized

On 2026-10-12 the ARTales architect explicitly authorized creating the private source archive in the existing **production** Supabase project `nmhdwmszbwgrgfbmlguu`. Applied exactly one non-destructive SQL INSERT into `storage.buckets`:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artales-source-archive', 'artales-source-archive', false,
  10485760, array['image/gif','image/png','image/jpeg']::text[]
);
```

Independent post-write SQL readback confirmed `public=false`, size 10485760 bytes (10 MiB), three exact MIME types, and **zero objects**. `storage.objects` RLS is enabled. No storage RLS policies target this private bucket, and all current explicit `storage.objects` policies are scoped to the existing public `artales-images` bucket. Therefore default-deny clients have no direct object read/upload/update/delete permissions in the new archive. No Storage policy was created or weakened.

The existing `artales-images` bucket remains public, 5 MiB, JPEG/PNG/WebP. **No existing objects were changed.** Neither `main`, the public Reader nor production work records were touched. No schema migration history was written for the bucket-row INSERT. This checkpoint documents the authorized infrastructure change independently of PR merge state.

The Supabase security advisor was run. It reported existing non-bucket warnings about executable SECURITY DEFINER routines and other schema objects; those require a separate audit, not an unrelated silent privilege change.

## Next implementation steps

1. Create a narrowly authenticated **server-only** ingest entry point for admin/editor or explicitly assigned worker. It must recompute catalog provenance, download genuine allowed Gutenberg binaries, validate artist/edition rights, MIME, size, SHA-256 and source linkage, then use the private bucket with no upsert.
2. Run an actual authenticated Storage upload + download/readback with the genuine source (or a controlled temporary QA image) and verify exact bytes, timestamp and archive receipt. Current adapter tests use a mock and **do not establish a successful real Storage upload**.
3. Keep copyrighted or undecided images out of public buckets; internal capture also needs an appropriate lawful basis. For approved publication derive safe web PNG/WebP/JPEG, store only the approved derivative in `artales-images`.
4. Ivana chooses original/custom/omit for each interior illustration, independently of the source snapshot. Even omitted pictures retain available original snapshot references and may be reconsidered later.
5. Browser QA checks real illustration aspect ratio, anchored placement and pagination; independent rights and Reader release gates still apply. Covers are always created by ARTales.
6. PR #235 inventory work is separable from actual binary ingest, Storage readback, editor UI and signed release.

No long-lived Supabase preview branch is required by this bucket creation. If a future DB/RLS test branch is provisioned, obtain cost confirmation first, record and destroy it after the session.

## Risk, verification and rollback

**Risk HIGH (production infrastructure), authorization explicit.** Current repo PR is documentation + pure manifest code; no additional bucket creation on merge. Env: no new variables. Bucket and RLS readback: verified. Actual file upload, signed URL, browser, and privilege negative tests: **not yet performed**.

Rollback only if truly necessary: verify the archive is empty and no references depend on it, then remove only this newly created bucket under fresh approval. Never delete or change the existing public bucket or its objects.
