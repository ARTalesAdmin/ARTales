-- ARTales editorial pool v3. Forward-only proposal; NEVER run without separate DB authorization.
-- Scope: capability-based availability, one-claim ownership, voluntary release, admin reassignment, audit.
-- Existing completed tasks and semantic source bytes are never modified.
BEGIN;

CREATE TABLE IF NOT EXISTS public.artales_editorial_capabilities (
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('text_review','work_description','author_bio',
  'cover_art','author_visual','collection_curation','second_review',
  'visual_review','proofread')),
 granted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(profile_id,kind)
);
ALTER TABLE public.artales_editorial_capabilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artales_editorial_capabilities FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.artales_editorial_capabilities TO authenticated;
DROP POLICY IF EXISTS artales_capability_owner_or_admin_read ON public.artales_editorial_capabilities;
CREATE POLICY artales_capability_owner_or_admin_read ON public.artales_editorial_capabilities
 FOR SELECT TO authenticated USING (
 profile_id=(SELECT auth.uid()) OR EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
   AND p.is_active AND p.role::text='admin'
 )
);

CREATE TABLE IF NOT EXISTS public.artales_editorial_default_owners (
 kind text PRIMARY KEY CHECK(kind IN ('cover_art','author_visual','collection_curation')),
 assigned_to uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT
);
ALTER TABLE public.artales_editorial_default_owners ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artales_editorial_default_owners FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.artales_editorial_default_owners TO authenticated;
DROP POLICY IF EXISTS artales_editorial_defaults_staff_read ON public.artales_editorial_default_owners;
CREATE POLICY artales_editorial_defaults_staff_read ON public.artales_editorial_default_owners
 FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
   AND p.is_active AND p.role::text IN ('admin','editor')
 ));

-- Explicit initial competencies. Adding a new editor later is an administrative decision,
-- not an automatic consequence of having the editor role.
INSERT INTO public.artales_editorial_capabilities(profile_id,kind)
SELECT public.artales_editorial_owner('Pavla Kratochvílová','editor'),k.kind
FROM (VALUES ('text_review'),('work_description'),('author_bio'),('second_review'),('proofread')) k(kind)
ON CONFLICT DO NOTHING;
INSERT INTO public.artales_editorial_capabilities(profile_id,kind)
SELECT public.artales_editorial_owner('Ivana Svobodová','editor'),k.kind
FROM (VALUES ('text_review'),('work_description'),('author_bio'),('second_review'),
 ('proofread'),('cover_art'),('author_visual'),('collection_curation'),('visual_review')) k(kind)
ON CONFLICT DO NOTHING;
INSERT INTO public.artales_editorial_default_owners(kind,assigned_to)
SELECT k.kind,public.artales_editorial_owner('Ivana Svobodová','editor')
FROM (VALUES ('cover_art'),('author_visual'),('collection_curation')) k(kind)
ON CONFLICT(kind) DO NOTHING;

-- Editors only see their assignments and unclaimed work for which they have a competency.
-- The admin retains complete oversight. Application filtering alone is insufficient.
DROP POLICY IF EXISTS task_staff_read ON public.artales_editorial_tasks;
CREATE POLICY task_staff_read ON public.artales_editorial_tasks
 FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.profiles p
   WHERE p.id=(SELECT auth.uid()) AND p.is_active AND p.role::text='admin')
  OR (
   EXISTS(SELECT 1 FROM public.profiles p
    WHERE p.id=(SELECT auth.uid()) AND p.is_active AND p.role::text='editor')
   AND (
    assigned_to=(SELECT auth.uid())
    OR (assigned_to IS NULL AND status IN ('open','returned')
     AND EXISTS(SELECT 1 FROM public.artales_editorial_capabilities c
      WHERE c.profile_id=(SELECT auth.uid()) AND c.kind=artales_editorial_tasks.kind))
   )
  )
 );
CREATE INDEX IF NOT EXISTS artales_editorial_tasks_owner_status_idx
 ON public.artales_editorial_tasks(assigned_to,status,kind);

