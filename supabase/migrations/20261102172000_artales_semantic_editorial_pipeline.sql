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
 source_manifest jsonb NOT NULL CHECK(jsonb_typeof(source_manifest)='object'),
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
 candidate_id uuid NOT NULL REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
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
 candidate_id uuid NOT NULL REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
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
CREATE FUNCTION public.artales_complete_editorial_task(p_task_id uuid,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor uuid := auth.uid(); v_task public.artales_editorial_tasks%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 40 AND 4000 OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor AND p.is_active AND p.role::text IN ('admin','editor'))
 THEN RAISE EXCEPTION 'editorial_access_denied' USING errcode='42501'; END IF;
 SELECT * INTO v_task FROM public.artales_editorial_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND OR v_task.status<>'claimed' THEN RETURN jsonb_build_object('result','unavailable'); END IF;
 IF v_task.assigned_to IS NOT NULL AND v_task.assigned_to<>v_actor
 AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor AND p.role::text='admin' AND p.is_active)
 THEN RETURN jsonb_build_object('result','not_assignee'); END IF;
 UPDATE public.artales_editorial_tasks SET status='completed',completed_by=v_actor,completed_at=now()
 WHERE id=p_task_id;
 INSERT INTO public.artales_editorial_events(task_id,actor_id,action,note)
 VALUES(p_task_id,v_actor,'completed',btrim(p_note));
 RETURN jsonb_build_object('result','completed','task_id',p_task_id);
