-- ARTales QA/editorial ownership v2; targeted, forward-only, no publication.
-- Converts #389 pilot tasks to normal editor ownership. Existing library transfers require explicit work mapping.
BEGIN;
ALTER TABLE public.artales_editorial_tasks DROP CONSTRAINT artales_editorial_tasks_kind_check;
ALTER TABLE public.artales_editorial_tasks ADD CONSTRAINT artales_editorial_tasks_kind_check
 CHECK(kind IN ('text_review','visual_review','proofread','cover_art','work_description',
                'author_visual','author_bio','collection_curation','second_review'));

DROP POLICY IF EXISTS task_admin_insert ON public.artales_editorial_tasks;
CREATE POLICY task_admin_insert ON public.artales_editorial_tasks FOR INSERT TO authenticated
 WITH CHECK(created_by=(SELECT auth.uid()) AND status='open' AND
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
    AND p.is_active AND p.role::text='admin')
  AND (assigned_to IS NULL OR EXISTS(SELECT 1 FROM public.profiles assignee
    WHERE assignee.id=assigned_to AND assignee.is_active
      AND assignee.role::text IN ('admin','editor')))
  AND EXISTS(SELECT 1 FROM public.candidate_semantic_revisions r
    WHERE r.candidate_id=artales_editorial_tasks.candidate_id
      AND r.revision_sha256=artales_editorial_tasks.revision_sha256));

-- Exact roster mapping; refuses ambiguous/stale personnel rather than silently
-- assigning an editorial task to a different person.
CREATE OR REPLACE FUNCTION public.artales_editorial_owner(p_name text,p_role text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $owner$
DECLARE v_result uuid;v_count int;
BEGIN
 SELECT min(p.id::text)::uuid,count(*) INTO v_result,v_count FROM public.profiles p
 WHERE p.display_name=p_name AND p.role::text=p_role AND p.is_active;
 IF v_count<>1 THEN RAISE EXCEPTION 'editorial_owner_not_unique_or_inactive: %',p_name
  USING errcode='23514'; END IF;
 RETURN v_result;
END $owner$;
REVOKE ALL ON FUNCTION public.artales_editorial_owner(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_editorial_owner(text,text) TO authenticated;

-- Explicit migration exception; a work enters it only after the administrator
-- approves the concrete existing-work -> candidate mapping.
CREATE TABLE IF NOT EXISTS public.artales_legacy_transfers(
  candidate_id uuid PRIMARY KEY REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
  existing_work_id uuid NOT NULL UNIQUE REFERENCES public.works(id) ON DELETE RESTRICT,
  assigned_to uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (assigned_to=created_by)
);
ALTER TABLE public.artales_legacy_transfers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artales_legacy_transfers FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.artales_legacy_transfers TO authenticated;
CREATE POLICY artales_legacy_transfers_admin_read ON public.artales_legacy_transfers
 FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.profiles p
  WHERE p.id=(SELECT auth.uid()) AND p.is_active AND p.role::text='admin'));

CREATE OR REPLACE FUNCTION public.artales_auto_enqueue_semantic_tasks()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $tasks$
DECLARE v_author_name text;v_work_title text;v_lubos uuid;v_ivana uuid;v_pavla uuid;
        v_text_owner uuid;v_has_author boolean;v_is_legacy boolean;
BEGIN
 IF NEW.status<>'draft' OR EXISTS(
   SELECT 1 FROM public.artales_semantic_publications published
   WHERE published.candidate_id=NEW.candidate_id) THEN RETURN NEW;END IF;
 v_lubos:=public.artales_editorial_owner('Luboš Žížlavský','admin');
 v_ivana:=public.artales_editorial_owner('Ivana Svobodová','editor');
 v_pavla:=public.artales_editorial_owner('Pavla Kratochvílová','editor');
 SELECT c.proposed_title,c.proposed_author_name INTO v_work_title,v_author_name
   FROM public.work_candidates c WHERE c.id=NEW.candidate_id;
 IF v_work_title IS NULL OR v_author_name IS NULL THEN
  RAISE EXCEPTION 'editorial_candidate_metadata_missing' USING errcode='23514'; END IF;
 -- Existing library migrations use an explicit, reviewed candidate whitelist.
 -- Never infer it merely from a matching title or previously published work.
 SELECT EXISTS(SELECT 1 FROM public.artales_legacy_transfers l
   WHERE l.candidate_id=NEW.candidate_id AND l.assigned_to=v_lubos)
 INTO v_is_legacy;
 SELECT t.assigned_to INTO v_text_owner FROM public.artales_editorial_tasks t
 WHERE t.candidate_id=NEW.candidate_id AND t.kind='text_review'
 ORDER BY t.created_at DESC,t.id DESC LIMIT 1;
 v_text_owner:=CASE WHEN v_is_legacy THEN v_lubos ELSE COALESCE(v_text_owner,v_pavla) END;
 INSERT INTO public.artales_editorial_tasks(candidate_id,revision_sha256,kind,title,assigned_to,created_by)
 VALUES(NEW.candidate_id,NEW.revision_sha256,'text_review',
  'QA textu — '||left(v_work_title,180),v_text_owner,NEW.authored_by)
 ON CONFLICT(candidate_id,revision_sha256,kind) DO NOTHING;

 -- Other responsibilities belong to the work; do not duplicate them on each
 -- new text revision. The same assigned editor retains their task.
 SELECT EXISTS(SELECT 1 FROM public.authors a
   WHERE lower(btrim(a.name))=lower(btrim(v_author_name))) INTO v_has_author;
 INSERT INTO public.artales_editorial_tasks(candidate_id,revision_sha256,kind,title,assigned_to,created_by)
 SELECT NEW.candidate_id,NEW.revision_sha256,v.kind,
        v.label||' — '||left(v_work_title,170),
        CASE WHEN v.owner='ivana' THEN v_ivana ELSE v_pavla END,
        NEW.authored_by
 FROM (VALUES
   ('cover_art','Obálka díla','ivana'),
   ('work_description','Anotace díla','pavla'),
   ('collection_curation','Kolekce a zařazení díla','ivana'),
   ('author_visual','Vizuál autora','ivana'),
   ('author_bio','Profil a text autora','pavla')
 ) AS v(kind,label,owner)
 WHERE (v.kind NOT IN ('author_visual','author_bio') OR NOT v_has_author)
   AND NOT EXISTS(SELECT 1 FROM public.artales_editorial_tasks prior
      WHERE prior.candidate_id=NEW.candidate_id AND prior.kind=v.kind)
 ON CONFLICT(candidate_id,revision_sha256,kind) DO NOTHING;
 RETURN NEW;
