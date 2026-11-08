-- ARTales editorial authority and default routing v1.
-- No historical task, audit, candidate, legal, snapshot or archive rows are rewritten.
-- Candidate creator is already durable in work_candidates.created_by.
-- The approving human is recorded in candidate_legal_decisions.reviewed_by.
-- Private non-exposed functions enforce scope and answer only boolean/assignee.
CREATE OR REPLACE FUNCTION artales_private.can_progress_candidate(p_candidate_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_actor uuid:=auth.uid(); v_origin text; v_creator uuid;
 v_role text; v_reviewer uuid;
BEGIN
 SELECT p.role::text INTO v_role FROM public.profiles p
 WHERE p.id=v_actor AND p.is_active AND p.role::text IN ('admin','editor');
 IF v_role IS NULL THEN RETURN false; END IF;
 SELECT c.origin,c.created_by INTO v_origin,v_creator
 FROM public.work_candidates c WHERE c.id=p_candidate_id;
 IF NOT FOUND THEN RETURN false; END IF;
 IF v_role='admin' THEN RETURN true; END IF;
 IF v_origin='manual' THEN RETURN v_creator=v_actor; END IF;
 IF v_origin<>'prescreen' THEN RETURN false; END IF;
 SELECT d.reviewed_by INTO v_reviewer
 FROM public.candidate_legal_locks l
 JOIN public.candidate_legal_decisions d
  ON d.candidate_id=l.candidate_id AND d.source_id=l.source_id
   AND d.decision_no=l.decision_no
 WHERE l.candidate_id=p_candidate_id AND d.verdict='approved'
 LIMIT 1;
 IF FOUND THEN RETURN v_reviewer=v_actor; END IF;
 SELECT d.reviewed_by INTO v_reviewer FROM public.candidate_legal_decisions d
 WHERE d.candidate_id=p_candidate_id AND d.verdict='approved'
 ORDER BY d.decision_no DESC LIMIT 1;
 IF FOUND THEN RETURN v_reviewer=v_actor; END IF;
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION artales_private.can_progress_candidate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artales_private.can_progress_candidate(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION artales_private.can_assign_candidate(p_candidate_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_actor uuid:=auth.uid(); v_role text; v_origin text; v_creator uuid;
BEGIN
 SELECT p.role::text INTO v_role FROM public.profiles p
 WHERE p.id=v_actor AND p.is_active AND p.role::text IN ('admin','editor');
 IF v_role IS NULL THEN RETURN false; END IF;
 SELECT c.origin,c.created_by INTO v_origin,v_creator
 FROM public.work_candidates c WHERE c.id=p_candidate_id;
 IF NOT FOUND THEN RETURN false; END IF;
 IF v_role='admin' THEN RETURN true; END IF;
 IF NOT artales_private.can_progress_candidate(p_candidate_id) THEN RETURN false; END IF;
 IF v_origin='manual' THEN RETURN v_creator=v_actor; END IF;
 RETURN EXISTS(
  SELECT 1 FROM public.candidate_legal_locks l
  JOIN public.candidate_legal_decisions d
   ON d.candidate_id=l.candidate_id AND d.source_id=l.source_id
    AND d.decision_no=l.decision_no
  WHERE l.candidate_id=p_candidate_id AND d.verdict='approved'
   AND d.reviewed_by=v_actor
 );
END $fn$;
REVOKE ALL ON FUNCTION artales_private.can_assign_candidate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artales_private.can_assign_candidate(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION artales_private.editorial_assignee_eligible(
 p_assignee uuid,p_kind text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT EXISTS(
  SELECT 1 FROM public.profiles p WHERE p.id=p_assignee AND p.is_active
   AND (p.role::text='admin' OR (p.role::text='editor' AND EXISTS(
     SELECT 1 FROM public.artales_editorial_capabilities c
     WHERE c.profile_id=p.id AND c.kind=p_kind)))
 );
$fn$;
REVOKE ALL ON FUNCTION artales_private.editorial_assignee_eligible(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artales_private.editorial_assignee_eligible(uuid,text) TO authenticated;

-- The initial owner is candidate creator for manual titles, human legal auditor
-- for shared Prescreen titles. Any competency mismatch defers visual work to
-- the existing visual defaults; no automatic capacity/reputation scoring yet.
CREATE OR REPLACE FUNCTION artales_private.initial_editorial_task_owner(
 p_candidate_id uuid,p_kind text,p_previous_owner uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_origin text;v_creator uuid;v_owner uuid;v_fallback uuid;v_legacy uuid;
BEGIN
 IF NOT artales_private.can_progress_candidate(p_candidate_id) THEN RETURN NULL; END IF;
 IF p_kind='text_review' THEN
  SELECT l.assigned_to INTO v_legacy FROM public.artales_legacy_transfers l
  WHERE l.candidate_id=p_candidate_id LIMIT 1;
  IF v_legacy IS NOT NULL AND
     artales_private.editorial_assignee_eligible(v_legacy,p_kind)
  THEN RETURN v_legacy; END IF;
 END IF;
 IF p_previous_owner IS NOT NULL AND
    artales_private.editorial_assignee_eligible(p_previous_owner,p_kind)
 THEN RETURN p_previous_owner; END IF;
 SELECT c.origin,c.created_by INTO v_origin,v_creator
 FROM public.work_candidates c WHERE c.id=p_candidate_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF v_origin='manual' THEN v_owner:=v_creator;
 ELSIF v_origin='prescreen' THEN
  SELECT d.reviewed_by INTO v_owner FROM public.candidate_legal_locks l
  JOIN public.candidate_legal_decisions d
   ON d.candidate_id=l.candidate_id AND d.source_id=l.source_id
    AND d.decision_no=l.decision_no
  WHERE l.candidate_id=p_candidate_id AND d.verdict='approved'
  LIMIT 1;
 END IF;
 -- Visual work defaults to an actual visual editor for an admin or
 -- a contributor without the relevant capability; Ivana may own everything.
 IF v_owner IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.profiles owner_profile WHERE owner_profile.id=v_owner
     AND owner_profile.role::text='editor'
 ) AND artales_private.editorial_assignee_eligible(v_owner,p_kind)
 THEN RETURN v_owner; END IF;
 IF v_owner IS NOT NULL AND p_kind NOT IN
    ('cover_art','author_visual','collection_curation','visual_review')
    AND artales_private.editorial_assignee_eligible(v_owner,p_kind)
 THEN RETURN v_owner; END IF;
 IF p_kind IN ('cover_art','author_visual','collection_curation','visual_review') THEN
  SELECT d.assigned_to INTO v_fallback
  FROM public.artales_editorial_default_owners d WHERE d.kind=p_kind LIMIT 1;
  IF v_fallback IS NOT NULL AND
     artales_private.editorial_assignee_eligible(v_fallback,p_kind)
  THEN RETURN v_fallback; END IF;
 END IF;
 -- Never leave a text task orphaned merely because the admin, rather
 -- than an editor, took the source through legal review.
 IF v_owner IS NOT NULL AND artales_private.editorial_assignee_eligible(v_owner,p_kind)
 THEN RETURN v_owner; END IF;
 RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION artales_private.initial_editorial_task_owner(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artales_private.initial_editorial_task_owner(uuid,text,uuid) TO authenticated;

-- Preserve creator, status and attachment verification; constrain mutation
-- of manually inserted titles to their original editor (or the admin).
ALTER POLICY work_candidates_editor_update ON public.work_candidates
 USING ((SELECT artales_private.can_progress_candidate(id)))
 WITH CHECK (
   updated_by=(SELECT auth.uid())
   AND (SELECT artales_private.can_progress_candidate(id))
 );

ALTER POLICY legal_sources_editor_insert ON public.candidate_legal_sources
 WITH CHECK (
  created_by=(SELECT auth.uid()) AND updated_by=(SELECT auth.uid())
  AND (SELECT artales_private.can_progress_candidate(candidate_id))
 );
ALTER POLICY legal_sources_editor_update ON public.candidate_legal_sources
 USING ((SELECT artales_private.can_progress_candidate(candidate_id)))
 WITH CHECK (updated_by=(SELECT auth.uid())
  AND (SELECT artales_private.can_progress_candidate(candidate_id)));
ALTER POLICY legal_decisions_editor_insert ON public.candidate_legal_decisions
 WITH CHECK (reviewed_by=(SELECT auth.uid()) AND
   (SELECT artales_private.can_progress_candidate(candidate_id)));
ALTER POLICY legal_locks_insert ON public.candidate_legal_locks
 WITH CHECK (locked_by=(SELECT auth.uid()) AND
   (SELECT artales_private.can_progress_candidate(candidate_id)));
ALTER POLICY illustration_editor_insert ON public.candidate_legal_illustrations
 WITH CHECK (created_by=(SELECT auth.uid()) AND EXISTS(
  SELECT 1 FROM public.candidate_legal_sources s WHERE s.id=source_id
   AND (SELECT artales_private.can_progress_candidate(s.candidate_id))
 ));

-- Editor may archive and automatically verify only their authorized title.
-- Immutable claim, legal lock, exact source and storage checks are retained.
ALTER POLICY artales_snapshot_claim_insert_v1 ON public.candidate_snapshot_claims
 WITH CHECK (
  claimed_by=(SELECT auth.uid())
  AND (SELECT artales_private.can_progress_candidate(candidate_id))
  AND EXISTS(SELECT 1 FROM public.candidate_legal_locks l
   JOIN public.candidate_legal_decisions d ON d.decision_no=l.decision_no
   WHERE l.candidate_id=candidate_snapshot_claims.candidate_id
    AND l.source_id=candidate_snapshot_claims.source_id
    AND l.decision_no=candidate_snapshot_claims.decision_no
    AND d.candidate_id=l.candidate_id AND d.source_id=l.source_id
    AND d.verdict='approved' AND d.territory='CZ/EU'
    AND l.source_url='https://www.gutenberg.org/ebooks/'||gutenberg_id::text)
 );
ALTER POLICY artales_snapshot_claimed_admin_insert_v2 ON storage.objects
 WITH CHECK (
  bucket_id='artales-raw-snapshots'
  AND owner_id=(SELECT auth.uid())::text
  AND EXISTS(SELECT 1 FROM public.candidate_snapshot_claims c
   JOIN public.candidate_legal_locks l ON l.candidate_id=c.candidate_id
     AND l.source_id=c.source_id AND l.decision_no=c.decision_no
   JOIN public.candidate_legal_decisions d ON d.candidate_id=l.candidate_id
     AND d.source_id=l.source_id AND d.decision_no=l.decision_no
   WHERE c.claimed_by=(SELECT auth.uid())
    AND (SELECT artales_private.can_progress_candidate(c.candidate_id))
    AND d.verdict='approved' AND d.territory='CZ/EU'
    AND l.source_url='https://www.gutenberg.org/ebooks/'||c.gutenberg_id::text
    AND name='gutenberg/'||c.gutenberg_id::text||'/sha256/'||c.sha256||'/original.epub')
 );
ALTER POLICY artales_snapshot_claimed_admin_readback_v2 ON storage.objects
 USING (
  bucket_id='artales-raw-snapshots'
  AND owner_id=(SELECT auth.uid())::text
  AND EXISTS(SELECT 1 FROM public.candidate_snapshot_claims c
   JOIN public.candidate_legal_locks l ON l.candidate_id=c.candidate_id
     AND l.source_id=c.source_id AND l.decision_no=c.decision_no
   JOIN public.candidate_legal_decisions d ON d.candidate_id=l.candidate_id
     AND d.source_id=l.source_id AND d.decision_no=l.decision_no
   WHERE c.claimed_by=(SELECT auth.uid())
    AND (SELECT artales_private.can_progress_candidate(c.candidate_id))
    AND d.verdict='approved' AND d.territory='CZ/EU'
    AND l.source_url='https://www.gutenberg.org/ebooks/'||c.gutenberg_id::text
    AND name='gutenberg/'||c.gutenberg_id::text||'/sha256/'||c.sha256||'/original.epub')
 );
ALTER POLICY artales_snapshot_receipt_insert_v1 ON public.candidate_snapshots
 WITH CHECK (
  recorded_by=(SELECT auth.uid())
  AND (SELECT artales_private.can_progress_candidate(candidate_id))
  AND EXISTS(SELECT 1 FROM public.candidate_snapshot_claims c
   JOIN public.candidate_legal_locks l ON l.candidate_id=c.candidate_id
   JOIN public.candidate_legal_decisions d ON d.candidate_id=l.candidate_id
     AND d.source_id=l.source_id AND d.decision_no=l.decision_no
   JOIN storage.objects o ON o.bucket_id=candidate_snapshots.storage_bucket
     AND o.name=candidate_snapshots.storage_path
   WHERE c.candidate_id=candidate_snapshots.candidate_id
    AND c.source_id=candidate_snapshots.source_id
    AND c.decision_no=candidate_snapshots.decision_no
    AND c.gutenberg_id=candidate_snapshots.gutenberg_id
    AND c.sha256=candidate_snapshots.sha256
    AND c.claimed_by=(SELECT auth.uid())
    AND l.source_id=c.source_id AND l.decision_no=c.decision_no
    AND l.source_url=candidate_snapshots.catalog_url
    AND l.download_url=candidate_snapshots.locked_file_url
    AND d.verdict='approved' AND d.territory='CZ/EU'
    AND o.owner_id=(SELECT auth.uid())::text
    AND o.metadata->>'mimetype'='application/epub+zip'
    AND o.metadata->>'size'=candidate_snapshots.byte_count::text)
 );
ALTER POLICY artales_snapshot_review_insert_v1 ON public.candidate_snapshot_reviews
 WITH CHECK (reviewed_by=(SELECT auth.uid())
  AND (SELECT artales_private.can_progress_candidate(candidate_id)));
ALTER POLICY semantic_admin_insert ON public.candidate_semantic_revisions
 WITH CHECK (
  authored_by=(SELECT auth.uid()) AND status='draft'
  AND (SELECT artales_private.can_progress_candidate(candidate_id))
  AND EXISTS(SELECT 1 FROM public.candidate_snapshot_reviews r
   WHERE r.candidate_id=candidate_semantic_revisions.candidate_id
    AND r.snapshot_sha256=candidate_semantic_revisions.snapshot_sha256
    AND r.text_correspondence='confirmed'
    AND r.image_disposition='exclude_all'
    AND r.id=(SELECT z.id FROM public.candidate_snapshot_reviews z
     WHERE z.candidate_id=r.candidate_id ORDER BY z.reviewed_at DESC,z.id DESC LIMIT 1))
 );

-- Tasks continue to be generated in the same transaction as semantic revision.
ALTER POLICY task_admin_insert ON public.artales_editorial_tasks
 WITH CHECK (
  created_by=(SELECT auth.uid()) AND status='open'
  AND (SELECT artales_private.can_progress_candidate(candidate_id))
  AND (assigned_to IS NULL OR
    artales_private.editorial_assignee_eligible(assigned_to,kind))
  AND EXISTS(SELECT 1 FROM public.candidate_semantic_revisions r
   WHERE r.candidate_id=artales_editorial_tasks.candidate_id
    AND r.revision_sha256=artales_editorial_tasks.revision_sha256)
 );

CREATE OR REPLACE FUNCTION public.artales_auto_enqueue_semantic_tasks()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $fn$
DECLARE v_author_name text;v_work_title text;v_text_owner uuid;
 v_has_author boolean;
BEGIN
 IF NEW.status<>'draft' OR EXISTS(SELECT 1 FROM public.artales_semantic_publications p
  WHERE p.candidate_id=NEW.candidate_id) THEN RETURN NEW; END IF;
 SELECT c.proposed_title,c.proposed_author_name INTO v_work_title,v_author_name
 FROM public.work_candidates c WHERE c.id=NEW.candidate_id;
 IF v_work_title IS NULL OR v_author_name IS NULL THEN
  RAISE EXCEPTION 'editorial_candidate_metadata_missing' USING errcode='23514';END IF;
 SELECT t.assigned_to INTO v_text_owner FROM public.artales_editorial_tasks t
 WHERE t.candidate_id=NEW.candidate_id AND t.kind='text_review'
 ORDER BY t.created_at DESC,t.id DESC LIMIT 1;
 v_text_owner:=artales_private.initial_editorial_task_owner(
  NEW.candidate_id,'text_review',v_text_owner);
 INSERT INTO public.artales_editorial_tasks
  (candidate_id,revision_sha256,kind,title,assigned_to,created_by)
 VALUES(NEW.candidate_id,NEW.revision_sha256,'text_review',
  'QA textu — '||left(v_work_title,180),v_text_owner,NEW.authored_by)
 ON CONFLICT(candidate_id,revision_sha256,kind) DO NOTHING;
 SELECT EXISTS(SELECT 1 FROM public.authors a WHERE
  lower(btrim(a.name))=lower(btrim(v_author_name))) INTO v_has_author;
 INSERT INTO public.artales_editorial_tasks
  (candidate_id,revision_sha256,kind,title,assigned_to,created_by)
 SELECT NEW.candidate_id,NEW.revision_sha256,v.kind,
  v.label||' — '||left(v_work_title,170),
  artales_private.initial_editorial_task_owner(NEW.candidate_id,v.kind,NULL),
  NEW.authored_by
 FROM (VALUES ('cover_art','Obálka díla'),('work_description','Anotace díla'),
  ('collection_curation','Kolekce a zařazení díla'),
  ('author_visual','Vizuál autora'),('author_bio','Profil a text autora'))
 v(kind,label)
 WHERE (v.kind NOT IN ('author_visual','author_bio') OR NOT v_has_author)
  AND NOT EXISTS(SELECT 1 FROM public.artales_editorial_tasks prior
   WHERE prior.candidate_id=NEW.candidate_id AND prior.kind=v.kind)
 ON CONFLICT(candidate_id,revision_sha256,kind) DO NOTHING;
 RETURN NEW;
END $fn$;

-- Existing RPC is intentionally reused: audited reassignment, competency
-- checks, legacy QA reservation and one identity-bound transaction.
CREATE OR REPLACE FUNCTION public.artales_reassign_editorial_task(
 p_task_id uuid,p_new_assignee uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_actor uuid:=auth.uid();v_task public.artales_editorial_tasks%ROWTYPE;
 v_role text; v_note text;
BEGIN
 SELECT p.role::text INTO v_role FROM public.profiles p
  WHERE p.id=v_actor AND p.is_active AND p.role::text IN ('admin','editor');
 IF v_role IS NULL THEN
  RAISE EXCEPTION 'editorial_staff_required' USING errcode='42501'; END IF;
 SELECT * INTO v_task FROM public.artales_editorial_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND OR v_task.status IN ('completed','superseded')
   OR v_task.assigned_to=p_new_assignee
 THEN RETURN pg_catalog.jsonb_build_object('result','unavailable'); END IF;
 IF NOT artales_private.can_assign_candidate(v_task.candidate_id) THEN
  RAISE EXCEPTION 'editorial_assignment_authority_required' USING errcode='42501'; END IF;
 v_note:=btrim(coalesce(p_reason,''));
 IF v_role='admin' AND v_note='' THEN
  v_note:='Administrátor upravil přiřazení redakčního úkolu.';
 ELSIF length(v_note) NOT BETWEEN 20 AND 1000 THEN
  RETURN pg_catalog.jsonb_build_object('result','reason_required');
 END IF;
 IF NOT artales_private.editorial_assignee_eligible(p_new_assignee,v_task.kind)
 THEN RETURN pg_catalog.jsonb_build_object('result','not_eligible'); END IF;
 IF v_task.kind='text_review' AND EXISTS(
  SELECT 1 FROM public.artales_legacy_transfers l
  WHERE l.candidate_id=v_task.candidate_id AND l.assigned_to<>p_new_assignee)
 THEN RETURN pg_catalog.jsonb_build_object('result','legacy_reserved'); END IF;
 UPDATE public.artales_editorial_tasks
 SET assigned_to=p_new_assignee,
  status=CASE WHEN status='claimed' THEN 'returned' ELSE status END
 WHERE id=v_task.id;
 INSERT INTO public.artales_editorial_events
  (task_id,actor_id,action,note,from_assignee,to_assignee)
 VALUES(v_task.id,v_actor,'reassigned',v_note,v_task.assigned_to,p_new_assignee);
 RETURN pg_catalog.jsonb_build_object('result','reassigned','task_id',v_task.id);
END $fn$;
