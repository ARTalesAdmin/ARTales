-- Legal Screen v1. Explicitly source-only: DO NOT APPLY in production until separately authorized.
-- No fetched full texts, no Works/Reader/Composer mutation, no rights_status changes.
BEGIN;

CREATE TABLE public.candidate_legal_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
  source_kind text NOT NULL CHECK (source_kind IN ('open_library','gutenberg','library','other')),
  edition_title text NOT NULL CHECK (length(btrim(edition_title)) BETWEEN 1 AND 300),
  source_url text NOT NULL CHECK (length(source_url) <= 1000 AND source_url ~ '^https://[^[:space:]]+$'),
  download_url text CHECK (download_url IS NULL OR (length(download_url) <= 1000 AND download_url ~ '^https://[^[:space:]]+$')),
  translation_status text NOT NULL DEFAULT 'unknown' CHECK (translation_status IN ('original','translated','unknown')),
  read_url text CHECK (read_url IS NULL OR (length(read_url) <= 1000 AND read_url ~ '^https://[^[:space:]]+$')),
  edition_year integer CHECK (edition_year IS NULL OR edition_year BETWEEN 1400 AND 2100),
  language_code text NOT NULL DEFAULT '' CHECK (length(language_code) <= 30),
  translator text NOT NULL DEFAULT '' CHECK (length(translator) <= 300),
  illustrator text NOT NULL DEFAULT '' CHECK (length(illustrator) <= 300),
  author_died integer CHECK (author_died IS NULL OR author_died BETWEEN 1000 AND 2100),
  translator_died integer CHECK (translator_died IS NULL OR translator_died BETWEEN 1000 AND 2100),
  illustrator_died integer CHECK (illustrator_died IS NULL OR illustrator_died BETWEEN 1000 AND 2100),
  identity_match text NOT NULL DEFAULT 'uncertain'
    CHECK (identity_match IN ('confirmed','uncertain','mismatch')),
  language_match text NOT NULL DEFAULT 'uncertain'
    CHECK (language_match IN ('matches','uncertain','mismatch')),
  text_format text NOT NULL DEFAULT 'unknown'
    CHECK (text_format IN ('plain_text','html','epub','ocr_pdf','scan','catalog_only','unknown')),
  completeness text NOT NULL DEFAULT 'unknown'
    CHECK (completeness IN ('complete','partial','unknown')),
  text_quality text NOT NULL DEFAULT 'unknown'
    CHECK (text_quality IN ('verified','needs_cleanup','unknown')),
  original_rights text NOT NULL DEFAULT 'unknown'
    CHECK (original_rights IN ('unknown','public_domain','licensed','restricted')),
  translation_rights text NOT NULL DEFAULT 'unknown'
    CHECK (translation_rights IN ('unknown','not_applicable','public_domain','licensed','restricted')),
  illustration_use text NOT NULL DEFAULT 'unknown'
    CHECK (illustration_use IN ('excluded','unknown','public_domain','licensed','restricted')),
  source_terms text NOT NULL DEFAULT 'unknown'
    CHECK (source_terms IN ('unknown','cleared','restricted')),
  evidence_url text CHECK (evidence_url IS NULL OR (length(evidence_url) <= 1000 AND evidence_url ~ '^https://[^[:space:]]+$')),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 5000),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  updated_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_legal_sources_unique_source UNIQUE(candidate_id, source_url, download_url)
);
CREATE INDEX candidate_legal_sources_candidate_idx ON public.candidate_legal_sources(candidate_id, created_at);

CREATE TABLE public.candidate_legal_decisions (
  decision_no bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
  source_id uuid REFERENCES public.candidate_legal_sources(id) ON DELETE RESTRICT,
  verdict text NOT NULL CHECK (verdict IN ('approved','deferred','rejected','needs_evidence')),
  territory text NOT NULL DEFAULT 'CZ/EU' CHECK (territory='CZ/EU'),
  rationale text NOT NULL CHECK (length(btrim(rationale)) BETWEEN 15 AND 5000),
  source_facts jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_facts)='object'),
  reviewed_by uuid NOT NULL REFERENCES public.profiles(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approved_requires_source CHECK (verdict <> 'approved' OR source_id IS NOT NULL)
);
CREATE INDEX candidate_legal_decisions_latest_idx
  ON public.candidate_legal_decisions(candidate_id, decision_no DESC);