END $tasks$;
REVOKE ALL ON FUNCTION public.artales_auto_enqueue_semantic_tasks()
 FROM PUBLIC,anon,authenticated;

-- A claimed task belongs to its designated editor. Admin may not steal it via
-- claim; explicit admin maintenance remains separate from ordinary review.
CREATE OR REPLACE FUNCTION public.artales_claim_editorial_task(p_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $claim$
DECLARE v_actor uuid:=auth.uid();v_task public.artales_editorial_tasks%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p
 WHERE p.id=v_actor AND p.is_active AND p.role::text IN ('admin','editor'))
 THEN RAISE EXCEPTION 'editorial_access_denied' USING errcode='42501';END IF;
 SELECT * INTO v_task FROM public.artales_editorial_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND OR v_task.status NOT IN ('open','returned') THEN
   RETURN pg_catalog.jsonb_build_object('result','unavailable'); END IF;
 IF v_task.assigned_to IS NOT NULL AND v_task.assigned_to<>v_actor THEN
   RETURN pg_catalog.jsonb_build_object('result','not_assignee'); END IF;
 UPDATE public.artales_editorial_tasks SET status='claimed',assigned_to=v_actor WHERE id=p_task_id;
 INSERT INTO public.artales_editorial_events(task_id,actor_id,action,note)
 VALUES(p_task_id,v_actor,'claimed','Assigned editor accepted the exact revision review');
 RETURN pg_catalog.jsonb_build_object('result','claimed','task_id',p_task_id);
