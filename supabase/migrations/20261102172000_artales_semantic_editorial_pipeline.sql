-- ARTales: candidate-bound semantic drafts, editorial work, and publication decisions.
-- Staged; append-only source/revisions. Apply only after isolated PostgreSQL role tests.
CREATE TABLE public.candidate_semantic_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 candidate_id uuid NOT NULL REFERENCES public.candidate_snapshots(candidate_id) ON DELETE RESTRICT,
 snapshot_sha256 text NOT NULL CHECK(snapshot_sha256 ~ '^[a-f0-9]{64}$'),
 revision_sha256 text NOT NULL UNIQUE CHECK(revision_sha256 ~ '^[a-f0-9]{64}$'),
 revision jsonb NOT NULL CHECK(revision->>'schema'='artales.semantic-text.v2'),
 source_text text NOT NULL CHECK(length(source_text)>0),
 component_id text NOT NULL,
 image_selection text NOT NULL CHECK(image_selection IN ('none','review_pending','cleared')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','qa_approved','rejected')),
 authored_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT semantic_revision_exact_snapshot FOREIGN KEY(candidate_id,snapshot_sha256)
 REFERENCES public.candidate_snapshots(candidate_id,sha256) ON DELETE RESTRICT,
 UNIQUE(candidate_id,revision_sha256)
);
CREATE INDEX candidate_semantic_latest_idx ON public.candidate_semantic_revisions(candidate_id,created_at DESC);
CREATE TABLE public.artales_editorial_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 candidate_id uuid NOT NULL REFERENCES public.candidate_semantic_revisions(candidate_id) ON DELETE RESTRICT,
 revision_sha256 text NOT NULL REFERENCES public.candidate_semantic_revisions(revision_sha256) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('text_review','visual_review','proofread')),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 3 AND 240),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','claimed','completed','returned')),
 assigned_to uuid REFERENCES public.profiles(id),
 completed_by uuid REFERENCES public.profiles(id),
 completed_at timestamptz,
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(candidate_id,revision_sha256,kind),
 CHECK((status='completed')=(completed_at IS NOT NULL AND completed_by IS NOT NULL))
);
CREATE TABLE public.artales_editorial_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 task_id uuid NOT NULL REFERENCES public.artales_editorial_tasks(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES public.profiles(id),
 action text NOT NULL CHECK(action IN ('created','claimed','returned','completed')),
 note text NOT NULL DEFAULT '',
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.candidate_release_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 candidate_id uuid NOT NULL REFERENCES public.candidate_semantic_revisions(candidate_id) ON DELETE RESTRICT,
 revision_sha256 text NOT NULL REFERENCES public.candidate_semantic_revisions(revision_sha256) ON DELETE RESTRICT,
 outcome text NOT NULL CHECK(outcome IN ('approved','held')),
 rationale text NOT NULL CHECK(length(btrim(rationale)) BETWEEN 30 AND 4000),
 decided_by uuid NOT NULL REFERENCES public.profiles(id),
 decided_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(candidate_id,revision_sha256,outcome)
);
ALTER TABLE public.candidate_semantic_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artales_editorial_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artales_editorial_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_release_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.candidate_semantic_revisions,public.artales_editorial_tasks,
 public.artales_editorial_events,public.candidate_release_decisions FROM anon,authenticated;
GRANT SELECT,INSERT ON public.candidate_semantic_revisions TO authenticated;
GRANT SELECT,INSERT ON public.artales_editorial_tasks TO authenticated;
GRANT SELECT,INSERT ON public.artales_editorial_events TO authenticated;
GRANT SELECT,INSERT ON public.candidate_release_decisions TO authenticated;
CREATE POLICY semantic_staff_read ON public.candidate_semantic_revisions FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active AND p.role::text IN ('admin','editor')));
CREATE POLICY semantic_admin_insert ON public.candidate_semantic_revisions FOR INSERT TO authenticated
 WITH CHECK(authored_by=(SELECT auth.uid()) AND status='draft' AND
 EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active AND p.role::text='admin')
 AND EXISTS(SELECT 1 FROM public.candidate_snapshot_reviews r
 WHERE r.candidate_id=candidate_semantic_revisions.candidate_id AND r.snapshot_sha256=candidate_semantic_revisions.snapshot_sha256
 AND r.text_correspondence='confirmed' AND r.image_disposition='exclude_all'
 AND r.id=(SELECT z.id FROM public.candidate_snapshot_reviews z WHERE z.candidate_id=r.candidate_id ORDER BY z.reviewed_at DESC,z.id DESC LIMIT 1)));
CREATE POLICY task_staff_read ON public.artales_editorial_tasks FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active AND p.role::text IN ('admin','editor')));
CREATE POLICY task_admin_insert ON public.artales_editorial_tasks FOR INSERT TO authenticated
 WITH CHECK(created_by=(SELECT auth.uid()) AND assigned_to IS NULL AND status='open' AND
 EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active AND p.role::text='admin')
 AND EXISTS(SELECT 1 FROM public.candidate_semantic_revisions r
 WHERE r.candidate_id=artales_editorial_tasks.candidate_id AND r.revision_sha256=artales_editorial_tasks.revision_sha256));
CREATE POLICY event_staff_read ON public.artales_editorial_events FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active AND p.role::text IN ('admin','editor')));
CREATE POLICY release_staff_read ON public.candidate_release_decisions FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active AND p.role::text IN ('admin','editor')));
-- Deliberately no client INSERT policy for editorial events or release decisions:
-- authorization transitions will be implemented by bounded SQL RPCs.

-- Task transitions are applied through a bounded invoker RPC, never by direct
-- generic UPDATE or a mutable "completed" checkbox in the UI.
CREATE FUNCTION public.artales_complete_editorial_task(p_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor uuid := auth.uid(); v_task public.artales_editorial_tasks%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor AND p.is_active AND p.role::text IN ('admin','editor'))
 THEN RAISE EXCEPTION 'editorial_access_denied' USING errcode='42501'; END IF;
 SELECT * INTO v_task FROM public.artales_editorial_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND OR v_task.status='completed' THEN RETURN jsonb_build_object('result','unavailable'); END IF;
 IF v_task.assigned_to IS NOT NULL AND v_task.assigned_to<>v_actor
 AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor AND p.role::text='admin' AND p.is_active)
 THEN RETURN jsonb_build_object('result','not_assignee'); END IF;
 UPDATE public.artales_editorial_tasks SET status='completed',completed_by=v_actor,completed_at=now()
 WHERE id=p_task_id;
 INSERT INTO public.artales_editorial_events(task_id,actor_id,action,note)
 VALUES(p_task_id,v_actor,'completed','Signed editorial review completion');
 RETURN jsonb_build_object('result','completed','task_id',p_task_id);
END $$;
REVOKE ALL ON FUNCTION public.artales_complete_editorial_task(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_complete_editorial_task(uuid) TO authenticated;
