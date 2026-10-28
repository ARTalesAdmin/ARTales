-- STAGED, NOT APPLIED. One-time evidence-backed readback registration for #389.
-- Never re-fetch or re-upload source data. Apply only after snapshot general v1
-- schema migration and fresh verification of exact production object + legal lock.
DO $$
DECLARE
  v_candidate uuid := '98508359-bce1-4e73-b842-b69a9d1112d0';
  v_sha text := '2e12d981f9c916e5c6264e284f97b03c8dda52f6de720451d32967d0be8736df';
  v_path text := 'gutenberg/389/sha256/2e12d981f9c916e5c6264e284f97b03c8dda52f6de720451d32967d0be8736df/original.epub';
  v_owner uuid;
  v_source uuid;
  v_decision bigint;
  v_created timestamptz;
BEGIN
  SELECT o.owner_id::uuid,o.created_at INTO v_owner,v_created
  FROM storage.objects o WHERE o.bucket_id='artales-raw-snapshots' AND o.name=v_path
    AND o.metadata->>'mimetype'='application/epub+zip'
    AND o.metadata->>'size'='125934';
  IF v_owner IS NULL OR v_created IS NULL OR
     (SELECT count(*) FROM storage.objects WHERE bucket_id='artales-raw-snapshots') <> 1
  THEN RAISE EXCEPTION 'historical_snapshot_storage_evidence_mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_owner AND p.role::text='admin')
  THEN RAISE EXCEPTION 'historical_snapshot_owner_mismatch'; END IF;
  SELECT l.source_id,l.decision_no INTO v_source,v_decision
  FROM public.candidate_legal_locks l
  JOIN public.candidate_legal_decisions d ON d.decision_no=l.decision_no
  WHERE l.candidate_id=v_candidate AND l.decision_no=9
    AND l.source_url='https://www.gutenberg.org/ebooks/389'
    AND l.download_url='https://www.gutenberg.org/ebooks/389.epub.noimages'
    AND d.candidate_id=v_candidate AND d.source_id=l.source_id
    AND d.verdict='approved' AND d.territory='CZ/EU';
  IF v_source IS NULL OR v_decision IS NULL
  THEN RAISE EXCEPTION 'historical_snapshot_legal_evidence_mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM public.candidate_snapshot_claims WHERE candidate_id=v_candidate)
     OR EXISTS(SELECT 1 FROM public.candidate_snapshots WHERE candidate_id=v_candidate)
  THEN RAISE EXCEPTION 'historical_snapshot_already_registered'; END IF;
  INSERT INTO public.candidate_snapshot_claims
    (candidate_id,source_id,decision_no,gutenberg_id,sha256,claimed_by,claimed_at)
    VALUES(v_candidate,v_source,v_decision,389,v_sha,v_owner,v_created);
  INSERT INTO public.candidate_snapshots
    (candidate_id,source_id,decision_no,gutenberg_id,catalog_url,locked_file_url,
     selected_file_url,acquired_from,storage_path,sha256,byte_count,embedded_images,
     captured_at,recorded_by,readback_status,private_image_retention)
    VALUES(v_candidate,v_source,v_decision,389,'https://www.gutenberg.org/ebooks/389',
     'https://www.gutenberg.org/ebooks/389.epub.noimages',
     'https://www.gutenberg.org/ebooks/389.epub.noimages',
     'https://gutenberg.pglaf.org/cache/epub/389/pg389.epub',
     v_path,v_sha,125934,1,v_created,v_owner,'sha256_verified','admin_confirmed_archive_only');
END $$;