END $$;
REVOKE ALL ON FUNCTION public.artales_complete_editorial_task(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_complete_editorial_task(uuid,text) TO authenticated;


-- Explicitly approved, byte-verified public derivative/copy. Never expose the
-- immutable private EPUB or assume that its embedded illustrations are cleared.
CREATE TABLE public.artales_semantic_images (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 candidate_id uuid NOT NULL REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
 revision_sha256 text NOT NULL REFERENCES public.candidate_semantic_revisions(revision_sha256) ON DELETE RESTRICT,
 anchor_atom_id text NOT NULL CHECK(length(anchor_atom_id) BETWEEN 4 AND 150),
 storage_path text NOT NULL UNIQUE CHECK(storage_path ~ '^works/[a-f0-9-]{36}/inline/[a-f0-9-]{36}[.](png|jpg|webp)
-- surface. Raw EPUB originals and private artwork never enter this table.
CREATE TABLE public.artales_semantic_publications (
 candidate_id uuid PRIMARY KEY REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
 work_id uuid NOT NULL UNIQUE REFERENCES public.works(id) ON DELETE RESTRICT,
 revision_sha256 text NOT NULL REFERENCES public.candidate_semantic_revisions(revision_sha256) ON DELETE RESTRICT,
 semantic_revision jsonb NOT NULL CHECK(semantic_revision->>'schema'='artales.semantic-text.v2'),
 image_selection text NOT NULL CHECK(image_selection IN ('none','cleared')),
 visual_manifest jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(visual_manifest)='array'),
 published_by uuid NOT NULL REFERENCES public.profiles(id),
 published_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.artales_semantic_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artales_semantic_publications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.artales_semantic_publications TO anon,authenticated;
CREATE POLICY semantic_public_only_for_published_work ON public.artales_semantic_publications
 FOR SELECT TO anon,authenticated USING(EXISTS(
  SELECT 1 FROM public.works w WHERE w.id=work_id AND w.status::text='published'
 ));

CREATE FUNCTION public.artales_publish_semantic_candidate(
 p_candidate_id uuid,p_revision_sha256 text,p_work_slug text,p_summary text,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_actor uuid := auth.uid();
 v_candidate public.work_candidates%ROWTYPE;
 v_snapshot public.candidate_snapshots%ROWTYPE;
 v_rev public.candidate_semantic_revisions%ROWTYPE;
 v_author_id uuid;
 v_author_slug text;
 v_work_id uuid;
 v_language text;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor AND p.is_active AND p.role::text='admin')
 THEN RAISE EXCEPTION 'release_admin_required' USING errcode='42501'; END IF;
 IF p_work_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(p_work_slug)>100 OR
 length(btrim(p_summary)) NOT BETWEEN 200 AND 800 OR length(btrim(p_reason)) NOT BETWEEN 30 AND 4000
 THEN RAISE EXCEPTION 'release_metadata_invalid' USING errcode='22023'; END IF;
 SELECT * INTO v_candidate FROM public.work_candidates WHERE id=p_candidate_id FOR UPDATE;
 SELECT * INTO v_snapshot FROM public.candidate_snapshots WHERE candidate_id=p_candidate_id;
 SELECT * INTO v_rev FROM public.candidate_semantic_revisions
 WHERE candidate_id=p_candidate_id AND revision_sha256=p_revision_sha256 AND status='draft';
 IF v_candidate.id IS NULL OR v_snapshot.candidate_id IS NULL OR v_rev.id IS NULL OR
 v_rev.snapshot_sha256<>v_snapshot.sha256 OR v_rev.image_selection<>'none' OR
 v_rev.revision->>'revision_sha256'<>p_revision_sha256 OR
 v_rev.revision->>'release_allowed'<>'false'
 THEN RAISE EXCEPTION 'release_source_or_revision_invalid' USING errcode='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.artales_semantic_publications x WHERE x.candidate_id=p_candidate_id)
 OR EXISTS(SELECT 1 FROM public.works w WHERE w.slug=p_work_slug)
 THEN RAISE EXCEPTION 'release_duplicate_or_slug_taken' USING errcode='23505'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.candidate_legal_locks l
 JOIN public.candidate_legal_decisions d ON d.decision_no=l.decision_no
 WHERE l.candidate_id=p_candidate_id AND d.candidate_id=p_candidate_id
 AND d.source_id=l.source_id AND d.verdict='approved' AND d.territory='CZ/EU')
 THEN RAISE EXCEPTION 'release_legal_not_approved' USING errcode='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.candidate_snapshot_reviews r
 WHERE r.candidate_id=p_candidate_id AND r.snapshot_sha256=v_snapshot.sha256
 AND r.text_correspondence='confirmed' AND r.image_disposition='exclude_all'
 AND r.id=(SELECT z.id FROM public.candidate_snapshot_reviews z WHERE z.candidate_id=p_candidate_id
 ORDER BY z.reviewed_at DESC,z.id DESC LIMIT 1))
 THEN RAISE EXCEPTION 'release_snapshot_review_missing' USING errcode='23514'; END IF;
 IF (SELECT count(DISTINCT t.kind) FROM public.artales_editorial_tasks t
 WHERE t.candidate_id=p_candidate_id AND t.revision_sha256=p_revision_sha256
 AND t.status='completed')<>3
 THEN RAISE EXCEPTION 'release_editorial_tasks_incomplete' USING errcode='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.artales_editorial_tasks t WHERE t.candidate_id=p_candidate_id
 AND t.revision_sha256=p_revision_sha256 AND t.status<>'completed')
 THEN RAISE EXCEPTION 'release_open_editorial_task' USING errcode='23514'; END IF;
 IF v_rev.id<>(SELECT x.id FROM public.candidate_semantic_revisions x
 WHERE x.candidate_id=p_candidate_id ORDER BY x.created_at DESC,x.id DESC LIMIT 1)
 THEN RAISE EXCEPTION 'release_revision_stale' USING errcode='23514'; END IF;
 SELECT id INTO v_author_id FROM public.authors
 WHERE lower(name)=lower(v_candidate.proposed_author_name) ORDER BY id LIMIT 1;
 IF v_author_id IS NULL THEN
  v_author_slug:=trim(both '-' from pg_catalog.regexp_replace(
   pg_catalog.lower(v_candidate.proposed_author_name),'[^a-z0-9]+','-','g'));
  IF length(v_author_slug)<3 THEN RAISE EXCEPTION 'release_author_slug_unusable' USING errcode='22023'; END IF;
  INSERT INTO public.authors(name,slug,created_by,updated_by,primary_language,is_public_visible)
  VALUES(v_candidate.proposed_author_name,v_author_slug,v_actor,v_actor,'en',true)
  RETURNING id INTO v_author_id;
 END IF;
 SELECT s.language_code INTO v_language FROM public.candidate_legal_sources s
 WHERE s.id=v_snapshot.source_id AND s.candidate_id=p_candidate_id;
 IF v_language IS NULL OR btrim(v_language)='' THEN RAISE EXCEPTION 'release_language_unknown' USING errcode='23514'; END IF;
 INSERT INTO public.works(title,slug,summary,content,canonical_language,origin_type,source_label,
 source_reference,status,primary_author_id,created_by,updated_by,published_by,published_at,
 edition_title,edition_language,edition_source_url,edition_note_internal,content_blocks)
 VALUES(v_candidate.proposed_title,p_work_slug,btrim(p_summary),v_rev.source_text,v_language,
 'public_domain','gutenberg',v_snapshot.catalog_url,'published',v_author_id,v_actor,v_actor,
 v_actor,now(),v_candidate.proposed_title,v_language,v_snapshot.catalog_url,
 'Published from immutable semantic revision '||p_revision_sha256,'[]'::jsonb)
 RETURNING id INTO v_work_id;
 INSERT INTO public.candidate_release_decisions(candidate_id,revision_sha256,outcome,rationale,decided_by)
 VALUES(p_candidate_id,p_revision_sha256,'approved',btrim(p_reason),v_actor);
 INSERT INTO public.artales_semantic_publications(candidate_id,work_id,revision_sha256,
 semantic_revision,image_selection,visual_manifest,published_by)
 VALUES(p_candidate_id,v_work_id,p_revision_sha256,v_rev.revision,
 CASE WHEN EXISTS(SELECT 1 FROM public.artales_semantic_images i WHERE i.candidate_id=p_candidate_id
 AND i.revision_sha256=p_revision_sha256) THEN 'cleared' ELSE 'none' END,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('anchor_atom_id',i.anchor_atom_id,
 'storage_path',i.storage_path,'caption',i.caption,'sha256',i.sha256) ORDER BY i.approved_at,i.id)
 FROM public.artales_semantic_images i WHERE i.candidate_id=p_candidate_id
 AND i.revision_sha256=p_revision_sha256),'[]'::jsonb),v_actor);
 RETURN pg_catalog.jsonb_build_object('result','published','work_id',v_work_id,'slug',p_work_slug);
