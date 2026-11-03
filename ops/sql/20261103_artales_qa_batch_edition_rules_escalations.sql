-- ARTales QA v2. Bounded, explicit and reversible. No global UPDATE or DELETE.
BEGIN;

CREATE TABLE IF NOT EXISTS public.artales_work_typography_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 candidate_id uuid NOT NULL REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
 term text NOT NULL CHECK(length(btrim(term)) BETWEEN 2 AND 80 AND term ~ '^[[:alpha:]][[:alpha:] ''’-]{1,79}$'),
 rule_type text NOT NULL DEFAULT 'keep_together' CHECK(rule_type='keep_together'),
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(candidate_id,term)
);
ALTER TABLE public.artales_work_typography_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artales_work_typography_rules FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.artales_work_typography_rules TO authenticated;
CREATE POLICY artales_work_rules_staff_read ON public.artales_work_typography_rules FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
  AND p.is_active AND p.role::text IN ('admin','editor')));

CREATE TABLE IF NOT EXISTS public.artales_editorial_escalations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 context_path text NOT NULL CHECK(length(context_path) BETWEEN 8 AND 280
  AND context_path ~ '^/member/(semantic|authors|collections|works|editorial-pipeline)(/|$)'),
 subject text NOT NULL CHECK(length(btrim(subject)) BETWEEN 5 AND 160),
 details text NOT NULL CHECK(length(btrim(details)) BETWEEN 20 AND 4000),
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 assigned_to uuid NOT NULL REFERENCES public.profiles(id),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
 created_at timestamptz NOT NULL DEFAULT now(),
 resolved_by uuid REFERENCES public.profiles(id),
 resolved_at timestamptz,
 resolution_note text,
 CHECK((status='resolved')=(resolved_by IS NOT NULL AND resolved_at IS NOT NULL
  AND length(btrim(coalesce(resolution_note,'')))>=20))
);
ALTER TABLE public.artales_editorial_escalations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artales_editorial_escalations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.artales_editorial_escalations TO authenticated;
CREATE POLICY artales_escalations_visible_to_creator_or_admin
 ON public.artales_editorial_escalations FOR SELECT TO authenticated
 USING((SELECT auth.uid())=created_by OR (SELECT auth.uid())=assigned_to);

CREATE OR REPLACE FUNCTION public.artales_add_work_typography_rule(
 p_candidate_id uuid,p_term text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $rule$
DECLARE v_actor uuid:=auth.uid();v_term text;v_sha text;v_affected int;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor
  AND p.is_active AND p.role::text IN ('admin','editor')) THEN
  RAISE EXCEPTION 'qa_staff_required' USING errcode='42501';END IF;
 v_term:=btrim(p_term);
 IF v_term IS NULL OR length(v_term) NOT BETWEEN 2 AND 80 OR
    v_term !~ '^[[:alpha:]][[:alpha:] ''’-]{1,79}$' THEN
  RETURN pg_catalog.jsonb_build_object('result','invalid_term');END IF;
 SELECT revision_sha256 INTO v_sha FROM public.candidate_semantic_revisions
 WHERE candidate_id=p_candidate_id ORDER BY created_at DESC,id DESC LIMIT 1;
 IF v_sha IS NULL THEN RETURN pg_catalog.jsonb_build_object('result','revision_missing');END IF;
 SELECT count(*) INTO v_affected FROM pg_catalog.regexp_matches(
  (SELECT source_text FROM public.candidate_semantic_revisions
   WHERE candidate_id=p_candidate_id AND revision_sha256=v_sha),
  '(?i)(^|[^[:alpha:]])'||pg_catalog.regexp_replace(v_term,'([.\\*+?^$(){}|\\[\\]\\\\])','\\\\\1','g')||'([^[:alpha:]]|$)','g');
 IF v_affected<1 THEN RETURN pg_catalog.jsonb_build_object('result','term_not_in_work');END IF;
 INSERT INTO public.artales_work_typography_rules(candidate_id,term,created_by)
 VALUES(p_candidate_id,v_term,v_actor) ON CONFLICT(candidate_id,term) DO NOTHING;
 RETURN pg_catalog.jsonb_build_object('result','saved','occurrences',v_affected,'term',v_term);
