-- Canonical migration for the audited Gutenberg uncertainty choice.
-- Apply before deploying the corresponding ARTales application release.
BEGIN;
CREATE TABLE IF NOT EXISTS public.candidate_legal_risk_acceptances (
 candidate_id uuid NOT NULL REFERENCES public.work_candidates(id),
 source_id uuid NOT NULL REFERENCES public.candidate_legal_sources(id),
 screening_decision_no bigint NOT NULL,
 accepted_by uuid NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT now(),
 uncertainties jsonb NOT NULL,
 CONSTRAINT artales_legal_risk_uncertainties_array CHECK (
   jsonb_typeof(uncertainties)='array' AND jsonb_array_length(uncertainties)>0
 ),
 PRIMARY KEY(candidate_id,source_id,screening_decision_no,accepted_by)
);
ALTER TABLE public.candidate_legal_risk_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.candidate_legal_risk_acceptances FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.candidate_legal_risk_acceptances TO authenticated;
DROP POLICY IF EXISTS artales_risk_read ON public.candidate_legal_risk_acceptances;
CREATE POLICY artales_risk_read ON public.candidate_legal_risk_acceptances
 FOR SELECT TO authenticated USING (
   (SELECT artales_private.can_progress_candidate(candidate_id))
 );
DROP POLICY IF EXISTS artales_risk_insert ON public.candidate_legal_risk_acceptances;
CREATE POLICY artales_risk_insert ON public.candidate_legal_risk_acceptances
 FOR INSERT TO authenticated WITH CHECK (
   accepted_by=(SELECT auth.uid())
   AND (SELECT artales_private.can_progress_candidate(candidate_id))
   AND EXISTS(
     SELECT 1 FROM public.candidate_legal_decisions d
     WHERE d.candidate_id=candidate_legal_risk_acceptances.candidate_id AND d.source_id=candidate_legal_risk_acceptances.source_id
       AND d.decision_no=candidate_legal_risk_acceptances.screening_decision_no AND d.verdict='needs_evidence'
       AND d.decision_no=(
         SELECT max(d2.decision_no) FROM public.candidate_legal_decisions d2
         WHERE d2.candidate_id=candidate_legal_risk_acceptances.candidate_id
       )
   )
   AND NOT EXISTS(
     SELECT 1 FROM public.candidate_legal_locks l WHERE l.candidate_id=candidate_legal_risk_acceptances.candidate_id
   )
 );
-- Keep existing approved-source immutability and row-level checks.
-- Only a recorded, identity-bound risk acceptance for the latest screening
-- may authorize a non-strict approval. Explicit prohibitions remain blockers.
CREATE OR REPLACE FUNCTION public.artales_validate_legal_decision()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $function$
DECLARE
 s record;
 strict_complete boolean;
 risk_consent boolean;
 audit jsonb;