-- Every transfer keeps both endpoints. Never count a transfer as completed work.
ALTER TABLE public.artales_editorial_events
 ADD COLUMN IF NOT EXISTS from_assignee uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS to_assignee uuid REFERENCES public.profiles(id) ON DELETE RESTRICT;
ALTER TABLE public.artales_editorial_events
 DROP CONSTRAINT IF EXISTS artales_editorial_events_action_check;
ALTER TABLE public.artales_editorial_events
 ADD CONSTRAINT artales_editorial_events_action_check
 CHECK(action IN ('created','claimed','returned','completed','reassigned'));
DROP POLICY IF EXISTS event_staff_read ON public.artales_editorial_events;
CREATE POLICY event_staff_read ON public.artales_editorial_events
 FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
   AND p.is_active AND p.role::text='admin')
  OR (
   EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
    AND p.is_active AND p.role::text='editor')
   AND (actor_id=(SELECT auth.uid()) OR from_assignee=(SELECT auth.uid())
    OR to_assignee=(SELECT auth.uid()) OR EXISTS (
      SELECT 1 FROM public.artales_editorial_tasks t
      WHERE t.id=artales_editorial_events.task_id
       AND t.assigned_to=(SELECT auth.uid())
    ))
  )
 );
CREATE INDEX IF NOT EXISTS artales_editorial_events_task_time_idx
 ON public.artales_editorial_events(task_id,occurred_at);

