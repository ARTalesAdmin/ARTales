-- ARTales semantic QA v1. Scope: persistent block flags + automatic editorial tasks.
-- Apply directly to production with an authorized SQL editor; existing revisions and publications stay immutable.
BEGIN;

CREATE TABLE IF NOT EXISTS public.artales_semantic_qa_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
  revision_sha256 text NOT NULL REFERENCES public.candidate_semantic_revisions(revision_sha256) ON DELETE RESTRICT,
  target_atom_id text NOT NULL CHECK(length(target_atom_id) BETWEEN 5 AND 160),
  source_start integer NOT NULL CHECK(source_start>=0),
  source_end integer NOT NULL CHECK(source_end>source_start),
  kind text NOT NULL CHECK(kind IN ('text','typography','structure','image','other')),
  comment text NOT NULL CHECK(length(btrim(comment)) BETWEEN 15 AND 4000),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid REFERENCES public.profiles(id),
  resolved_at timestamptz,
  resolution_note text,
  CHECK ((status='resolved')=(resolved_by IS NOT NULL AND resolved_at IS NOT NULL
    AND length(btrim(coalesce(resolution_note,'')))>=30))
);
CREATE INDEX IF NOT EXISTS artales_semantic_qa_flags_revision_idx
  ON public.artales_semantic_qa_flags(candidate_id,revision_sha256,status,created_at);
CREATE INDEX IF NOT EXISTS artales_semantic_qa_flags_open_idx
  ON public.artales_semantic_qa_flags(candidate_id,status);

ALTER TABLE public.artales_semantic_qa_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artales_semantic_qa_flags FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.artales_semantic_qa_flags TO authenticated;

DROP POLICY IF EXISTS artales_semantic_flags_staff_select ON public.artales_semantic_qa_flags;
CREATE POLICY artales_semantic_flags_staff_select ON public.artales_semantic_qa_flags
 FOR SELECT TO authenticated USING(EXISTS (
   SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
     AND p.is_active AND p.role::text IN ('admin','editor')
 ));
DROP POLICY IF EXISTS artales_semantic_flags_staff_insert ON public.artales_semantic_qa_flags;
CREATE POLICY artales_semantic_flags_staff_insert ON public.artales_semantic_qa_flags
 FOR INSERT TO authenticated WITH CHECK(
  created_by=(SELECT auth.uid()) AND status='open' AND resolved_by IS NULL AND resolved_at IS NULL
  AND resolution_note IS NULL
  AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
   AND p.is_active AND p.role::text IN ('admin','editor'))
  AND EXISTS(SELECT 1 FROM public.candidate_semantic_revisions r
   WHERE r.candidate_id=artales_semantic_qa_flags.candidate_id
     AND r.revision_sha256=artales_semantic_qa_flags.revision_sha256
     AND r.id=(SELECT latest.id FROM public.candidate_semantic_revisions latest
       WHERE latest.candidate_id=r.candidate_id ORDER BY latest.created_at DESC,latest.id DESC LIMIT 1)
     AND (
       pg_catalog.jsonb_path_exists(r.revision,
        '$.blocks.**.atom ? (@.id == $atom && @.anchor.normalized_start == $start && @.anchor.normalized_end == $end)'::jsonpath,
        pg_catalog.jsonb_build_object('atom',artales_semantic_qa_flags.target_atom_id,
          'start',artales_semantic_qa_flags.source_start,'end',artales_semantic_qa_flags.source_end))
       OR pg_catalog.jsonb_path_exists(r.revision,
        '$.blocks.**.heading ? (@.id == $atom && @.anchor.normalized_start == $start && @.anchor.normalized_end == $end)'::jsonpath,
        pg_catalog.jsonb_build_object('atom',artales_semantic_qa_flags.target_atom_id,
          'start',artales_semantic_qa_flags.source_start,'end',artales_semantic_qa_flags.source_end))
     ))
 );

-- R0/R1 staff flag closure: require a recorded reason, never silent direct UPDATE.
CREATE OR REPLACE FUNCTION public.artales_resolve_semantic_qa_flag(p_flag_id uuid,p_resolution_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid := auth.uid();v_flag public.artales_semantic_qa_flags%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor
   AND p.is_active AND p.role::text IN ('admin','editor')) THEN
   RAISE EXCEPTION 'qa_staff_required' USING errcode='42501';
 END IF;
 IF p_resolution_note IS NULL OR length(btrim(p_resolution_note)) NOT BETWEEN 30 AND 4000 THEN
   RETURN pg_catalog.jsonb_build_object('result','resolution_note_required');
 END IF;
 SELECT * INTO v_flag FROM public.artales_semantic_qa_flags WHERE id=p_flag_id FOR UPDATE;
 IF NOT FOUND OR v_flag.status<>'open' THEN
   RETURN pg_catalog.jsonb_build_object('result','not_open');
 END IF;
 UPDATE public.artales_semantic_qa_flags SET status='resolved',resolved_by=v_actor,
   resolved_at=now(),resolution_note=btrim(p_resolution_note) WHERE id=v_flag.id;
 RETURN pg_catalog.jsonb_build_object('result','resolved','flag_id',v_flag.id);