ALTER TABLE public.candidate_legal_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_legal_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.candidate_legal_sources FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.candidate_legal_decisions FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.candidate_legal_sources, public.candidate_legal_decisions TO authenticated;
GRANT INSERT(candidate_id,source_kind,edition_title,source_url,download_url,translation_status,read_url,edition_year,language_code,
  translator,illustrator,author_died,translator_died,illustrator_died,
  identity_match,language_match,text_format,completeness,text_quality,
  original_rights,translation_rights,illustration_use,source_terms,
  evidence_url,notes,created_by,updated_by) ON public.candidate_legal_sources TO authenticated;
GRANT UPDATE(source_kind,edition_title,source_url,download_url,translation_status,read_url,edition_year,language_code,
  translator,illustrator,author_died,translator_died,illustrator_died,
  identity_match,language_match,text_format,completeness,text_quality,
  original_rights,translation_rights,illustration_use,source_terms,
  evidence_url,notes,updated_by,updated_at) ON public.candidate_legal_sources TO authenticated;
GRANT INSERT(candidate_id,source_id,verdict,territory,rationale,reviewed_by)
  ON public.candidate_legal_decisions TO authenticated;
GRANT USAGE ON SEQUENCE public.candidate_legal_decisions_decision_no_seq TO authenticated;

CREATE POLICY legal_sources_editor_select ON public.candidate_legal_sources
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.is_active AND p.role IN ('admin','editor')
  ));
CREATE POLICY legal_sources_editor_insert ON public.candidate_legal_sources
  FOR INSERT TO authenticated WITH CHECK (
    created_by=(SELECT auth.uid()) AND updated_by=(SELECT auth.uid())
    AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.is_active AND p.role IN ('admin','editor'))
    AND EXISTS(SELECT 1 FROM public.work_candidates c WHERE c.id=candidate_id)
  );
CREATE POLICY legal_sources_editor_update ON public.candidate_legal_sources
  FOR UPDATE TO authenticated
  USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
    AND p.is_active AND p.role IN ('admin','editor')))
  WITH CHECK(updated_by=(SELECT auth.uid())
    AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.is_active AND p.role IN ('admin','editor')));

CREATE POLICY legal_decisions_editor_select ON public.candidate_legal_decisions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.is_active AND p.role IN ('admin','editor')
  ));
CREATE POLICY legal_decisions_editor_insert ON public.candidate_legal_decisions
  FOR INSERT TO authenticated WITH CHECK (
    reviewed_by=(SELECT auth.uid())
    AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.is_active AND (
        p.role IN ('admin','editor')
      ))
    AND EXISTS(SELECT 1 FROM public.work_candidates c WHERE c.id=candidate_id)
  );

-- Freeze an edition that was ever approved: its recorded legal basis must not drift.
CREATE FUNCTION public.artales_guard_approved_legal_source()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
BEGIN
  -- Lock the edition's audit state before checking approvals. Both source edits
  -- and legal decisions use the same transaction-scoped advisory lock.
  -- Hash collisions only serialize unrelated editions; they cannot weaken checks.
  PERFORM pg_catalog.pg_advisory_xact_lock(410725, pg_catalog.hashtext(OLD.id::text));
  IF EXISTS(SELECT 1 FROM public.candidate_legal_decisions d
     WHERE d.source_id=OLD.id AND d.verdict='approved') THEN
    RAISE EXCEPTION 'approved_legal_source_immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER artales_guard_approved_legal_source
  BEFORE UPDATE ON public.candidate_legal_sources
  FOR EACH ROW EXECUTE FUNCTION public.artales_guard_approved_legal_source();