END $$;
REVOKE ALL ON FUNCTION public.artales_publish_semantic_candidate(uuid,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_publish_semantic_candidate(uuid,text,text,text,text)
 TO authenticated;

CREATE FUNCTION public.artales_claim_editorial_task(p_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor uuid := auth.uid(); v_task public.artales_editorial_tasks%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor
 AND p.is_active AND p.role::text IN ('admin','editor'))
 THEN RAISE EXCEPTION 'editorial_access_denied' USING errcode='42501'; END IF;
 SELECT * INTO v_task FROM public.artales_editorial_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND OR v_task.status NOT IN ('open','returned') THEN
  RETURN jsonb_build_object('result','unavailable'); END IF;
 UPDATE public.artales_editorial_tasks SET status='claimed',assigned_to=v_actor WHERE id=p_task_id;
 INSERT INTO public.artales_editorial_events(task_id,actor_id,action,note)
 VALUES(p_task_id,v_actor,'claimed','Editor accepted exact semantic revision task');
 RETURN jsonb_build_object('result','claimed','task_id',p_task_id);
END $$;
REVOKE ALL ON FUNCTION public.artales_claim_editorial_task(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_claim_editorial_task(uuid) TO authenticated;
),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}
-- surface. Raw EPUB originals and private artwork never enter this table.
CREATE TABLE public.artales_semantic_publications (
 candidate_id uuid PRIMARY KEY REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
 work_id uuid NOT NULL UNIQUE REFERENCES public.works(id) ON DELETE RESTRICT,
 revision_sha256 text NOT NULL REFERENCES public.candidate_semantic_revisions(revision_sha256) ON DELETE RESTRICT,
 semantic_revision jsonb NOT NULL CHECK(semantic_revision->>'schema'='artales.semantic-text.v2'),
 image_selection text NOT NULL CHECK(image_selection='none'),
 published_by uuid NOT NULL REFERENCES public.profiles(id),
 published_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.artales_semantic_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artales_semantic_publications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.artales_semantic_publications TO anon,authenticated;
CREATE POLICY semantic_public_only_for_published_work ON public.artales_semantic_publications
 FOR SELECT TO anon,authenticated USING(EXISTS(
  SELECT 1 FROM public.works w WHERE w.id=work_id AND w.status::text='published'
 ));

CREATE FUNCTION public.artales_publish_semantic_candidate(
 p_candidate_id uuid,p_revision_sha256 text,p_work_slug text,p_summary text,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_actor uuid := auth.uid();
 v_candidate public.work_candidates%ROWTYPE;
 v_snapshot public.candidate_snapshots%ROWTYPE;
 v_rev public.candidate_semantic_revisions%ROWTYPE;
 v_author_id uuid;
 v_author_slug text;
 v_work_id uuid;
 v_language text;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor AND p.is_active AND p.role::text='admin')
 THEN RAISE EXCEPTION 'release_admin_required' USING errcode='42501'; END IF;
 IF p_work_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(p_work_slug)>100 OR
 length(btrim(p_summary)) NOT BETWEEN 200 AND 800 OR length(btrim(p_reason)) NOT BETWEEN 30 AND 4000
 THEN RAISE EXCEPTION 'release_metadata_invalid' USING errcode='22023'; END IF;
 SELECT * INTO v_candidate FROM public.work_candidates WHERE id=p_candidate_id FOR UPDATE;
 SELECT * INTO v_snapshot FROM public.candidate_snapshots WHERE candidate_id=p_candidate_id;
 SELECT * INTO v_rev FROM public.candidate_semantic_revisions
 WHERE candidate_id=p_candidate_id AND revision_sha256=p_revision_sha256 AND status='draft';
 IF v_candidate.id IS NULL OR v_snapshot.candidate_id IS NULL OR v_rev.id IS NULL OR
 v_rev.snapshot_sha256<>v_snapshot.sha256 OR v_rev.image_selection<>'none' OR
 v_rev.revision->>'revision_sha256'<>p_revision_sha256 OR
 v_rev.revision->>'release_allowed'<>'false'
 THEN RAISE EXCEPTION 'release_source_or_revision_invalid' USING errcode='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.artales_semantic_publications x WHERE x.candidate_id=p_candidate_id)
 OR EXISTS(SELECT 1 FROM public.works w WHERE w.slug=p_work_slug)
 THEN RAISE EXCEPTION 'release_duplicate_or_slug_taken' USING errcode='23505'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.candidate_legal_locks l
 JOIN public.candidate_legal_decisions d ON d.decision_no=l.decision_no
 WHERE l.candidate_id=p_candidate_id AND d.candidate_id=p_candidate_id
 AND d.source_id=l.source_id AND d.verdict='approved' AND d.territory='CZ/EU')
 THEN RAISE EXCEPTION 'release_legal_not_approved' USING errcode='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.candidate_snapshot_reviews r
 WHERE r.candidate_id=p_candidate_id AND r.snapshot_sha256=v_snapshot.sha256
 AND r.text_correspondence='confirmed' AND r.image_disposition='exclude_all'
 AND r.id=(SELECT z.id FROM public.candidate_snapshot_reviews z WHERE z.candidate_id=p_candidate_id
 ORDER BY z.reviewed_at DESC,z.id DESC LIMIT 1))
 THEN RAISE EXCEPTION 'release_snapshot_review_missing' USING errcode='23514'; END IF;
 IF (SELECT count(DISTINCT t.kind) FROM public.artales_editorial_tasks t
 WHERE t.candidate_id=p_candidate_id AND t.revision_sha256=p_revision_sha256
 AND t.status='completed')<>3
 THEN RAISE EXCEPTION 'release_editorial_tasks_incomplete' USING errcode='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.artales_editorial_tasks t WHERE t.candidate_id=p_candidate_id
 AND t.revision_sha256=p_revision_sha256 AND t.status<>'completed')
 THEN RAISE EXCEPTION 'release_open_editorial_task' USING errcode='23514'; END IF;
 IF v_rev.id<>(SELECT x.id FROM public.candidate_semantic_revisions x
 WHERE x.candidate_id=p_candidate_id ORDER BY x.created_at DESC,x.id DESC LIMIT 1)
 THEN RAISE EXCEPTION 'release_revision_stale' USING errcode='23514'; END IF;
 SELECT id INTO v_author_id FROM public.authors
 WHERE lower(name)=lower(v_candidate.proposed_author_name) ORDER BY id LIMIT 1;
 IF v_author_id IS NULL THEN
  v_author_slug:=trim(both '-' from pg_catalog.regexp_replace(
   pg_catalog.lower(v_candidate.proposed_author_name),'[^a-z0-9]+','-','g'));
  IF length(v_author_slug)<3 THEN RAISE EXCEPTION 'release_author_slug_unusable' USING errcode='22023'; END IF;
  INSERT INTO public.authors(name,slug,created_by,updated_by,primary_language,is_public_visible)
  VALUES(v_candidate.proposed_author_name,v_author_slug,v_actor,v_actor,'en',true)
  RETURNING id INTO v_author_id;
 END IF;
 SELECT s.language_code INTO v_language FROM public.candidate_legal_sources s
 WHERE s.id=v_snapshot.source_id AND s.candidate_id=p_candidate_id;
 IF v_language IS NULL OR btrim(v_language)='' THEN RAISE EXCEPTION 'release_language_unknown' USING errcode='23514'; END IF;
 INSERT INTO public.works(title,slug,summary,content,canonical_language,origin_type,source_label,
 source_reference,status,primary_author_id,created_by,updated_by,published_by,published_at,
 edition_title,edition_language,edition_source_url,edition_note_internal,content_blocks)
 VALUES(v_candidate.proposed_title,p_work_slug,btrim(p_summary),v_rev.source_text,v_language,
 'public_domain','gutenberg',v_snapshot.catalog_url,'published',v_author_id,v_actor,v_actor,
 v_actor,now(),v_candidate.proposed_title,v_language,v_snapshot.catalog_url,
 'Published from immutable semantic revision '||p_revision_sha256,'[]'::jsonb)
 RETURNING id INTO v_work_id;
 INSERT INTO public.candidate_release_decisions(candidate_id,revision_sha256,outcome,rationale,decided_by)
 VALUES(p_candidate_id,p_revision_sha256,'approved',btrim(p_reason),v_actor);
 INSERT INTO public.artales_semantic_publications(candidate_id,work_id,revision_sha256,
 semantic_revision,image_selection,published_by)
 VALUES(p_candidate_id,v_work_id,p_revision_sha256,v_rev.revision,'none',v_actor);
 RETURN pg_catalog.jsonb_build_object('result','published','work_id',v_work_id,'slug',p_work_slug);