END $claim$;
REVOKE ALL ON FUNCTION public.artales_claim_editorial_task(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_claim_editorial_task(uuid) TO authenticated;

-- A second opinion is a NEW assigned task. The original claimed task remains
-- in progress and the original editor can complete it after the second review.
-- One additional reviewer per exact SHA is sufficient for this pilot.
CREATE OR REPLACE FUNCTION public.artales_request_semantic_second_review(
 p_task_id uuid,p_note text,p_reviewer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $review$
DECLARE v_actor uuid:=auth.uid();v_task public.artales_editorial_tasks%ROWTYPE;
        v_second uuid;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p
   WHERE p.id=v_actor AND p.is_active AND p.role::text IN ('admin','editor')) THEN
   RAISE EXCEPTION 'editorial_access_denied' USING errcode='42501'; END IF;
 IF p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 40 AND 4000
   OR p_reviewer_id IS NULL OR p_reviewer_id=v_actor THEN
   RETURN pg_catalog.jsonb_build_object('result','invalid_request'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_reviewer_id
   AND p.is_active AND p.role::text IN ('admin','editor')) THEN
   RETURN pg_catalog.jsonb_build_object('result','reviewer_unavailable'); END IF;
 SELECT * INTO v_task FROM public.artales_editorial_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND OR v_task.status<>'claimed' OR v_task.assigned_to<>v_actor
    OR v_task.kind='second_review'
 THEN RETURN pg_catalog.jsonb_build_object('result','unavailable'); END IF;
 IF EXISTS(SELECT 1 FROM public.artales_editorial_tasks x
   WHERE x.candidate_id=v_task.candidate_id AND x.revision_sha256=v_task.revision_sha256
      AND x.kind='second_review') THEN
   RETURN pg_catalog.jsonb_build_object('result','already_requested'); END IF;
 INSERT INTO public.artales_editorial_tasks
 (candidate_id,revision_sha256,kind,title,status,assigned_to,created_by)
 VALUES(v_task.candidate_id,v_task.revision_sha256,'second_review',
   'Dodatečná kontrola — '||left(v_task.title,175),'open',p_reviewer_id,v_actor)
 RETURNING id INTO v_second;
 INSERT INTO public.artales_editorial_events(task_id,actor_id,action,note)
 VALUES(v_second,v_actor,'created',
   'Vyžádána nezávislá kontrola původního úkolu '||p_task_id::text||': '||btrim(p_note));
 RETURN pg_catalog.jsonb_build_object('result','requested','task_id',v_second);
END $review$;
REVOKE ALL ON FUNCTION public.artales_request_semantic_second_review(uuid,text,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_request_semantic_second_review(uuid,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.artales_request_semantic_second_review(uuid,text)
 FROM PUBLIC,anon,authenticated;

-- Text findings must be resolved before closing text QA; visual and metadata
-- work may proceed in parallel. Publishing remains blocked on all QA flags.
CREATE OR REPLACE FUNCTION public.artales_block_unresolved_semantic_qa()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $gate$
BEGIN
 IF TG_TABLE_NAME='artales_editorial_tasks'
   AND NEW.kind='text_review' AND NEW.status='completed' AND OLD.status<>'completed'
   AND EXISTS(SELECT 1 FROM public.artales_semantic_qa_flags f
     WHERE f.candidate_id=NEW.candidate_id AND f.status='open') THEN
    RAISE EXCEPTION 'qa_unresolved_flags' USING errcode='23514';
 END IF;
 IF TG_TABLE_NAME='artales_semantic_publications' THEN
   IF EXISTS(SELECT 1 FROM public.artales_semantic_qa_flags f
     WHERE f.candidate_id=NEW.candidate_id AND f.status='open') THEN
     RAISE EXCEPTION 'release_unresolved_qa_flags' USING errcode='23514';
   END IF;
   IF EXISTS(SELECT 1 FROM public.artales_editorial_tasks t
     WHERE t.candidate_id=NEW.candidate_id AND t.status<>'completed'
       AND (t.kind<>'text_review' OR t.revision_sha256=NEW.revision_sha256))
   THEN RAISE EXCEPTION 'release_editorial_work_incomplete' USING errcode='23514'; END IF;
   -- The current publication RPC cannot yet insert a completed cover/collection
   -- into the works row; the incomplete metadata tasks block release instead.
   -- This preserves fail-closed behavior without an impossible unpublished-work check.
 END IF;
 RETURN NEW;
END $gate$;
REVOKE ALL ON FUNCTION public.artales_block_unresolved_semantic_qa()
 FROM PUBLIC,anon,authenticated;

-- Targeted conversion of existing #389 tasks, retaining task IDs and audit.
DO $backfill$
DECLARE v_lubos uuid;v_ivana uuid;v_pavla uuid;
        v_revision public.candidate_semantic_revisions%ROWTYPE;
        v_candidate uuid:='98508359-bce1-4e73-b842-b69a9d1112d0'::uuid;
BEGIN
 v_lubos:=public.artales_editorial_owner('Luboš Žížlavský','admin');
 v_ivana:=public.artales_editorial_owner('Ivana Svobodová','editor');
 v_pavla:=public.artales_editorial_owner('Pavla Kratochvílová','editor');
 SELECT * INTO v_revision FROM public.candidate_semantic_revisions
 WHERE candidate_id=v_candidate ORDER BY created_at DESC,id DESC LIMIT 1;
 IF v_revision.id IS NULL THEN RAISE EXCEPTION '389_semantic_revision_missing'; END IF;
 UPDATE public.artales_editorial_tasks SET title='QA textu — The Great God Pan',
    assigned_to=v_pavla
 WHERE candidate_id=v_candidate AND revision_sha256=v_revision.revision_sha256
   AND kind='text_review' AND status='open';
 UPDATE public.artales_editorial_tasks SET kind='cover_art',
    title='Obálka díla — The Great God Pan',assigned_to=v_ivana
 WHERE candidate_id=v_candidate AND revision_sha256=v_revision.revision_sha256
   AND kind='visual_review' AND status='open';
 UPDATE public.artales_editorial_tasks SET kind='work_description',
    title='Anotace díla — The Great God Pan',assigned_to=v_pavla
 WHERE candidate_id=v_candidate AND revision_sha256=v_revision.revision_sha256
   AND kind='proofread' AND status='open';
 INSERT INTO public.artales_editorial_tasks
  (candidate_id,revision_sha256,kind,title,assigned_to,created_by)
 SELECT v_candidate,v_revision.revision_sha256,v.kind,
        v.label||' — The Great God Pan',
        CASE WHEN v.owner='ivana' THEN v_ivana ELSE v_pavla END,
        v_revision.authored_by
 FROM (VALUES('author_visual','Vizuál autora','ivana'),
   ('author_bio','Profil a text autora','pavla'),
   ('collection_curation','Kolekce a zařazení','ivana')) v(kind,label,owner)
 WHERE (v.kind='collection_curation' OR NOT EXISTS(
   SELECT 1 FROM public.authors a WHERE lower(btrim(a.name))='arthur machen'))
 ON CONFLICT(candidate_id,revision_sha256,kind) DO NOTHING;
END $backfill$;
COMMIT;
