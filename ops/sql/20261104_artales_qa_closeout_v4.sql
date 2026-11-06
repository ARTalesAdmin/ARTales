-- ARTales QA closeout after per-block review. DRAFT only.
BEGIN;
ALTER TABLE public.artales_editorial_tasks DROP CONSTRAINT IF EXISTS artales_editorial_tasks_status_check;
ALTER TABLE public.artales_editorial_tasks ADD CONSTRAINT artales_editorial_tasks_status_check
 CHECK(status IN ('open','claimed','completed','returned','superseded'));
ALTER TABLE public.artales_editorial_events DROP CONSTRAINT IF EXISTS artales_editorial_events_action_check;
ALTER TABLE public.artales_editorial_events ADD CONSTRAINT artales_editorial_events_action_check
 CHECK(action IN ('created','claimed','returned','completed','reassigned','superseded'));

CREATE OR REPLACE FUNCTION public.artales_guard_qa_review_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $gate$
BEGIN
 IF NEW.kind='text_review' AND NEW.status='completed' AND OLD.status<>'completed' THEN
  IF EXISTS(SELECT 1 FROM public.artales_semantic_qa_flags f WHERE f.candidate_id=NEW.candidate_id AND f.status='open')
  THEN RAISE EXCEPTION 'qa_unresolved_flags' USING errcode='23514'; END IF;
  IF EXISTS(
    SELECT 1 FROM public.candidate_semantic_revisions r
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(r.revision->'review_issues') AS issue(value)
    WHERE r.candidate_id=NEW.candidate_id AND r.revision_sha256=NEW.revision_sha256
     AND (issue.value->>'round')::int=(r.revision->>'round')::int
     AND NOT EXISTS(SELECT 1 FROM public.artales_semantic_change_reviews d
       WHERE d.candidate_id=r.candidate_id AND d.revision_sha256=r.revision_sha256
       AND d.issue_id=issue.value->>'id' AND d.decision='accepted')
  ) THEN RAISE EXCEPTION 'qa_changes_unreviewed' USING errcode='23514'; END IF;
 END IF;
 RETURN NEW;
END $gate$;
REVOKE ALL ON FUNCTION public.artales_guard_qa_review_completion() FROM PUBLIC,anon,authenticated;
DO $trigger$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgname='artales_qa_change_acceptance_gate'
  AND tgrelid='public.artales_editorial_tasks'::regclass) THEN
  CREATE TRIGGER artales_qa_change_acceptance_gate BEFORE UPDATE OF status
  ON public.artales_editorial_tasks FOR EACH ROW
  EXECUTE FUNCTION public.artales_guard_qa_review_completion();
 END IF;
END $trigger$;

CREATE OR REPLACE FUNCTION public.artales_finish_semantic_text_qa(
 p_task_id uuid,p_revision_sha text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $finish$
DECLARE v_actor uuid:=auth.uid();v_task public.artales_editorial_tasks%ROWTYPE;v_latest text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor AND p.is_active
   AND p.role::text IN ('admin','editor')) THEN
   RAISE EXCEPTION 'qa_editor_required' USING errcode='42501';END IF;
 SELECT * INTO v_task FROM public.artales_editorial_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND OR v_task.kind<>'text_review' OR v_task.status<>'claimed'
   OR v_task.assigned_to<>v_actor OR v_task.revision_sha256<>p_revision_sha
 THEN RETURN pg_catalog.jsonb_build_object('result','not_current_owner');END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_task.candidate_id::text)::bigint);
 SELECT revision_sha256 INTO v_latest FROM public.candidate_semantic_revisions
 WHERE candidate_id=v_task.candidate_id ORDER BY created_at DESC,id DESC LIMIT 1;
 IF v_latest<>p_revision_sha THEN RETURN pg_catalog.jsonb_build_object('result','stale_revision');END IF;
 IF EXISTS(SELECT 1 FROM public.artales_semantic_ai_qa_jobs j
   WHERE j.candidate_id=v_task.candidate_id AND j.revision_sha256=p_revision_sha
   AND j.status IN ('queued','running'))
 THEN RETURN pg_catalog.jsonb_build_object('result','ai_job_pending');END IF;
 IF EXISTS(SELECT 1 FROM public.artales_semantic_qa_flags f
   WHERE f.candidate_id=v_task.candidate_id AND f.status='open')
 THEN RETURN pg_catalog.jsonb_build_object('result','unresolved_flags');END IF;
 IF EXISTS(
  SELECT 1 FROM public.candidate_semantic_revisions r
   CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(r.revision->'review_issues') AS issue(value)
  WHERE r.candidate_id=v_task.candidate_id AND r.revision_sha256=p_revision_sha
   AND (issue.value->>'round')::int=(r.revision->>'round')::int
   AND NOT EXISTS(SELECT 1 FROM public.artales_semantic_change_reviews d
    WHERE d.candidate_id=r.candidate_id AND d.revision_sha256=r.revision_sha256
     AND d.issue_id=issue.value->>'id' AND d.decision='accepted')
 ) THEN RETURN pg_catalog.jsonb_build_object('result','changes_unreviewed');END IF;
 UPDATE public.artales_editorial_tasks
 SET status='completed',completed_by=v_actor,completed_at=now() WHERE id=v_task.id;
 INSERT INTO public.artales_editorial_events(task_id,actor_id,action,note)
 VALUES(v_task.id,v_actor,'completed','QA přijato; změny výslovně zkontrolovány.');
 RETURN pg_catalog.jsonb_build_object('result','completed','candidate_id',v_task.candidate_id);
END $finish$;
REVOKE ALL ON FUNCTION public.artales_finish_semantic_text_qa(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_finish_semantic_text_qa(uuid,text) TO authenticated;

COMMIT;