END $$;
REVOKE ALL ON FUNCTION public.artales_publish_semantic_candidate(uuid,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_publish_semantic_candidate(uuid,text,text,text,text)
 TO authenticated;

CREATE FUNCTION public.artales_claim_editorial_task(p_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor uuid := auth.uid(); v_task public.artales_editorial_tasks%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor
 AND p.is_active AND p.role::text IN ('admin','editor'))
 THEN RAISE EXCEPTION 'editorial_access_denied' USING errcode='42501'; END IF;
 SELECT * INTO v_task FROM public.artales_editorial_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND OR v_task.status NOT IN ('open','returned') THEN
  RETURN jsonb_build_object('result','unavailable'); END IF;
 UPDATE public.artales_editorial_tasks SET status='claimed',assigned_to=v_actor WHERE id=p_task_id;
 INSERT INTO public.artales_editorial_events(task_id,actor_id,action,note)
 VALUES(p_task_id,v_actor,'claimed','Editor accepted exact semantic revision task');
 RETURN jsonb_build_object('result','claimed','task_id',p_task_id);
END $$;
REVOKE ALL ON FUNCTION public.artales_claim_editorial_task(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_claim_editorial_task(uuid) TO authenticated;
),
 source_asset_sha256 text,
 provenance text NOT NULL CHECK(provenance IN ('approved_original','original_art')),
 rights_note text NOT NULL CHECK(length(btrim(rights_note)) BETWEEN 100 AND 4000),
 caption text NOT NULL DEFAULT '',
 approved_by uuid NOT NULL REFERENCES public.profiles(id),
 approved_at timestamptz NOT NULL DEFAULT now(),
 CHECK((provenance='approved_original')=(source_asset_sha256 IS NOT NULL)),
 CHECK(source_asset_sha256 IS NULL OR source_asset_sha256 ~ '^[a-f0-9]{64}
-- surface. Raw EPUB originals and private artwork never enter this table.
CREATE TABLE public.artales_semantic_publications (
 candidate_id uuid PRIMARY KEY REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
 work_id uuid NOT NULL UNIQUE REFERENCES public.works(id) ON DELETE RESTRICT,
 revision_sha256 text NOT NULL REFERENCES public.candidate_semantic_revisions(revision_sha256) ON DELETE RESTRICT,
 semantic_revision jsonb NOT NULL CHECK(semantic_revision->>'schema'='artales.semantic-text.v2'),
 image_selection text NOT NULL CHECK(image_selection='none'),
 published_by uuid NOT NULL REFERENCES public.profiles(id),
 published_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.artales_semantic_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artales_semantic_publications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.artales_semantic_publications TO anon,authenticated;
CREATE POLICY semantic_public_only_for_published_work ON public.artales_semantic_publications
 FOR SELECT TO anon,authenticated USING(EXISTS(
  SELECT 1 FROM public.works w WHERE w.id=work_id AND w.status::text='published'
 ));

CREATE FUNCTION public.artales_publish_semantic_candidate(
 p_candidate_id uuid,p_revision_sha256 text,p_work_slug text,p_summary text,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_actor uuid := auth.uid();
 v_candidate public.work_candidates%ROWTYPE;
 v_snapshot public.candidate_snapshots%ROWTYPE;
 v_rev public.candidate_semantic_revisions%ROWTYPE;
 v_author_id uuid;
 v_author_slug text;
 v_work_id uuid;
 v_language text;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor AND p.is_active AND p.role::text='admin')
 THEN RAISE EXCEPTION 'release_admin_required' USING errcode='42501'; END IF;
 IF p_work_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(p_work_slug)>100 OR
 length(btrim(p_summary)) NOT BETWEEN 200 AND 800 OR length(btrim(p_reason)) NOT BETWEEN 30 AND 4000
 THEN RAISE EXCEPTION 'release_metadata_invalid' USING errcode='22023'; END IF;
 SELECT * INTO v_candidate FROM public.work_candidates WHERE id=p_candidate_id FOR UPDATE;
 SELECT * INTO v_snapshot FROM public.candidate_snapshots WHERE candidate_id=p_candidate_id;
 SELECT * INTO v_rev FROM public.candidate_semantic_revisions
 WHERE candidate_id=p_candidate_id AND revision_sha256=p_revision_sha256 AND status='draft';
 IF v_candidate.id IS NULL OR v_snapshot.candidate_id IS NULL OR v_rev.id IS NULL OR
 v_rev.snapshot_sha256<>v_snapshot.sha256 OR v_rev.image_selection<>'none' OR
 v_rev.revision->>'revision_sha256'<>p_revision_sha256 OR
 v_rev.revision->>'release_allowed'<>'false'
 THEN RAISE EXCEPTION 'release_source_or_revision_invalid' USING errcode='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.artales_semantic_publications x WHERE x.candidate_id=p_candidate_id)
 OR EXISTS(SELECT 1 FROM public.works w WHERE w.slug=p_work_slug)
 THEN RAISE EXCEPTION 'release_duplicate_or_slug_taken' USING errcode='23505'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.candidate_legal_locks l
 JOIN public.candidate_legal_decisions d ON d.decision_no=l.decision_no
 WHERE l.candidate_id=p_candidate_id AND d.candidate_id=p_candidate_id
 AND d.source_id=l.source_id AND d.verdict='approved' AND d.territory='CZ/EU')
 THEN RAISE EXCEPTION 'release_legal_not_approved' USING errcode='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.candidate_snapshot_reviews r
 WHERE r.candidate_id=p_candidate_id AND r.snapshot_sha256=v_snapshot.sha256
 AND r.text_correspondence='confirmed' AND r.image_disposition='exclude_all'
 AND r.id=(SELECT z.id FROM public.candidate_snapshot_reviews z WHERE z.candidate_id=p_candidate_id
 ORDER BY z.reviewed_at DESC,z.id DESC LIMIT 1))
 THEN RAISE EXCEPTION 'release_snapshot_review_missing' USING errcode='23514'; END IF;
 IF (SELECT count(DISTINCT t.kind) FROM public.artales_editorial_tasks t
 WHERE t.candidate_id=p_candidate_id AND t.revision_sha256=p_revision_sha256
 AND t.status='completed')<>3
 THEN RAISE EXCEPTION 'release_editorial_tasks_incomplete' USING errcode='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.artales_editorial_tasks t WHERE t.candidate_id=p_candidate_id
 AND t.revision_sha256=p_revision_sha256 AND t.status<>'completed')
 THEN RAISE EXCEPTION 'release_open_editorial_task' USING errcode='23514'; END IF;
 IF v_rev.id<>(SELECT x.id FROM public.candidate_semantic_revisions x
 WHERE x.candidate_id=p_candidate_id ORDER BY x.created_at DESC,x.id DESC LIMIT 1)
 THEN RAISE EXCEPTION 'release_revision_stale' USING errcode='23514'; END IF;
 SELECT id INTO v_author_id FROM public.authors
 WHERE lower(name)=lower(v_candidate.proposed_author_name) ORDER BY id LIMIT 1;
 IF v_author_id IS NULL THEN
  v_author_slug:=trim(both '-' from pg_catalog.regexp_replace(
   pg_catalog.lower(v_candidate.proposed_author_name),'[^a-z0-9]+','-','g'));
  IF length(v_author_slug)<3 THEN RAISE EXCEPTION 'release_author_slug_unusable' USING errcode='22023'; END IF;
  INSERT INTO public.authors(name,slug,created_by,updated_by,primary_language,is_public_visible)
  VALUES(v_candidate.proposed_author_name,v_author_slug,v_actor,v_actor,'en',true)
  RETURNING id INTO v_author_id;
 END IF;
 SELECT s.language_code INTO v_language FROM public.candidate_legal_sources s
 WHERE s.id=v_snapshot.source_id AND s.candidate_id=p_candidate_id;
 IF v_language IS NULL OR btrim(v_language)='' THEN RAISE EXCEPTION 'release_language_unknown' USING errcode='23514'; END IF;
 INSERT INTO public.works(title,slug,summary,content,canonical_language,origin_type,source_label,
 source_reference,status,primary_author_id,created_by,updated_by,published_by,published_at,
 edition_title,edition_language,edition_source_url,edition_note_internal,content_blocks)
 VALUES(v_candidate.proposed_title,p_work_slug,btrim(p_summary),v_rev.source_text,v_language,
 'public_domain','gutenberg',v_snapshot.catalog_url,'published',v_author_id,v_actor,v_actor,
 v_actor,now(),v_candidate.proposed_title,v_language,v_snapshot.catalog_url,
 'Published from immutable semantic revision '||p_revision_sha256,'[]'::jsonb)
 RETURNING id INTO v_work_id;
 INSERT INTO public.candidate_release_decisions(candidate_id,revision_sha256,outcome,rationale,decided_by)
 VALUES(p_candidate_id,p_revision_sha256,'approved',btrim(p_reason),v_actor);
 INSERT INTO public.artales_semantic_publications(candidate_id,work_id,revision_sha256,
 semantic_revision,image_selection,published_by)
 VALUES(p_candidate_id,v_work_id,p_revision_sha256,v_rev.revision,'none',v_actor);
 RETURN pg_catalog.jsonb_build_object('result','published','work_id',v_work_id,'slug',p_work_slug);