END $$;
REVOKE ALL ON FUNCTION public.artales_resolve_semantic_qa_flag(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_resolve_semantic_qa_flag(uuid,text) TO authenticated;

-- Editors can explicitly return their assigned review for a second opinion.
-- A returned task is again available in the existing claim inbox.
CREATE OR REPLACE FUNCTION public.artales_request_semantic_second_review(p_task_id uuid,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid();v_task public.artales_editorial_tasks%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p
   WHERE p.id=v_actor AND p.is_active AND p.role::text IN ('admin','editor')) THEN
  RAISE EXCEPTION 'editorial_access_denied' USING errcode='42501'; END IF;
 IF p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 40 AND 4000 THEN
  RETURN pg_catalog.jsonb_build_object('result','reason_required'); END IF;
 SELECT * INTO v_task FROM public.artales_editorial_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND OR v_task.status<>'claimed' OR (v_task.assigned_to<>v_actor AND
  NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor
  AND p.is_active AND p.role::text='admin')) THEN
  RETURN pg_catalog.jsonb_build_object('result','unavailable'); END IF;
 UPDATE public.artales_editorial_tasks SET status='returned',assigned_to=NULL
  WHERE id=p_task_id;
 INSERT INTO public.artales_editorial_events(task_id,actor_id,action,note)
 VALUES(p_task_id,v_actor,'returned',btrim(p_note));
 RETURN pg_catalog.jsonb_build_object('result','returned','task_id',p_task_id);
END $$;
REVOKE ALL ON FUNCTION public.artales_request_semantic_second_review(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_request_semantic_second_review(uuid,text) TO authenticated;

-- No editor manually creates tasks: every new immutable draft emits 3 distinct
-- role-based review tasks in the existing staff inbox. Caller is an admin as
-- required by candidate_semantic_revisions INSERT RLS. Invoker respects task INSERT RLS.
CREATE OR REPLACE FUNCTION public.artales_auto_enqueue_semantic_tasks()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.status='draft' THEN
  INSERT INTO public.artales_editorial_tasks(candidate_id,revision_sha256,kind,title,created_by)
  SELECT NEW.candidate_id,NEW.revision_sha256,v.kind,v.label||' — '||NEW.candidate_id::text,NEW.authored_by
  FROM (VALUES ('text_review','Kontrola textu'),('visual_review','Kontrola vizuálu'),
    ('proofread','Korektury')) AS v(kind,label)
  ON CONFLICT(candidate_id,revision_sha256,kind) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.artales_auto_enqueue_semantic_tasks() FROM PUBLIC,anon,authenticated;

DO $do$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.candidate_semantic_revisions'::regclass
   AND tgname='artales_semantic_auto_tasks_after_insert') THEN
  CREATE TRIGGER artales_semantic_auto_tasks_after_insert
   AFTER INSERT ON public.candidate_semantic_revisions FOR EACH ROW
   EXECUTE FUNCTION public.artales_auto_enqueue_semantic_tasks();
 END IF;
END $do$;

-- A QA flag stops premature completion of any task; the task owner must first
-- obtain a corrected revision or record a reviewable reason for dismissal.
CREATE OR REPLACE FUNCTION public.artales_block_unresolved_semantic_qa()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='artales_editorial_tasks' AND NEW.status='completed' AND OLD.status<>'completed'
    AND EXISTS(SELECT 1 FROM public.artales_semantic_qa_flags f
      WHERE f.candidate_id=NEW.candidate_id AND f.status='open') THEN
   RAISE EXCEPTION 'qa_unresolved_flags' USING errcode='23514';
 END IF;
 IF TG_TABLE_NAME='artales_semantic_publications' AND
    EXISTS(SELECT 1 FROM public.artales_semantic_qa_flags f
      WHERE f.candidate_id=NEW.candidate_id AND f.status='open') THEN
   RAISE EXCEPTION 'release_unresolved_qa_flags' USING errcode='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.artales_block_unresolved_semantic_qa() FROM PUBLIC,anon,authenticated;
DO $do$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.artales_editorial_tasks'::regclass
   AND tgname='artales_semantic_block_task_completion') THEN
  CREATE TRIGGER artales_semantic_block_task_completion BEFORE UPDATE OF status
   ON public.artales_editorial_tasks FOR EACH ROW
   EXECUTE FUNCTION public.artales_block_unresolved_semantic_qa();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.artales_semantic_publications'::regclass
   AND tgname='artales_semantic_block_unresolved_publication') THEN
  CREATE TRIGGER artales_semantic_block_unresolved_publication BEFORE INSERT
   ON public.artales_semantic_publications FOR EACH ROW
   EXECUTE FUNCTION public.artales_block_unresolved_semantic_qa();
 END IF;
END $do$;

-- Existing #389: tasks are system-generated from the archived, hashed revision.
-- Explicit known candidate; no global write or deletion.
INSERT INTO public.artales_editorial_tasks(candidate_id,revision_sha256,kind,title,created_by)
SELECT r.candidate_id,r.revision_sha256,v.kind,v.label||' — '||r.candidate_id::text,r.authored_by
FROM public.candidate_semantic_revisions r
CROSS JOIN (VALUES ('text_review','Kontrola textu'),('visual_review','Kontrola vizuálu'),
  ('proofread','Korektury')) AS v(kind,label)
WHERE r.candidate_id='98508359-bce1-4e73-b842-b69a9d1112d0'::uuid
 AND r.id=(SELECT x.id FROM public.candidate_semantic_revisions x
 WHERE x.candidate_id=r.candidate_id ORDER BY x.created_at DESC,x.id DESC LIMIT 1)
ON CONFLICT(candidate_id,revision_sha256,kind) DO NOTHING;
COMMIT;