BEGIN
 IF NEW.reviewed_by IS DISTINCT FROM (SELECT auth.uid()) THEN
   RAISE EXCEPTION 'legal_reviewer_mismatch' USING ERRCODE='42501';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(410726,pg_catalog.hashtext(NEW.candidate_id::text));
 IF EXISTS(SELECT 1 FROM public.candidate_legal_locks l WHERE l.candidate_id=NEW.candidate_id) THEN
   RAISE EXCEPTION 'legal_screen_locked' USING ERRCODE='23514';
 END IF;
 PERFORM 1 FROM public.work_candidates c WHERE c.id=NEW.candidate_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'legal_candidate_missing' USING ERRCODE='23503'; END IF;
 IF NEW.source_id IS NOT NULL THEN
   PERFORM pg_catalog.pg_advisory_xact_lock(410725,pg_catalog.hashtext(NEW.source_id::text));
   SELECT * INTO s FROM public.candidate_legal_sources
    WHERE id=NEW.source_id AND candidate_id=NEW.candidate_id;
   IF NOT FOUND THEN
     RAISE EXCEPTION 'legal_source_not_candidate' USING ERRCODE='23503';
   END IF;
   NEW.source_facts:=jsonb_build_object(
    'sourceId',s.id,'kind',s.source_kind,'edition',s.edition_title,
    'url',s.source_url,'downloadUrl',s.download_url,
    'translationStatus',s.translation_status,'readUrl',s.read_url,
    'year',s.edition_year,'language',s.language_code,
    'translator',s.translator,'illustrator',s.illustrator,
    'authorDied',s.author_died,'translatorDied',s.translator_died,
    'illustratorDied',s.illustrator_died,'identityMatch',s.identity_match,
    'languageMatch',s.language_match,'textFormat',s.text_format,
    'completeness',s.completeness,'textQuality',s.text_quality,
    'originalRights',s.original_rights,'translationRights',s.translation_rights,
    'illustrationUse',s.illustration_use,'sourceTerms',s.source_terms,
    'evidenceUrl',s.evidence_url,'notes',s.notes
   );
 ELSE
   NEW.source_facts:='{}'::jsonb;
 END IF;
 IF NEW.verdict='approved' THEN
   strict_complete:=NEW.source_id IS NOT NULL
     AND s.identity_match='confirmed' AND s.language_match='matches'
     AND s.download_url IS NOT NULL AND s.translation_status<>'unknown'
     AND (s.translation_status<>'original' OR (
       btrim(s.translator)='' AND s.translation_rights='not_applicable'))
     AND (s.translation_status<>'translated' OR (
       btrim(s.translator)<>'' AND s.translation_rights IN ('public_domain','licensed')))
     AND s.original_rights IN ('public_domain','licensed')
     AND s.translation_rights IN ('not_applicable','public_domain','licensed')
     AND s.source_terms='cleared'
     AND s.evidence_url IS NOT NULL
     AND length(btrim(s.notes))>=20
     AND length(btrim(NEW.rationale))>=30;
   IF strict_complete IS DISTINCT FROM TRUE THEN
     risk_consent:=false;
     BEGIN
       audit:=s.notes::jsonb;
       SELECT EXISTS(
         SELECT 1 FROM public.candidate_legal_risk_acceptances r
         WHERE r.candidate_id=NEW.candidate_id AND r.source_id=NEW.source_id
           AND r.accepted_by=NEW.reviewed_by
           AND r.screening_decision_no=(
             SELECT max(d.decision_no) FROM public.candidate_legal_decisions d
             WHERE d.candidate_id=NEW.candidate_id
           )
       ) INTO risk_consent;
     EXCEPTION WHEN others THEN
       risk_consent:=false;
     END;
     IF NOT coalesce(risk_consent,false) OR
       NEW.rationale NOT LIKE 'ARTALES_RISK_ACCEPTED_V1:%' OR
       s.source_kind IS DISTINCT FROM 'gutenberg' OR
       s.identity_match IS DISTINCT FROM 'confirmed' OR
       s.language_match IS DISTINCT FROM 'matches' OR
       s.text_format IS DISTINCT FROM 'epub' OR
       s.download_url IS NULL OR
       s.illustration_use IS DISTINCT FROM 'excluded' OR
       s.original_rights='restricted' OR s.translation_rights='restricted' OR
       s.source_terms='restricted' OR
       coalesce(audit->>'schema','')<>'artales.public-domain-check.v1' OR
       audit->'text'->>'status'='protected' OR
       audit->'translation'->>'status'='protected' OR
       audit->>'gutenbergUsStatus'='restricted' OR
       audit->>'sourceTextStatus'='possible_restriction' OR
       (audit->>'sourceTextNotice') IS NOT NULL OR
       EXISTS (
         SELECT 1 FROM pg_catalog.jsonb_array_elements(
           CASE WHEN pg_catalog.jsonb_typeof(audit->'text'->'people')='array'
            THEN audit->'text'->'people' ELSE '[]'::jsonb END
         ) AS person(value)
         WHERE (person.value->>'died')~'^[0-9]{4}
       length(btrim(NEW.rationale))<30 THEN
       RAISE EXCEPTION 'legal_approval_missing_evidence_or_rights' USING ERRCODE='23514';
     END IF;
   END IF;
 END IF;
 RETURN NEW;
END $function$;
COMMIT;

           AND (person.value->>'died')::integer + 70 >=
             EXTRACT(YEAR FROM pg_catalog.now())::integer
       ) OR
       EXISTS (
         SELECT 1 FROM pg_catalog.jsonb_array_elements(
           CASE WHEN pg_catalog.jsonb_typeof(audit->'translation'->'people')='array'
            THEN audit->'translation'->'people' ELSE '[]'::jsonb END
         ) AS person(value)
         WHERE (person.value->>'died')~'^[0-9]{4}
       length(btrim(NEW.rationale))<30 THEN
       RAISE EXCEPTION 'legal_approval_missing_evidence_or_rights' USING ERRCODE='23514';
     END IF;
   END IF;
 END IF;
 RETURN NEW;
END $function$;
COMMIT;

           AND (person.value->>'died')::integer + 70 >=
             EXTRACT(YEAR FROM pg_catalog.now())::integer
       ) OR
       length(btrim(NEW.rationale))<30 THEN
       RAISE EXCEPTION 'legal_approval_missing_evidence_or_rights' USING ERRCODE='23514';
     END IF;
   END IF;
 END IF;
 RETURN NEW;
END $function$;