-- All routes (including direct PostgREST insert) go through this trigger.
-- No new rights can be approved without an identified, evidenced edition.
CREATE FUNCTION public.artales_validate_legal_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE s record;
BEGIN
  IF NEW.reviewed_by IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'legal_reviewer_mismatch' USING ERRCODE='42501';
  END IF;
  -- Serialize screen decisions and snapshot requests by candidate, without UPDATE privileges.
  PERFORM pg_catalog.pg_advisory_xact_lock(410726, pg_catalog.hashtext(NEW.candidate_id::text));
  IF EXISTS(SELECT 1 FROM public.candidate_legal_locks l WHERE l.candidate_id=NEW.candidate_id) THEN
    RAISE EXCEPTION 'legal_screen_locked' USING ERRCODE='23514';
  END IF;
  -- Candidate is a read-only reference here; per-edition serialization is below.
  PERFORM 1 FROM public.work_candidates c WHERE c.id=NEW.candidate_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'legal_candidate_missing' USING ERRCODE='23503'; END IF;
  IF NEW.source_id IS NOT NULL THEN
    -- Serialize approval/evidence snapshot against concurrent edition edits.
    -- This does not require row UPDATE privileges on work_candidates.
    PERFORM pg_catalog.pg_advisory_xact_lock(410725, pg_catalog.hashtext(NEW.source_id::text));
    SELECT * INTO s FROM public.candidate_legal_sources
      WHERE id=NEW.source_id AND candidate_id=NEW.candidate_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'legal_source_not_candidate' USING ERRCODE='23503';
    END IF;
    NEW.source_facts:=jsonb_build_object(
      'sourceId',s.id,'kind',s.source_kind,'edition',s.edition_title,
      'url',s.source_url,'downloadUrl',s.download_url,'translationStatus',s.translation_status,'readUrl',s.read_url,'year',s.edition_year,
      'language',s.language_code,'translator',s.translator,'illustrator',s.illustrator,
      'authorDied',s.author_died,'translatorDied',s.translator_died,'illustratorDied',s.illustrator_died,
      'identityMatch',s.identity_match,'languageMatch',s.language_match,
      'textFormat',s.text_format,'completeness',s.completeness,'textQuality',s.text_quality,
      'originalRights',s.original_rights,'translationRights',s.translation_rights,
      'illustrationUse',s.illustration_use,'sourceTerms',s.source_terms,
      'evidenceUrl',s.evidence_url,'notes',s.notes
    );
  ELSE
    NEW.source_facts:='{}'::jsonb;
  END IF;
  -- Editor+ can verify a source; this is not approval to perform a snapshot.
  IF NEW.verdict='approved' AND (
    NEW.source_id IS NULL
    OR s.identity_match <> 'confirmed'
    OR s.language_match <> 'matches'
    OR s.download_url IS NULL
    OR s.translation_status='unknown'
    OR (s.translation_status='original' AND (btrim(s.translator)<>'' OR s.translation_rights<>'not_applicable'))
    OR (s.translation_status='translated' AND (btrim(s.translator)='' OR s.translation_rights NOT IN ('public_domain','licensed')))
    OR s.original_rights NOT IN ('public_domain','licensed')
    OR s.translation_rights NOT IN ('not_applicable','public_domain','licensed')
    OR s.source_terms <> 'cleared'
    OR s.evidence_url IS NULL
    OR length(btrim(s.notes)) < 20
    OR length(btrim(NEW.rationale)) < 30
  ) THEN
    RAISE EXCEPTION 'legal_approval_missing_evidence_or_rights' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER artales_validate_legal_decision
  BEFORE INSERT ON public.candidate_legal_decisions
  FOR EACH ROW EXECUTE FUNCTION public.artales_validate_legal_decision();

REVOKE ALL ON FUNCTION public.artales_guard_approved_legal_source() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.artales_validate_legal_decision() FROM PUBLIC, anon;

-- Illustration entries are metadata; future authorized snapshot may copy only cleared assets.
CREATE TABLE public.candidate_legal_illustrations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_id uuid NOT NULL REFERENCES public.candidate_legal_sources(id) ON DELETE RESTRICT,
 asset_url text NOT NULL CHECK(length(asset_url)<=1000 AND asset_url ~ '^https://[^[:space:]]+$'),
 creator text NOT NULL DEFAULT '',
 evidence_url text CHECK(evidence_url IS NULL OR (length(evidence_url)<=1000 AND evidence_url ~ '^https://[^[:space:]]+$')),
 archive_rights text NOT NULL DEFAULT 'unknown' CHECK(archive_rights IN ('unknown','cleared','restricted')),
 publication_rights text NOT NULL DEFAULT 'unknown' CHECK(publication_rights IN ('unknown','cleared','restricted')),
 planned_use text NOT NULL DEFAULT 'exclude' CHECK(planned_use IN ('exclude','archive_only','publish')),
 notes text NOT NULL DEFAULT '',
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_id,asset_url),
 CONSTRAINT illustration_use_rights CHECK(
 planned_use='exclude'
 OR (planned_use='archive_only' AND archive_rights='cleared' AND evidence_url IS NOT NULL)
 OR (planned_use='publish' AND archive_rights='cleared' AND publication_rights='cleared' AND evidence_url IS NOT NULL))
);
ALTER TABLE public.candidate_legal_illustrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.candidate_legal_illustrations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.candidate_legal_illustrations TO authenticated;
GRANT INSERT(source_id,asset_url,creator,evidence_url,archive_rights,publication_rights,planned_use,notes,created_by)
 ON public.candidate_legal_illustrations TO authenticated;