-- One database row lock protects the whole claim, including the person's optional QA capacity.
-- Other staff cannot claim a claimed task. A fixed assignment cannot be stolen.
CREATE OR REPLACE FUNCTION public.artales_claim_editorial_task(p_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $claim$
DECLARE v_actor uuid:=auth.uid();v_task public.artales_editorial_tasks%ROWTYPE;v_role text;
BEGIN
 SELECT p.role::text INTO v_role FROM public.profiles p
 WHERE p.id=v_actor AND p.is_active AND p.role::text IN ('admin','editor') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'editorial_access_denied' USING errcode='42501'; END IF;
 SELECT * INTO v_task FROM public.artales_editorial_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND OR v_task.status NOT IN ('open','returned')
 THEN RETURN pg_catalog.jsonb_build_object('result','unavailable'); END IF;
 IF v_task.assigned_to IS NOT NULL AND v_task.assigned_to<>v_actor
 THEN RETURN pg_catalog.jsonb_build_object('result','not_assignee'); END IF;
 IF v_task.assigned_to IS NULL THEN
  IF v_role<>'admin' AND NOT EXISTS(
   SELECT 1 FROM public.artales_editorial_capabilities c
    WHERE c.profile_id=v_actor AND c.kind=v_task.kind)
  THEN RETURN pg_catalog.jsonb_build_object('result','not_eligible'); END IF;
  -- The reserved legacy transfer remains with its explicitly designated owner.
  IF v_task.kind='text_review' AND EXISTS(
   SELECT 1 FROM public.artales_legacy_transfers l
    WHERE l.candidate_id=v_task.candidate_id AND l.assigned_to<>v_actor)
  THEN RETURN pg_catalog.jsonb_build_object('result','legacy_reserved'); END IF;
  IF v_task.kind='text_review' AND v_role<>'admin' AND EXISTS(
   SELECT 1 FROM public.artales_editorial_tasks active
    WHERE active.assigned_to=v_actor AND active.kind='text_review'
     AND active.status IN ('open','claimed','returned')
     AND active.candidate_id<>v_task.candidate_id
  ) THEN RETURN pg_catalog.jsonb_build_object('result','qa_capacity_full'); END IF;
 END IF;
 UPDATE public.artales_editorial_tasks SET assigned_to=v_actor,status='claimed'
 WHERE id=v_task.id;
 INSERT INTO public.artales_editorial_events
 (task_id,actor_id,action,note,from_assignee,to_assignee)
 VALUES(v_task.id,v_actor,'claimed','Editor převzal úkol aktuální revize',
  v_task.assigned_to,v_actor);
 RETURN pg_catalog.jsonb_build_object('result','claimed','task_id',v_task.id);
END $claim$;
REVOKE ALL ON FUNCTION public.artales_claim_editorial_task(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_claim_editorial_task(uuid) TO authenticated;

-- A person may give an optional text task back to the shared pool, preserving history.
CREATE OR REPLACE FUNCTION public.artales_release_editorial_task(p_task_id uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $release$
DECLARE v_actor uuid:=auth.uid();v_task public.artales_editorial_tasks%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor
  AND p.is_active AND p.role::text IN ('admin','editor')) THEN
  RAISE EXCEPTION 'editorial_access_denied' USING errcode='42501'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 20 AND 1000 THEN
  RETURN pg_catalog.jsonb_build_object('result','reason_required'); END IF;
 SELECT * INTO v_task FROM public.artales_editorial_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND OR v_task.assigned_to<>v_actor
  OR v_task.status NOT IN ('open','claimed','returned')
 THEN RETURN pg_catalog.jsonb_build_object('result','unavailable'); END IF;
 IF v_task.kind NOT IN ('text_review','work_description','author_bio','second_review','proofread')
 THEN RETURN pg_catalog.jsonb_build_object('result','fixed_responsibility'); END IF;
 IF EXISTS(SELECT 1 FROM public.artales_legacy_transfers l
  WHERE l.candidate_id=v_task.candidate_id AND v_task.kind='text_review')
 THEN RETURN pg_catalog.jsonb_build_object('result','legacy_reserved'); END IF;
 UPDATE public.artales_editorial_tasks SET assigned_to=NULL,status='returned'
 WHERE id=v_task.id;
 INSERT INTO public.artales_editorial_events
 (task_id,actor_id,action,note,from_assignee,to_assignee)
 VALUES(v_task.id,v_actor,'returned',btrim(p_reason),v_actor,NULL);
 RETURN pg_catalog.jsonb_build_object('result','released','task_id',v_task.id);
END $release$;
REVOKE ALL ON FUNCTION public.artales_release_editorial_task(uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_release_editorial_task(uuid,text) TO authenticated;

-- Only a human admin may forcibly transfer owned work. No transfer of completed tasks.
-- The new owner must have the relevant competency (admins may receive escalations).
CREATE OR REPLACE FUNCTION public.artales_reassign_editorial_task(
 p_task_id uuid,p_new_assignee uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $reassign$
DECLARE v_actor uuid:=auth.uid();v_task public.artales_editorial_tasks%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor
  AND p.is_active AND p.role::text='admin') THEN
  RAISE EXCEPTION 'editorial_admin_required' USING errcode='42501'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 20 AND 1000
 THEN RETURN pg_catalog.jsonb_build_object('result','reason_required'); END IF;
 SELECT * INTO v_task FROM public.artales_editorial_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND OR v_task.status='completed' OR v_task.assigned_to=p_new_assignee
 THEN RETURN pg_catalog.jsonb_build_object('result','unavailable'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_new_assignee AND p.is_active
  AND (p.role::text='admin' OR (p.role::text='editor' AND EXISTS(
   SELECT 1 FROM public.artales_editorial_capabilities c
   WHERE c.profile_id=p.id AND c.kind=v_task.kind))))
 THEN RETURN pg_catalog.jsonb_build_object('result','not_eligible'); END IF;
 IF v_task.kind='text_review' AND EXISTS(SELECT 1 FROM public.artales_legacy_transfers l
  WHERE l.candidate_id=v_task.candidate_id AND l.assigned_to<>p_new_assignee)
 THEN RETURN pg_catalog.jsonb_build_object('result','legacy_reserved'); END IF;
 UPDATE public.artales_editorial_tasks SET assigned_to=p_new_assignee,
  status=CASE WHEN status='claimed' THEN 'returned' ELSE status END
 WHERE id=v_task.id;
 INSERT INTO public.artales_editorial_events
 (task_id,actor_id,action,note,from_assignee,to_assignee)
 VALUES(v_task.id,v_actor,'reassigned',btrim(p_reason),v_task.assigned_to,p_new_assignee);
 RETURN pg_catalog.jsonb_build_object('result','reassigned','task_id',v_task.id);
END $reassign$;
REVOKE ALL ON FUNCTION public.artales_reassign_editorial_task(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_reassign_editorial_task(uuid,uuid,text) TO authenticated;

-- New books: text and blurbs are in the eligible shared pool, while specialised visual
-- roles use configured defaults. Next text revision carries forward the current owner.
-- Existing task assignments and the explicit 49-title legacy mapping remain untouched.
CREATE OR REPLACE FUNCTION public.artales_auto_enqueue_semantic_tasks()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $tasks$
DECLARE v_author_name text;v_work_title text;v_lubos uuid;v_text_owner uuid;
        v_has_author boolean;v_is_legacy boolean;
BEGIN
 IF NEW.status<>'draft' OR EXISTS(
  SELECT 1 FROM public.artales_semantic_publications published
   WHERE published.candidate_id=NEW.candidate_id) THEN RETURN NEW;END IF;
 v_lubos:=public.artales_editorial_owner('Luboš Žížlavský','admin');
 SELECT c.proposed_title,c.proposed_author_name INTO v_work_title,v_author_name
 FROM public.work_candidates c WHERE c.id=NEW.candidate_id;
 IF v_work_title IS NULL OR v_author_name IS NULL THEN
  RAISE EXCEPTION 'editorial_candidate_metadata_missing' USING errcode='23514';END IF;
 SELECT EXISTS(SELECT 1 FROM public.artales_legacy_transfers l
  WHERE l.candidate_id=NEW.candidate_id AND l.assigned_to=v_lubos) INTO v_is_legacy;
 SELECT t.assigned_to INTO v_text_owner FROM public.artales_editorial_tasks t
 WHERE t.candidate_id=NEW.candidate_id AND t.kind='text_review'
 ORDER BY t.created_at DESC,t.id DESC LIMIT 1;
 v_text_owner:=CASE WHEN v_is_legacy THEN v_lubos ELSE v_text_owner END;
 INSERT INTO public.artales_editorial_tasks(candidate_id,revision_sha256,kind,title,assigned_to,created_by)
 VALUES(NEW.candidate_id,NEW.revision_sha256,'text_review',
 'QA textu — '||left(v_work_title,180),v_text_owner,NEW.authored_by)
 ON CONFLICT(candidate_id,revision_sha256,kind) DO NOTHING;
 SELECT EXISTS(SELECT 1 FROM public.authors a
  WHERE lower(btrim(a.name))=lower(btrim(v_author_name))) INTO v_has_author;
 INSERT INTO public.artales_editorial_tasks(candidate_id,revision_sha256,kind,title,assigned_to,created_by)
 SELECT NEW.candidate_id,NEW.revision_sha256,v.kind,
   v.label||' — '||left(v_work_title,170),d.assigned_to,NEW.authored_by
 FROM (VALUES ('cover_art','Obálka díla'),('work_description','Anotace díla'),
   ('collection_curation','Kolekce a zařazení díla'),
   ('author_visual','Vizuál autora'),('author_bio','Profil a text autora')) v(kind,label)
 LEFT JOIN public.artales_editorial_default_owners d ON d.kind=v.kind
 WHERE (v.kind NOT IN ('author_visual','author_bio') OR NOT v_has_author)
  AND NOT EXISTS(SELECT 1 FROM public.artales_editorial_tasks prior
   WHERE prior.candidate_id=NEW.candidate_id AND prior.kind=v.kind)
 ON CONFLICT(candidate_id,revision_sha256,kind) DO NOTHING;
 RETURN NEW;
END $tasks$;
REVOKE ALL ON FUNCTION public.artales_auto_enqueue_semantic_tasks() FROM PUBLIC,anon,authenticated;
COMMIT;
