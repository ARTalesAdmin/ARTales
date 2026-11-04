-- ARTales persistent AI QA proposal queue. DRAFT ONLY; separate production DB authorization required.
-- No source text or semantic revision is ever written by this queue.
BEGIN;
CREATE TABLE IF NOT EXISTS public.artales_semantic_ai_qa_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 candidate_id uuid NOT NULL REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
 revision_sha256 text NOT NULL REFERENCES public.candidate_semantic_revisions(revision_sha256) ON DELETE RESTRICT,
 created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 flag_ids uuid[] NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed')),
 suggestions jsonb,
 applied_revision_sha256 text REFERENCES public.candidate_semantic_revisions(revision_sha256) ON DELETE RESTRICT,
 error_code text,
 attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 2),
 created_at timestamptz NOT NULL DEFAULT now(),
 started_at timestamptz,
 finished_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(pg_catalog.cardinality(flag_ids) BETWEEN 1 AND 25),
 CHECK((status='completed')=(suggestions IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS artales_semantic_ai_jobs_pick_idx
 ON public.artales_semantic_ai_qa_jobs(status,created_at);
CREATE INDEX IF NOT EXISTS artales_semantic_ai_jobs_owner_idx
 ON public.artales_semantic_ai_qa_jobs(created_by,candidate_id,revision_sha256,created_at DESC);
ALTER TABLE public.artales_semantic_ai_qa_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artales_semantic_ai_qa_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.artales_semantic_ai_qa_jobs TO authenticated;
DROP POLICY IF EXISTS artales_ai_jobs_read_owner_admin ON public.artales_semantic_ai_qa_jobs;
CREATE POLICY artales_ai_jobs_read_owner_admin ON public.artales_semantic_ai_qa_jobs
 FOR SELECT TO authenticated USING(
  EXISTS(SELECT 1 FROM public.profiles p
   WHERE p.id=(SELECT auth.uid()) AND p.is_active
    AND p.role::text IN ('admin','editor'))
  AND (created_by=(SELECT auth.uid()) OR EXISTS(
   SELECT 1 FROM public.profiles admin_profile
   WHERE admin_profile.id=(SELECT auth.uid()) AND admin_profile.is_active
    AND admin_profile.role::text='admin'
  ))
 );

-- Request is identity-bound. Flag IDs are snapshotted; a different set must be regenerated.
-- A profile lock serializes duplicate requests and the 4-per-hour provider quota.
CREATE OR REPLACE FUNCTION public.artales_enqueue_ai_qa_job(
 p_candidate_id uuid,p_revision_sha256 text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $enqueue$
DECLARE v_actor uuid:=auth.uid();v_role text;v_current text;v_flags uuid[];v_job uuid;
BEGIN
 SELECT role::text INTO v_role FROM public.profiles p WHERE p.id=v_actor
  AND p.is_active AND p.role::text IN ('admin','editor') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'editorial_access_denied' USING errcode='42501'; END IF;
 IF p_revision_sha256 !~ '^[a-f0-9]{64}$' THEN
  RETURN pg_catalog.jsonb_build_object('result','invalid_sha');END IF;
 SELECT r.revision_sha256 INTO v_current FROM public.candidate_semantic_revisions r
 WHERE r.candidate_id=p_candidate_id
 ORDER BY r.created_at DESC,r.id DESC LIMIT 1;
 IF v_current IS NULL OR v_current<>p_revision_sha256 THEN
  RETURN pg_catalog.jsonb_build_object('result','stale_revision');END IF;
 IF v_role='editor' AND NOT EXISTS(
  SELECT 1 FROM public.artales_editorial_tasks t WHERE t.candidate_id=p_candidate_id
   AND t.revision_sha256=p_revision_sha256 AND t.kind='text_review'
   AND t.assigned_to=v_actor AND t.status='claimed'
 ) THEN RETURN pg_catalog.jsonb_build_object('result','not_assigned'); END IF;
 SELECT pg_catalog.array_agg(f.id ORDER BY f.id) INTO v_flags
 FROM public.artales_semantic_qa_flags f
 WHERE f.candidate_id=p_candidate_id AND f.revision_sha256=p_revision_sha256
  AND f.status='open';
 IF pg_catalog.cardinality(v_flags) IS NULL OR pg_catalog.cardinality(v_flags) NOT BETWEEN 1 AND 25
 THEN RETURN pg_catalog.jsonb_build_object('result','invalid_flag_count'); END IF;
 SELECT j.id INTO v_job FROM public.artales_semantic_ai_qa_jobs j
 WHERE j.created_by=v_actor AND j.candidate_id=p_candidate_id
  AND j.revision_sha256=p_revision_sha256 AND j.flag_ids=v_flags
  AND (j.status IN ('queued','running') OR
   (j.status='completed' AND j.created_at>now()-interval '10 minutes'))
 ORDER BY j.created_at DESC LIMIT 1;
 IF v_job IS NOT NULL THEN
  RETURN pg_catalog.jsonb_build_object('result','existing','job_id',v_job);END IF;
 IF (SELECT count(*) FROM public.artales_semantic_ai_qa_jobs j
    WHERE j.created_by=v_actor AND j.created_at>now()-interval '1 hour')>=4 THEN
  RETURN pg_catalog.jsonb_build_object('result','hourly_limit');END IF;
 INSERT INTO public.artales_semantic_ai_qa_jobs(
  candidate_id,revision_sha256,created_by,flag_ids)
 VALUES(p_candidate_id,p_revision_sha256,v_actor,v_flags) RETURNING id INTO v_job;
 RETURN pg_catalog.jsonb_build_object('result','queued','job_id',v_job);
END $enqueue$;
REVOKE ALL ON FUNCTION public.artales_enqueue_ai_qa_job(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_enqueue_ai_qa_job(uuid,text) TO authenticated;

-- Service-role-only worker queue claim. A row lock prevents double-processing.
CREATE OR REPLACE FUNCTION public.artales_claim_ai_qa_job()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $claim$
DECLARE v_job public.artales_semantic_ai_qa_jobs%ROWTYPE;
BEGIN
 IF current_setting('request.jwt.claim.role',true)<>'service_role' THEN
  RAISE EXCEPTION 'service_worker_only' USING errcode='42501'; END IF;
 -- A previously claimed job is retried at most once if the server died.
 UPDATE public.artales_semantic_ai_qa_jobs SET status='queued',updated_at=now()
 WHERE status='running' AND started_at<now()-interval '3 minutes' AND attempt_count<2;
 UPDATE public.artales_semantic_ai_qa_jobs SET status='failed',error_code='worker_timeout',
  finished_at=now(),updated_at=now()
 WHERE status='running' AND started_at<now()-interval '3 minutes' AND attempt_count>=2;
 SELECT * INTO v_job FROM public.artales_semantic_ai_qa_jobs j
 WHERE j.status='queued' ORDER BY j.created_at,j.id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('result','empty'); END IF;
 UPDATE public.artales_semantic_ai_qa_jobs SET status='running',
  attempt_count=attempt_count+1,started_at=now(),updated_at=now()
 WHERE id=v_job.id;
 RETURN pg_catalog.jsonb_build_object('result','claimed',
  'job_id',v_job.id,'candidate_id',v_job.candidate_id,
  'revision_sha256',v_job.revision_sha256,'created_by',v_job.created_by,
  'flag_ids',pg_catalog.to_jsonb(v_job.flag_ids));
END $claim$;
REVOKE ALL ON FUNCTION public.artales_claim_ai_qa_job() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_claim_ai_qa_job() TO service_role;

-- Worker stores only reviewed suggestion proposals. Complete status is immutable.
CREATE OR REPLACE FUNCTION public.artales_finish_ai_qa_job(
 p_job_id uuid,p_suggestions jsonb,p_error_code text,p_applied_revision_sha text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $finish$
DECLARE v_job public.artales_semantic_ai_qa_jobs%ROWTYPE;v_count integer;
BEGIN
 IF current_setting('request.jwt.claim.role',true)<>'service_role' THEN
  RAISE EXCEPTION 'service_worker_only' USING errcode='42501'; END IF;
 SELECT * INTO v_job FROM public.artales_semantic_ai_qa_jobs WHERE id=p_job_id FOR UPDATE;
 IF NOT FOUND OR v_job.status<>'running' THEN
  RETURN pg_catalog.jsonb_build_object('result','unavailable');END IF;
 IF p_error_code IS NULL THEN
  IF p_suggestions IS NULL OR pg_catalog.jsonb_typeof(p_suggestions)<>'array'
   OR pg_catalog.jsonb_array_length(p_suggestions)<>pg_catalog.cardinality(v_job.flag_ids)
  THEN RETURN pg_catalog.jsonb_build_object('result','invalid_result');END IF;
  SELECT count(*) INTO v_count FROM pg_catalog.jsonb_array_elements(p_suggestions) x
  WHERE x->>'action' IN ('compact','airy','center','protect_term','manual_review')
   AND (x->>'flagId') IN (
    SELECT f::text FROM pg_catalog.unnest(v_job.flag_ids) f
   );
  IF v_count<>pg_catalog.cardinality(v_job.flag_ids) OR
   (SELECT count(DISTINCT x->>'flagId') FROM pg_catalog.jsonb_array_elements(p_suggestions) x)
      <>pg_catalog.cardinality(v_job.flag_ids) THEN
   RETURN pg_catalog.jsonb_build_object('result','invalid_result');END IF;
  IF p_applied_revision_sha IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.candidate_semantic_revisions r
   WHERE r.candidate_id=v_job.candidate_id AND r.revision_sha256=p_applied_revision_sha
    AND r.revision->>'parent_revision_ref'='sha256:'||v_job.revision_sha256)
  THEN RETURN pg_catalog.jsonb_build_object('result','invalid_applied_revision');END IF;
  UPDATE public.artales_semantic_ai_qa_jobs SET status='completed',
   suggestions=p_suggestions,applied_revision_sha256=p_applied_revision_sha,
   updated_at=now(),finished_at=now() WHERE id=p_job_id;
 ELSE
  UPDATE public.artales_semantic_ai_qa_jobs SET status='failed',
   error_code=left(p_error_code,100),updated_at=now(),finished_at=now() WHERE id=p_job_id;
 END IF;
 RETURN pg_catalog.jsonb_build_object('result','stored');
END $finish$;
REVOKE ALL ON FUNCTION public.artales_finish_ai_qa_job(uuid,jsonb,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_finish_ai_qa_job(uuid,jsonb,text,text) TO service_role;
COMMIT;
