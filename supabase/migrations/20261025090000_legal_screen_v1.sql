-- Legal Screen v1. Explicitly source-only: DO NOT APPLY in production until separately authorized.
-- No fetched full texts, no Works/Reader/Composer mutation, no rights_status changes.
BEGIN;

CREATE TABLE public.candidate_legal_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
  source_kind text NOT NULL CHECK (source_kind IN ('open_library','gutenberg','library','other')),
  edition_title text NOT NULL CHECK (length(btrim(edition_title)) BETWEEN 1 AND 300),
  source_url text NOT NULL CHECK (length(source_url) <= 1000 AND source_url ~ '^https://[^[:space:]]+$'),
  read_url text CHECK (read_url IS NULL OR (length(read_url) <= 1000 AND read_url ~ '^https://[^[:space:]]+$')),
  edition_year integer CHECK (edition_year IS NULL OR edition_year BETWEEN 1400 AND 2100),
  language_code text NOT NULL DEFAULT '' CHECK (length(language_code) <= 30),
  translator text NOT NULL DEFAULT '' CHECK (length(translator) <= 300),
  illustrator text NOT NULL DEFAULT '' CHECK (length(illustrator) <= 300),
  original_rights text NOT NULL DEFAULT 'unknown'
    CHECK (original_rights IN ('unknown','public_domain','licensed','restricted')),
  translation_rights text NOT NULL DEFAULT 'unknown'
    CHECK (translation_rights IN ('unknown','not_applicable','public_domain','licensed','restricted')),
  illustration_use text NOT NULL DEFAULT 'excluded'
    CHECK (illustration_use IN ('excluded','unknown','public_domain','licensed','restricted')),
  source_terms text NOT NULL DEFAULT 'unknown'
    CHECK (source_terms IN ('unknown','cleared','restricted')),
  evidence_url text CHECK (evidence_url IS NULL OR (length(evidence_url) <= 1000 AND evidence_url ~ '^https://[^[:space:]]+$')),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 5000),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  updated_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_legal_sources_unique_source UNIQUE(candidate_id, source_url)
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
GRANT INSERT(candidate_id,source_kind,edition_title,source_url,read_url,edition_year,language_code,
  translator,illustrator,original_rights,translation_rights,illustration_use,source_terms,
  evidence_url,notes,created_by,updated_by) ON public.candidate_legal_sources TO authenticated;
GRANT UPDATE(source_kind,edition_title,source_url,read_url,edition_year,language_code,
  translator,illustrator,original_rights,translation_rights,illustration_use,source_terms,
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
        (p.role='admin')
        OR (p.role='editor' AND verdict IN ('deferred','needs_evidence'))
      ))
    AND EXISTS(SELECT 1 FROM public.work_candidates c WHERE c.id=candidate_id)
  );

-- Freeze an edition that was ever approved: its recorded legal basis must not drift.
CREATE FUNCTION public.artales_guard_approved_legal_source()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
BEGIN
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
  -- Serialize decisions per candidate to avoid simultaneous contradictory approvals.
  PERFORM 1 FROM public.work_candidates c WHERE c.id=NEW.candidate_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'legal_candidate_missing' USING ERRCODE='23503'; END IF;
  IF NEW.source_id IS NOT NULL THEN
    SELECT * INTO s FROM public.candidate_legal_sources
      WHERE id=NEW.source_id AND candidate_id=NEW.candidate_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'legal_source_not_candidate' USING ERRCODE='23503';
    END IF;
    NEW.source_facts:=jsonb_build_object(
      'sourceId',s.id,'kind',s.source_kind,'edition',s.edition_title,
      'url',s.source_url,'readUrl',s.read_url,'year',s.edition_year,
      'language',s.language_code,'translator',s.translator,'illustrator',s.illustrator,
      'originalRights',s.original_rights,'translationRights',s.translation_rights,
      'illustrationUse',s.illustration_use,'sourceTerms',s.source_terms,
      'evidenceUrl',s.evidence_url,'notes',s.notes
    );
  ELSE
    NEW.source_facts:='{}'::jsonb;
  END IF;
  IF NEW.verdict IN ('approved','rejected') AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.is_active AND p.role='admin'
  ) THEN
    RAISE EXCEPTION 'legal_final_verdict_admin_only' USING ERRCODE='42501';
  END IF;
  IF NEW.verdict='approved' AND (
    NEW.source_id IS NULL
    OR s.original_rights NOT IN ('public_domain','licensed')
    OR s.translation_rights NOT IN ('not_applicable','public_domain','licensed')
    OR s.illustration_use <> 'excluded'
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

COMMIT;
