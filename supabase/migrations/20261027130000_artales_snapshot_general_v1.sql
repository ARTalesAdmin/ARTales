-- ARTales Snapshot general v1 — STAGED, NOT APPLIED.
-- One candidate = one immutable capture claim and one immutable verified receipt.
-- Apply separately only after architecture, RLS, rollout and rollback review.
CREATE TABLE public.candidate_snapshot_claims (
  candidate_id uuid PRIMARY KEY REFERENCES public.candidate_legal_locks(candidate_id) ON DELETE RESTRICT,
  source_id uuid NOT NULL REFERENCES public.candidate_legal_sources(id) ON DELETE RESTRICT,
  decision_no bigint NOT NULL REFERENCES public.candidate_legal_decisions(decision_no) ON DELETE RESTRICT,
  gutenberg_id integer NOT NULL CHECK (gutenberg_id BETWEEN 1 AND 99999999),
  claimed_by uuid NOT NULL REFERENCES public.profiles(id),
  claimed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.candidate_snapshots (
  candidate_id uuid PRIMARY KEY REFERENCES public.candidate_snapshot_claims(candidate_id) ON DELETE RESTRICT,
  source_id uuid NOT NULL REFERENCES public.candidate_legal_sources(id) ON DELETE RESTRICT,
  decision_no bigint NOT NULL REFERENCES public.candidate_legal_decisions(decision_no) ON DELETE RESTRICT,
  gutenberg_id integer NOT NULL CHECK (gutenberg_id BETWEEN 1 AND 99999999),
  catalog_url text NOT NULL,
  locked_file_url text NOT NULL,
  selected_file_url text NOT NULL,
  acquired_from text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'artales-raw-snapshots' CHECK (storage_bucket = 'artales-raw-snapshots'),
  storage_path text NOT NULL UNIQUE,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  byte_count integer NOT NULL CHECK (byte_count BETWEEN 64 AND 8388608),
  embedded_images integer NOT NULL CHECK (embedded_images BETWEEN 0 AND 400),
  original_manifest jsonb,
  captured_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL REFERENCES public.profiles(id),
  readback_status text NOT NULL DEFAULT 'sha256_verified' CHECK (readback_status = 'sha256_verified'),
  private_image_retention text NOT NULL CHECK (private_image_retention IN ('none','admin_confirmed_archive_only')),
  source_provenance text NOT NULL DEFAULT 'pending_independent_verification' CHECK (source_provenance = 'pending_independent_verification'),
  content_correspondence text NOT NULL DEFAULT 'pending' CHECK (content_correspondence = 'pending'),
  image_publication_clearance text NOT NULL DEFAULT 'excluded' CHECK (image_publication_clearance = 'excluded'),
  semantic_ready boolean NOT NULL DEFAULT false CHECK (semantic_ready = false),
  publication_authorized boolean NOT NULL DEFAULT false CHECK (publication_authorized = false),
  CONSTRAINT snapshot_canonical_path CHECK
    (storage_path = 'gutenberg/'||gutenberg_id::text||'/sha256/'||sha256||'/original.epub'),
  CONSTRAINT snapshot_catalog_identity CHECK
    (catalog_url = 'https://www.gutenberg.org/ebooks/'||gutenberg_id::text),
  CONSTRAINT snapshot_mirror_identity CHECK
    (acquired_from = 'https://gutenberg.pglaf.org/cache/epub/'||gutenberg_id::text||'/pg'||gutenberg_id::text||'.epub'),
  CONSTRAINT snapshot_image_retention CHECK
    (embedded_images = 0 OR private_image_retention = 'admin_confirmed_archive_only')
);
ALTER TABLE public.candidate_snapshot_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.candidate_snapshot_claims FROM anon, authenticated;
REVOKE ALL ON public.candidate_snapshots FROM anon, authenticated;
GRANT SELECT, INSERT ON public.candidate_snapshot_claims TO authenticated;
GRANT SELECT, INSERT ON public.candidate_snapshots TO authenticated;
CREATE POLICY artales_snapshot_claim_read_v1 ON public.candidate_snapshot_claims
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
    AND p.is_active AND p.role::text IN ('admin','editor')));