END $$;
REVOKE ALL ON FUNCTION public.artales_publish_semantic_candidate(uuid,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_publish_semantic_candidate(uuid,text,text,text,text)
 TO authenticated;

CREATE FUNCTION public.artales_claim_editorial_task(p_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor uuid := auth.uid(); v_task public.artales_editorial_tasks%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor
 AND p.is_active AND p.role::text IN ('admin','editor'))
 THEN RAISE EXCEPTION 'editorial_access_denied' USING errcode='42501'; END IF;
 SELECT * INTO v_task FROM public.artales_editorial_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND OR v_task.status NOT IN ('open','returned') THEN
  RETURN jsonb_build_object('result','unavailable'); END IF;
 UPDATE public.artales_editorial_tasks SET status='claimed',assigned_to=v_actor WHERE id=p_task_id;
 INSERT INTO public.artales_editorial_events(task_id,actor_id,action,note)
 VALUES(p_task_id,v_actor,'claimed','Editor accepted exact semantic revision task');
 RETURN jsonb_build_object('result','claimed','task_id',p_task_id);
END $$;
REVOKE ALL ON FUNCTION public.artales_claim_editorial_task(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_claim_editorial_task(uuid) TO authenticated;
),
 UNIQUE(candidate_id,revision_sha256,anchor_atom_id,sha256)
);
ALTER TABLE public.artales_semantic_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artales_semantic_images FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.artales_semantic_images TO authenticated;
CREATE POLICY artales_semantic_images_staff_read ON public.artales_semantic_images
 FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
 AND p.is_active AND p.role::text IN ('admin','editor')));