CREATE POLICY illustration_editor_read ON public.candidate_legal_illustrations FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active AND p.role IN ('editor','admin')));
CREATE POLICY illustration_editor_insert ON public.candidate_legal_illustrations FOR INSERT TO authenticated WITH CHECK (
 created_by=(SELECT auth.uid()) AND NOT EXISTS (
  SELECT 1 FROM public.candidate_legal_locks l JOIN public.candidate_legal_sources s ON s.candidate_id=l.candidate_id
  WHERE s.id=source_id
 ) AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
 AND p.is_active AND p.role IN ('editor','admin')));

-- Snapshot is a different authority boundary: editors propose, admins approve.
-- This stage creates only an authorization handoff, never the snapshot artifact.
CREATE TABLE public.candidate_snapshot_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL REFERENCES public.candidate_legal_sources(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  proposed_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  CONSTRAINT snapshot_request_review_pair CHECK (
    (status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (status<>'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);
-- A candidate cannot have two open/approved handoffs at once.
CREATE UNIQUE INDEX candidate_snapshot_request_active_idx
  ON public.candidate_snapshot_requests(candidate_id)
  WHERE status IN ('pending','approved');
CREATE INDEX candidate_snapshot_request_candidate_idx
  ON public.candidate_snapshot_requests(candidate_id, created_at DESC);
ALTER TABLE public.candidate_snapshot_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.candidate_snapshot_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.candidate_snapshot_requests TO authenticated;
GRANT INSERT(candidate_id,source_id,proposed_by)
  ON public.candidate_snapshot_requests TO authenticated;
GRANT UPDATE(status,reviewed_by,reviewed_at)
  ON public.candidate_snapshot_requests TO authenticated;
CREATE POLICY snapshot_requests_editor_select ON public.candidate_snapshot_requests
  FOR SELECT TO authenticated USING(EXISTS(
    SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.is_active AND p.role IN ('admin','editor')
  ));
CREATE POLICY snapshot_requests_editor_propose ON public.candidate_snapshot_requests
  FOR INSERT TO authenticated WITH CHECK(
    status='pending' AND proposed_by=(SELECT auth.uid())
    AND reviewed_by IS NULL AND reviewed_at IS NULL
    AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.is_active AND p.role IN ('admin','editor'))
  );
CREATE POLICY snapshot_requests_admin_review ON public.candidate_snapshot_requests
  FOR UPDATE TO authenticated
  USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
    AND p.is_active AND p.role='admin'))
  WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
    AND p.is_active AND p.role='admin'));

CREATE FUNCTION public.artales_guard_snapshot_request()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE latest_verdict text; latest_source uuid;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD.status <> 'pending'
      OR NEW.status NOT IN ('approved','rejected')
      OR NEW.id IS DISTINCT FROM OLD.id
      OR NEW.candidate_id IS DISTINCT FROM OLD.candidate_id
      OR NEW.source_id IS DISTINCT FROM OLD.source_id
      OR NEW.proposed_by IS DISTINCT FROM OLD.proposed_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.reviewed_by IS DISTINCT FROM (SELECT auth.uid())
      OR NEW.reviewed_at IS NULL
      OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
        AND p.is_active AND p.role='admin') THEN
      RAISE EXCEPTION 'snapshot_review_admin_only_or_invalid' USING ERRCODE='42501';
    END IF;
  ELSIF NEW.proposed_by IS DISTINCT FROM (SELECT auth.uid()) OR NEW.status<>'pending' THEN
    RAISE EXCEPTION 'snapshot_proposal_editor_required' USING ERRCODE='42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(410726, pg_catalog.hashtext(NEW.candidate_id::text));
  IF NOT EXISTS(SELECT 1 FROM public.candidate_legal_sources s
     WHERE s.id=NEW.source_id AND s.candidate_id=NEW.candidate_id) THEN
    RAISE EXCEPTION 'snapshot_source_candidate_mismatch' USING ERRCODE='23503';
  END IF;
  -- A pending proposal may be rejected even after evidence is withdrawn.
  IF TG_OP='INSERT' OR NEW.status='approved' THEN
    SELECT d.verdict,d.source_id INTO latest_verdict,latest_source
      FROM public.candidate_legal_decisions d
      WHERE d.candidate_id=NEW.candidate_id
      ORDER BY d.decision_no DESC LIMIT 1;
    IF latest_verdict IS DISTINCT FROM 'approved'
      OR latest_source IS DISTINCT FROM NEW.source_id THEN
      RAISE EXCEPTION 'snapshot_requires_current_approved_screen'
        USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER artales_guard_snapshot_request_insert
  BEFORE INSERT ON public.candidate_snapshot_requests
  FOR EACH ROW EXECUTE FUNCTION public.artales_guard_snapshot_request();