CREATE POLICY artales_snapshot_claim_insert_v1 ON public.candidate_snapshot_claims
  FOR INSERT TO authenticated
  WITH CHECK (claimed_by=(SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.is_active AND p.role::text='admin')
    AND EXISTS (SELECT 1 FROM public.candidate_legal_locks l
      JOIN public.candidate_legal_decisions d ON d.decision_no=l.decision_no
      WHERE l.candidate_id=candidate_id AND l.source_id=source_id
        AND l.decision_no=decision_no AND d.candidate_id=l.candidate_id
        AND d.source_id=l.source_id AND d.verdict='approved'
        AND d.territory='CZ/EU'
        AND l.source_url='https://www.gutenberg.org/ebooks/'||gutenberg_id::text));
CREATE POLICY artales_snapshot_receipt_read_v1 ON public.candidate_snapshots
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
    AND p.is_active AND p.role::text IN ('admin','editor')));
CREATE POLICY artales_snapshot_receipt_insert_v1 ON public.candidate_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (recorded_by=(SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.is_active AND p.role::text='admin')
    AND EXISTS (SELECT 1 FROM public.candidate_snapshot_claims c
      JOIN public.candidate_legal_locks l ON l.candidate_id=c.candidate_id
      JOIN public.candidate_legal_decisions d ON d.decision_no=l.decision_no
      WHERE c.candidate_id=candidate_snapshots.candidate_id
        AND c.source_id=candidate_snapshots.source_id
        AND c.decision_no=candidate_snapshots.decision_no
        AND c.gutenberg_id=candidate_snapshots.gutenberg_id
        AND c.claimed_by=(SELECT auth.uid())
        AND l.source_id=c.source_id AND l.decision_no=c.decision_no
        AND d.candidate_id=l.candidate_id AND d.source_id=l.source_id
        AND d.verdict='approved' AND d.territory='CZ/EU'));
-- Extend existing #389 Storage rules without modifying them. This only permits
-- active admins with a previously claimed and legally locked Gutenberg record.
CREATE POLICY artales_snapshot_general_upload_v1 ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id='artales-raw-snapshots'
    AND name ~ '^gutenberg/[1-9][0-9]{0,7}/sha256/[a-f0-9]{64}/original[.]epub$'
    AND owner_id=(SELECT auth.uid())::text
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.is_active AND p.role::text='admin')
    AND EXISTS (SELECT 1 FROM public.candidate_snapshot_claims c
      JOIN public.candidate_legal_locks l ON l.candidate_id=c.candidate_id
      JOIN public.candidate_legal_decisions d ON d.decision_no=l.decision_no
      WHERE c.claimed_by=(SELECT auth.uid()) AND c.gutenberg_id=split_part(name,'/',2)::integer
        AND l.source_id=c.source_id AND l.decision_no=c.decision_no
        AND d.candidate_id=c.candidate_id AND d.verdict='approved'
        AND d.territory='CZ/EU'));
CREATE POLICY artales_snapshot_general_readback_v1 ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id='artales-raw-snapshots'
    AND name ~ '^gutenberg/[1-9][0-9]{0,7}/sha256/[a-f0-9]{64}/original[.]epub$'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.is_active AND p.role::text='admin')
    AND EXISTS (SELECT 1 FROM public.candidate_snapshot_claims c
      JOIN public.candidate_legal_locks l ON l.candidate_id=c.candidate_id
      JOIN public.candidate_legal_decisions d ON d.decision_no=l.decision_no
      WHERE c.claimed_by=(SELECT auth.uid()) AND c.gutenberg_id=split_part(name,'/',2)::integer
        AND l.source_id=c.source_id AND l.decision_no=c.decision_no
        AND d.candidate_id=c.candidate_id AND d.verdict='approved'
        AND d.territory='CZ/EU'));
-- No UPDATE or DELETE privilege/policy is created.
