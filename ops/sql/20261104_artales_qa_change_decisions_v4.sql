-- ARTales QA decisions v4: proposed migration; never applied without approval.
BEGIN;
CREATE TABLE IF NOT EXISTS public.artales_semantic_change_reviews(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 candidate_id uuid NOT NULL REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
 revision_sha256 text NOT NULL REFERENCES public.candidate_semantic_revisions(revision_sha256) ON DELETE RESTRICT,
 issue_id text NOT NULL CHECK(length(issue_id) BETWEEN 1 AND 160),
 target_atom_id text NOT NULL CHECK(length(target_atom_id) BETWEEN 5 AND 160),
 decision text NOT NULL CHECK(decision IN ('accepted','returned')),
 note text,
 reviewed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 returned_flag_id uuid REFERENCES public.artales_semantic_qa_flags(id) ON DELETE RESTRICT,
 UNIQUE(candidate_id,revision_sha256,issue_id),
 CHECK((decision='accepted' AND note IS NULL AND returned_flag_id IS NULL)
  OR (decision='returned' AND length(btrim(coalesce(note,''))) BETWEEN 15 AND 4000 AND returned_flag_id IS NOT NULL))
);
ALTER TABLE public.artales_semantic_change_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artales_semantic_change_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.artales_semantic_change_reviews TO authenticated;
DROP POLICY IF EXISTS artales_semantic_change_reviews_staff ON public.artales_semantic_change_reviews;
CREATE POLICY artales_semantic_change_reviews_staff ON public.artales_semantic_change_reviews
 FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
  AND p.is_active AND p.role::text IN ('admin','editor'))
 AND (reviewed_by=(SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.profiles p
  WHERE p.id=(SELECT auth.uid()) AND p.is_active AND p.role::text='admin')
 OR EXISTS(SELECT 1 FROM public.artales_editorial_tasks t WHERE t.candidate_id=artales_semantic_change_reviews.candidate_id
  AND t.revision_sha256=artales_semantic_change_reviews.revision_sha256
  AND t.kind='text_review' AND t.assigned_to=(SELECT auth.uid())))
);
CREATE OR REPLACE FUNCTION public.artales_review_semantic_change(
 p_candidate_id uuid,p_revision_sha text,p_issue_id text,p_decision text,p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid();v_role text;v_revision public.candidate_semantic_revisions%ROWTYPE;
 v_issue jsonb;v_task public.artales_editorial_tasks%ROWTYPE;v_flag uuid;
BEGIN
 SELECT p.role::text INTO v_role FROM public.profiles p WHERE p.id=v_actor
  AND p.is_active AND p.role::text IN ('admin','editor');
 IF NOT FOUND THEN RAISE EXCEPTION 'qa_editor_required' USING errcode='42501';END IF;
 IF p_decision NOT IN ('accepted','returned') OR p_issue_id IS NULL OR
  length(p_issue_id) NOT BETWEEN 1 AND 160 OR
  (p_decision='returned' AND length(btrim(coalesce(p_note,''))) NOT BETWEEN 15 AND 4000)
 THEN RETURN pg_catalog.jsonb_build_object('result','invalid_verdict');END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_candidate_id::text)::bigint);
 SELECT * INTO v_revision FROM public.candidate_semantic_revisions
 WHERE candidate_id=p_candidate_id ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR v_revision.revision_sha256<>p_revision_sha
 THEN RETURN pg_catalog.jsonb_build_object('result','stale_revision');END IF;
 SELECT * INTO v_task FROM public.artales_editorial_tasks
 WHERE candidate_id=p_candidate_id AND revision_sha256=p_revision_sha AND kind='text_review' FOR UPDATE;
 IF NOT FOUND OR v_task.status<>'claimed' OR
  (v_task.assigned_to<>v_actor AND v_role<>'admin')
 THEN RETURN pg_catalog.jsonb_build_object('result','not_current_editor');END IF;
 SELECT i.value INTO v_issue FROM pg_catalog.jsonb_array_elements(v_revision.revision->'review_issues') AS i(value)
 WHERE i.value->>'id'=p_issue_id AND (i.value->>'round')::int=(v_revision.revision->>'round')::int LIMIT 1;
 IF v_issue IS NULL THEN RETURN pg_catalog.jsonb_build_object('result','unknown_change');END IF;
 IF EXISTS(SELECT 1 FROM public.artales_semantic_change_reviews
  WHERE candidate_id=p_candidate_id AND revision_sha256=p_revision_sha AND issue_id=p_issue_id)
 THEN RETURN pg_catalog.jsonb_build_object('result','already_reviewed');END IF;
 IF p_decision='returned' THEN
  INSERT INTO public.artales_semantic_qa_flags(
   candidate_id,revision_sha256,target_atom_id,source_start,source_end,kind,comment,created_by)
  VALUES(p_candidate_id,p_revision_sha,v_issue->>'target_atom_id',
   (v_issue#>>'{source_anchor,normalized_start}')::integer,
   (v_issue#>>'{source_anchor,normalized_end}')::integer,
   'typography',btrim(p_note),v_actor)
  RETURNING id INTO v_flag;
 END IF;
 INSERT INTO public.artales_semantic_change_reviews(
  candidate_id,revision_sha256,issue_id,target_atom_id,decision,note,reviewed_by,returned_flag_id)
 VALUES(p_candidate_id,p_revision_sha,p_issue_id,v_issue->>'target_atom_id',
  p_decision,CASE WHEN p_decision='returned' THEN btrim(p_note) ELSE NULL END,v_actor,v_flag);
 RETURN pg_catalog.jsonb_build_object('result',p_decision,'issue_id',p_issue_id);
END $$;
REVOKE ALL ON FUNCTION public.artales_review_semantic_change(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_review_semantic_change(uuid,text,text,text,text) TO authenticated;
COMMIT;