CREATE POLICY artales_semantic_images_admin_insert ON public.artales_semantic_images
 FOR INSERT TO authenticated WITH CHECK(approved_by=(SELECT auth.uid())
 AND storage_path LIKE 'works/'||candidate_id::text||'/inline/%'
 AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
 AND p.is_active AND p.role::text='admin')
 AND EXISTS(SELECT 1 FROM public.candidate_semantic_revisions r
 WHERE r.candidate_id=artales_semantic_images.candidate_id
 AND r.revision_sha256=artales_semantic_images.revision_sha256)
 AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='artales-images'
 AND o.name=artales_semantic_images.storage_path)
 AND (provenance='original_art' OR EXISTS(
 SELECT 1 FROM public.candidate_snapshots x JOIN public.candidate_legal_sources s
 ON s.id=x.source_id AND s.candidate_id=x.candidate_id
 WHERE x.candidate_id=artales_semantic_images.candidate_id
 AND s.illustration_use IN ('public_domain','licensed'))));

-- An explicitly released revision is copied to a separate, RLS-protected public
-- surface. Raw EPUB originals and private artwork never enter this table.
CREATE TABLE public.artales_semantic_publications (
 candidate_id uuid PRIMARY KEY REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
 work_id uuid NOT NULL UNIQUE REFERENCES public.works(id) ON DELETE RESTRICT,
 revision_sha256 text NOT NULL REFERENCES public.candidate_semantic_revisions(revision_sha256) ON DELETE RESTRICT,
 semantic_revision jsonb NOT NULL CHECK(semantic_revision->>'schema'='artales.semantic-text.v2'),
 image_selection text NOT NULL CHECK(image_selection='none'),
 published_by uuid NOT NULL REFERENCES public.profiles(id),
 published_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.artales_semantic_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artales_semantic_publications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.artales_semantic_publications TO anon,authenticated;
CREATE POLICY semantic_public_only_for_published_work ON public.artales_semantic_publications
 FOR SELECT TO anon,authenticated USING(EXISTS(
  SELECT 1 FROM public.works w WHERE w.id=work_id AND w.status::text='published'
 ));

CREATE FUNCTION public.artales_publish_semantic_candidate(
 p_candidate_id uuid,p_revision_sha256 text,p_work_slug text,p_summary text,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_actor uuid := auth.uid();
 v_candidate public.work_candidates%ROWTYPE;
 v_snapshot public.candidate_snapshots%ROWTYPE;
 v_rev public.candidate_semantic_revisions%ROWTYPE;
 v_author_id uuid;
 v_author_slug text;
 v_work_id uuid;
 v_language text;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor AND p.is_active AND p.role::text='admin')
 THEN RAISE EXCEPTION 'release_admin_required' USING errcode='42501'; END IF;
 IF p_work_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(p_work_slug)>100 OR
 length(btrim(p_summary)) NOT BETWEEN 200 AND 800 OR length(btrim(p_reason)) NOT BETWEEN 30 AND 4000
 THEN RAISE EXCEPTION 'release_metadata_invalid' USING errcode='22023'; END IF;
 SELECT * INTO v_candidate FROM public.work_candidates WHERE id=p_candidate_id FOR UPDATE;
 SELECT * INTO v_snapshot FROM public.candidate_snapshots WHERE candidate_id=p_candidate_id;
 SELECT * INTO v_rev FROM public.candidate_semantic_revisions
 WHERE candidate_id=p_candidate_id AND revision_sha256=p_revision_sha256 AND status='draft';
 IF v_candidate.id IS NULL OR v_snapshot.candidate_id IS NULL OR v_rev.id IS NULL OR
 v_rev.snapshot_sha256<>v_snapshot.sha256 OR v_rev.image_selection<>'none' OR
 v_rev.revision->>'revision_sha256'<>p_revision_sha256 OR
 v_rev.revision->>'release_allowed'<>'false'
 THEN RAISE EXCEPTION 'release_source_or_revision_invalid' USING errcode='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.artales_semantic_publications x WHERE x.candidate_id=p_candidate_id)
 OR EXISTS(SELECT 1 FROM public.works w WHERE w.slug=p_work_slug)
 THEN RAISE EXCEPTION 'release_duplicate_or_slug_taken' USING errcode='23505'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.candidate_legal_locks l
 JOIN public.candidate_legal_decisions d ON d.decision_no=l.decision_no
 WHERE l.candidate_id=p_candidate_id AND d.candidate_id=p_candidate_id
 AND d.source_id=l.source_id AND d.verdict='approved' AND d.territory='CZ/EU')
 THEN RAISE EXCEPTION 'release_legal_not_approved' USING errcode='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.candidate_snapshot_reviews r
 WHERE r.candidate_id=p_candidate_id AND r.snapshot_sha256=v_snapshot.sha256
 AND r.text_correspondence='confirmed' AND r.image_disposition='exclude_all'
 AND r.id=(SELECT z.id FROM public.candidate_snapshot_reviews z WHERE z.candidate_id=p_candidate_id
 ORDER BY z.reviewed_at DESC,z.id DESC LIMIT 1))
 THEN RAISE EXCEPTION 'release_snapshot_review_missing' USING errcode='23514'; END IF;
 IF (SELECT count(DISTINCT t.kind) FROM public.artales_editorial_tasks t
 WHERE t.candidate_id=p_candidate_id AND t.revision_sha256=p_revision_sha256
 AND t.status='completed')<>3
 THEN RAISE EXCEPTION 'release_editorial_tasks_incomplete' USING errcode='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.artales_editorial_tasks t WHERE t.candidate_id=p_candidate_id
 AND t.revision_sha256=p_revision_sha256 AND t.status<>'completed')
 THEN RAISE EXCEPTION 'release_open_editorial_task' USING errcode='23514'; END IF;
 IF v_rev.id<>(SELECT x.id FROM public.candidate_semantic_revisions x
 WHERE x.candidate_id=p_candidate_id ORDER BY x.created_at DESC,x.id DESC LIMIT 1)
 THEN RAISE EXCEPTION 'release_revision_stale' USING errcode='23514'; END IF;
 SELECT id INTO v_author_id FROM public.authors
 WHERE lower(name)=lower(v_candidate.proposed_author_name) ORDER BY id LIMIT 1;
 IF v_author_id IS NULL THEN
  v_author_slug:=trim(both '-' from pg_catalog.regexp_replace(
   pg_catalog.lower(v_candidate.proposed_author_name),'[^a-z0-9]+','-','g'));
  IF length(v_author_slug)<3 THEN RAISE EXCEPTION 'release_author_slug_unusable' USING errcode='22023'; END IF;
  INSERT INTO public.authors(name,slug,created_by,updated_by,primary_language,is_public_visible)
  VALUES(v_candidate.proposed_author_name,v_author_slug,v_actor,v_actor,'en',true)
  RETURNING id INTO v_author_id;
 END IF;
 SELECT s.language_code INTO v_language FROM public.candidate_legal_sources s
 WHERE s.id=v_snapshot.source_id AND s.candidate_id=p_candidate_id;
 IF v_language IS NULL OR btrim(v_language)='' THEN RAISE EXCEPTION 'release_language_unknown' USING errcode='23514'; END IF;
 INSERT INTO public.works(title,slug,summary,content,canonical_language,origin_type,source_label,
 source_reference,status,primary_author_id,created_by,updated_by,published_by,published_at,
 edition_title,edition_language,edition_source_url,edition_note_internal,content_blocks)
 VALUES(v_candidate.proposed_title,p_work_slug,btrim(p_summary),v_rev.source_text,v_language,
 'public_domain','gutenberg',v_snapshot.catalog_url,'published',v_author_id,v_actor,v_actor,
 v_actor,now(),v_candidate.proposed_title,v_language,v_snapshot.catalog_url,
 'Published from immutable semantic revision '||p_revision_sha256,'[]'::jsonb)
 RETURNING id INTO v_work_id;
 INSERT INTO public.candidate_release_decisions(candidate_id,revision_sha256,outcome,rationale,decided_by)
 VALUES(p_candidate_id,p_revision_sha256,'approved',btrim(p_reason),v_actor);
 INSERT INTO public.artales_semantic_publications(candidate_id,work_id,revision_sha256,
 semantic_revision,image_selection,published_by)
 VALUES(p_candidate_id,v_work_id,p_revision_sha256,v_rev.revision,'none',v_actor);
 RETURN pg_catalog.jsonb_build_object('result','published','work_id',v_work_id,'slug',p_work_slug);
END $$;
REVOKE ALL ON FUNCTION public.artales_publish_semantic_candidate(uuid,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_publish_semantic_candidate(uuid,text,text,text,text)
 TO authenticated;

CREATE FUNCTION public.artales_claim_editorial_task(p_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor uuid := auth.uid(); v_task public.artales_editorial_tasks%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor
 AND p.is_active AND p.role::text IN ('admin','editor'))
 THEN RAISE EXCEPTION 'editorial_access_denied' USING errcode='42501'; END IF;
 SELECT * INTO v_task FROM public.artales_editorial_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND OR v_task.status NOT IN ('open','returned') THEN
  RETURN jsonb_build_object('result','unavailable'); END IF;
 UPDATE public.artales_editorial_tasks SET status='claimed',assigned_to=v_actor WHERE id=p_task_id;
 INSERT INTO public.artales_editorial_events(task_id,actor_id,action,note)
 VALUES(p_task_id,v_actor,'claimed','Editor accepted exact semantic revision task');
 RETURN jsonb_build_object('result','claimed','task_id',p_task_id);
END $$;
REVOKE ALL ON FUNCTION public.artales_claim_editorial_task(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_claim_editorial_task(uuid) TO authenticated;
