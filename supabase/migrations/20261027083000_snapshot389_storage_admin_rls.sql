-- ARTales Snapshot #389 single-title Storage grant.
-- STAGED ONLY. Apply only upon separate authorization of this exact migration.
-- No service_role usage or grants to anon; immutable INSERT + private readback.
BEGIN;
CREATE POLICY "artales_snapshot389_admin_insert_v1"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'artales-raw-snapshots'
  AND name ~ '^gutenberg/389/sha256/[0-9a-f]{64}/original[.]epub$'
  AND owner_id = (SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role::text = 'admin' AND p.is_active IS TRUE
  )
);
CREATE POLICY "artales_snapshot389_admin_readback_v1"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'artales-raw-snapshots'
  AND name ~ '^gutenberg/389/sha256/[0-9a-f]{64}/original[.]epub$'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role::text = 'admin' AND p.is_active IS TRUE
  )
);
COMMIT;