END $rule$;
REVOKE ALL ON FUNCTION public.artales_add_work_typography_rule(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_add_work_typography_rule(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.artales_create_editorial_escalation(
 p_context_path text,p_subject text,p_details text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $help$
DECLARE v_actor uuid:=auth.uid();v_admin uuid;v_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor
  AND p.is_active AND p.role::text IN ('admin','editor')) THEN
  RAISE EXCEPTION 'qa_staff_required' USING errcode='42501';END IF;
 IF p_context_path IS NULL OR length(p_context_path) NOT BETWEEN 8 AND 280 OR
  p_context_path !~ '^/member/(semantic|authors|collections|works|editorial-pipeline)(/|$)' OR
  p_subject IS NULL OR length(btrim(p_subject)) NOT BETWEEN 5 AND 160 OR
  p_details IS NULL OR length(btrim(p_details)) NOT BETWEEN 20 AND 4000 THEN
  RETURN pg_catalog.jsonb_build_object('result','invalid_input');END IF;
 v_admin:=public.artales_editorial_owner('Luboš Žížlavský','admin');
 INSERT INTO public.artales_editorial_escalations(context_path,subject,details,created_by,assigned_to)
 VALUES(p_context_path,btrim(p_subject),btrim(p_details),v_actor,v_admin)
 RETURNING id INTO v_id;
 RETURN pg_catalog.jsonb_build_object('result','created','id',v_id);
END $help$;
REVOKE ALL ON FUNCTION public.artales_create_editorial_escalation(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_create_editorial_escalation(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.artales_resolve_editorial_escalation(
 p_id uuid,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $close$
DECLARE v_actor uuid:=auth.uid();v_count int;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor
  AND p.is_active AND p.role::text='admin') THEN
   RAISE EXCEPTION 'admin_required' USING errcode='42501';END IF;
 IF p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 20 AND 4000 THEN
  RETURN pg_catalog.jsonb_build_object('result','note_required');END IF;
 UPDATE public.artales_editorial_escalations SET status='resolved',resolved_by=v_actor,
 resolved_at=now(),resolution_note=btrim(p_note)
 WHERE id=p_id AND assigned_to=v_actor AND status='open';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN pg_catalog.jsonb_build_object('result',CASE WHEN v_count=1 THEN 'resolved' ELSE 'not_found' END);
END $close$;
REVOKE ALL ON FUNCTION public.artales_resolve_editorial_escalation(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_resolve_editorial_escalation(uuid,text) TO authenticated;

-- Atomic revision+audit+assigned reviewer. Only a tightly generated change set
-- from the authenticated server action may be committed, never arbitrary JSON.
CREATE OR REPLACE FUNCTION public.artales_commit_semantic_qa_batch(
 p_candidate_id uuid,p_parent_sha text,p_revision jsonb,p_flag_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $batch$
DECLARE v_actor uuid:=auth.uid();v_old public.candidate_semantic_revisions%ROWTYPE;
 v_new_sha text;v_count int;v_flags int;v_editor uuid;v_work text;
BEGIN
 -- The RPC accepts a complete JSON semantic document. Until a DB-side
 -- canonical SHA validator is implemented, only the project administrator may
 -- commit it. Editors still submit flags and receive the new review task.
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor
  AND p.is_active AND p.role::text='admin') THEN
  RAISE EXCEPTION 'qa_batch_admin_required' USING errcode='42501';END IF;
 IF p_parent_sha !~ '^[a-f0-9]{64}$' OR p_revision IS NULL OR
    pg_catalog.jsonb_typeof(p_revision)<>'object' OR
    p_flag_ids IS NULL OR pg_catalog.array_length(p_flag_ids,1) NOT BETWEEN 1 AND 50 OR
    (SELECT count(DISTINCT x) FROM pg_catalog.unnest(p_flag_ids) x)<>pg_catalog.array_length(p_flag_ids,1)
 THEN RETURN pg_catalog.jsonb_build_object('result','invalid_batch');END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_candidate_id::text)::bigint);
 SELECT * INTO v_old FROM public.candidate_semantic_revisions
 WHERE candidate_id=p_candidate_id ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR v_old.revision_sha256<>p_parent_sha THEN
  RETURN pg_catalog.jsonb_build_object('result','stale_revision');END IF;
 SELECT count(*) INTO v_flags FROM public.artales_semantic_qa_flags f
 WHERE f.candidate_id=p_candidate_id AND f.revision_sha256=p_parent_sha AND f.status='open'
 AND f.id=ANY(p_flag_ids);
 IF v_flags<>pg_catalog.array_length(p_flag_ids,1) THEN
  RETURN pg_catalog.jsonb_build_object('result','stale_or_missing_flags');END IF;
 v_new_sha:=p_revision->>'revision_sha256';
 IF v_new_sha IS NULL OR v_new_sha !~ '^[a-f0-9]{64}$' OR
  v_new_sha=p_parent_sha OR p_revision->>'revision_ref'<>'sha256:'||v_new_sha OR
  p_revision->>'parent_revision_ref'<>'sha256:'||p_parent_sha OR
  (p_revision->>'round')::int<>(v_old.revision->>'round')::int+1 OR
  p_revision->>'work_id'<>v_old.revision->>'work_id' OR
  p_revision->>'work_slug'<>v_old.revision->>'work_slug' OR
  p_revision->>'schema'<>'artales.semantic-text.v2' OR
  p_revision->'source'<>v_old.revision->'source' OR
  p_revision->'gaps'<>v_old.revision->'gaps' OR
  p_revision->>'state'<>'draft_qa_only' OR
  p_revision->'release_allowed'<>'false'::jsonb OR
  pg_catalog.jsonb_array_length(p_revision->'review_issues')<>
    pg_catalog.jsonb_array_length(v_old.revision->'review_issues')+v_flags THEN
  RETURN pg_catalog.jsonb_build_object('result','revision_proof_mismatch');END IF;
 SELECT title INTO v_work FROM public.artales_editorial_tasks
 WHERE candidate_id=p_candidate_id AND kind='text_review' ORDER BY created_at DESC LIMIT 1;
 SELECT assigned_to INTO v_editor FROM public.artales_editorial_tasks
 WHERE candidate_id=p_candidate_id AND kind='text_review' ORDER BY created_at DESC LIMIT 1;
 IF v_editor IS NULL THEN RETURN pg_catalog.jsonb_build_object('result','review_owner_missing');END IF;
 INSERT INTO public.candidate_semantic_revisions(candidate_id,snapshot_sha256,
  revision_sha256,revision,source_text,component_id,source_manifest,image_selection,status,authored_by)
 VALUES(p_candidate_id,v_old.snapshot_sha256,v_new_sha,p_revision,v_old.source_text,
  v_old.component_id,v_old.source_manifest,v_old.image_selection,'draft',v_actor);
 -- Trigger creates precisely one new text_review task and retains its owner.
 -- Any unaddressed open issues are carried to the exact new SHA.
 UPDATE public.artales_semantic_qa_flags SET status='resolved',resolved_by=v_actor,
   resolved_at=now(),
   resolution_note='Zpracováno dávkou do nové revize '||v_new_sha||
     '. Oprava čeká na nezávislé ověření původním editorem.'
 WHERE candidate_id=p_candidate_id AND revision_sha256=p_parent_sha AND status='open'
   AND id=ANY(p_flag_ids);
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_flags THEN RAISE EXCEPTION 'qa_batch_flag_race'; END IF;
 INSERT INTO public.artales_semantic_qa_flags(
  candidate_id,revision_sha256,target_atom_id,source_start,source_end,kind,comment,created_by)
 SELECT candidate_id,v_new_sha,target_atom_id,source_start,source_end,kind,comment,created_by
 FROM public.artales_semantic_qa_flags
 WHERE candidate_id=p_candidate_id AND revision_sha256=p_parent_sha AND status='open';
 IF NOT EXISTS(SELECT 1 FROM public.artales_editorial_tasks t
   WHERE t.candidate_id=p_candidate_id AND t.revision_sha256=v_new_sha
    AND t.kind='text_review' AND t.assigned_to=v_editor AND t.status='open') THEN
  RAISE EXCEPTION 'qa_batch_reviewer_assignment_failed';END IF;
 RETURN pg_catalog.jsonb_build_object('result','created','revision_sha256',v_new_sha,
  'review_assigned_to',v_editor,'changes',v_flags);
END $batch$;
REVOKE ALL ON FUNCTION public.artales_commit_semantic_qa_batch(uuid,text,jsonb,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_commit_semantic_qa_batch(uuid,text,jsonb,uuid[]) TO authenticated;
COMMIT;