CREATE TRIGGER artales_guard_snapshot_request_update
  BEFORE UPDATE ON public.candidate_snapshot_requests
  FOR EACH ROW EXECUTE FUNCTION public.artales_guard_snapshot_request();

REVOKE ALL ON FUNCTION public.artales_guard_snapshot_request() FROM PUBLIC,anon;


-- Immutable, editor-authorized handoff: exact source file + rights evidence and image manifest.
CREATE TABLE public.candidate_legal_locks (
 candidate_id uuid PRIMARY KEY REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
 source_id uuid NOT NULL REFERENCES public.candidate_legal_sources(id) ON DELETE RESTRICT,
 decision_no bigint NOT NULL UNIQUE REFERENCES public.candidate_legal_decisions(decision_no) ON DELETE RESTRICT,
 source_url text NOT NULL,
 download_url text NOT NULL,
 source_facts jsonb NOT NULL CHECK(jsonb_typeof(source_facts)='object'),
 illustrations jsonb NOT NULL CHECK(jsonb_typeof(illustrations)='array'),
 locked_by uuid NOT NULL REFERENCES public.profiles(id),
 locked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.candidate_legal_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.candidate_legal_locks FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.candidate_legal_locks TO authenticated;
GRANT INSERT(candidate_id,source_id,decision_no,source_url,download_url,source_facts,illustrations,locked_by)
 ON public.candidate_legal_locks TO authenticated;
CREATE POLICY legal_locks_read ON public.candidate_legal_locks FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active AND p.role IN ('editor','admin')));
CREATE POLICY legal_locks_insert ON public.candidate_legal_locks FOR INSERT TO authenticated WITH CHECK(
 locked_by=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
 AND p.is_active AND p.role IN ('editor','admin')));

CREATE FUNCTION public.artales_validate_legal_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE d record; src record; images jsonb;
BEGIN
 IF NEW.locked_by IS DISTINCT FROM (SELECT auth.uid()) THEN
  RAISE EXCEPTION 'legal_lock_identity' USING ERRCODE='42501';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(410726,pg_catalog.hashtext(NEW.candidate_id::text));
 PERFORM pg_catalog.pg_advisory_xact_lock(410725,pg_catalog.hashtext(NEW.source_id::text));
 SELECT * INTO d FROM public.candidate_legal_decisions
 WHERE candidate_id=NEW.candidate_id ORDER BY decision_no DESC LIMIT 1;
 IF NOT FOUND OR d.verdict <> 'approved' OR d.source_id IS DISTINCT FROM NEW.source_id
   OR d.decision_no IS DISTINCT FROM NEW.decision_no THEN
  RAISE EXCEPTION 'legal_lock_requires_latest_approval' USING ERRCODE='23514';
 END IF;
 SELECT * INTO src FROM public.candidate_legal_sources
 WHERE id=NEW.source_id AND candidate_id=NEW.candidate_id;
 IF NOT FOUND OR src.download_url IS NULL THEN
  RAISE EXCEPTION 'legal_lock_requires_file' USING ERRCODE='23514';
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'url',i.asset_url,'creator',i.creator,'evidence',i.evidence_url,
  'archiveRights',i.archive_rights,'publicationRights',i.publication_rights,
  'use',i.planned_use,'notes',i.notes) ORDER BY i.asset_url),'[]'::jsonb)
 INTO images FROM public.candidate_legal_illustrations i WHERE i.source_id=NEW.source_id;
 NEW.source_url:=src.source_url;
 NEW.download_url:=src.download_url;
 NEW.source_facts:=d.source_facts;
 NEW.illustrations:=images;
 RETURN NEW;
END
$fn$;
CREATE TRIGGER artales_validate_legal_lock BEFORE INSERT ON public.candidate_legal_locks
 FOR EACH ROW EXECUTE FUNCTION public.artales_validate_legal_lock();
REVOKE ALL ON FUNCTION public.artales_validate_legal_lock() FROM PUBLIC,anon;

COMMIT;
