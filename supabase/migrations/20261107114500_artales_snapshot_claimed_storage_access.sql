-- Generalized private Snapshot Storage access.
-- The original policy grants upload/readback only to Gutenberg #389.
-- General Snapshot must instead admit precisely the canonical path of an
-- existing, actor-owned, legally approved and source-locked SHA-256 claim.
-- This neither permits arbitrary bucket writes nor broadens image publication.
-- No UPDATE/DELETE privileges or policies and no mutations to existing rows.
CREATE POLICY artales_snapshot_claimed_admin_insert_v2
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='artales-raw-snapshots'
  AND owner_id=(SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM public.candidate_snapshot_claims c
    JOIN public.candidate_legal_locks l
      ON l.candidate_id=c.candidate_id
     AND l.source_id=c.source_id
     AND l.decision_no=c.decision_no
    JOIN public.candidate_legal_decisions d
      ON d.candidate_id=c.candidate_id
     AND d.source_id=c.source_id
     AND d.decision_no=c.decision_no
    JOIN public.profiles p ON p.id=(SELECT auth.uid())
    WHERE c.claimed_by=(SELECT auth.uid())
      AND p.is_active IS TRUE AND p.role::text='admin'
      AND d.verdict='approved' AND d.territory='CZ/EU'
      AND l.source_url='https://www.gutenberg.org/ebooks/'||c.gutenberg_id::text
      AND name='gutenberg/'||c.gutenberg_id::text||
       '/sha256/'||c.sha256||'/original.epub'
  )
);

CREATE POLICY artales_snapshot_claimed_admin_readback_v2
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id='artales-raw-snapshots'
  AND owner_id=(SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM public.candidate_snapshot_claims c
    JOIN public.candidate_legal_locks l
      ON l.candidate_id=c.candidate_id
     AND l.source_id=c.source_id
     AND l.decision_no=c.decision_no
    JOIN public.candidate_legal_decisions d
      ON d.candidate_id=c.candidate_id
     AND d.source_id=c.source_id
     AND d.decision_no=c.decision_no
    JOIN public.profiles p ON p.id=(SELECT auth.uid())
    WHERE c.claimed_by=(SELECT auth.uid())
      AND p.is_active IS TRUE AND p.role::text='admin'
      AND d.verdict='approved' AND d.territory='CZ/EU'
      AND l.source_url='https://www.gutenberg.org/ebooks/'||c.gutenberg_id::text
      AND name='gutenberg/'||c.gutenberg_id::text||
       '/sha256/'||c.sha256||'/original.epub'
  )
);
