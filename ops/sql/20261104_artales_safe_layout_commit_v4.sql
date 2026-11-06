-- ARTales safe layout-only persisted revisions; DRAFT until separately approved.
-- Server authenticates the editor and recomposes the entire revision deterministically.
-- SQL is a second independent barrier: source, gaps, marks, headings, ordering,
-- exclusions, metadata, existing issue history are compared as typed JSONB.
BEGIN;
CREATE OR REPLACE FUNCTION public.artales_strip_semantic_presentation(p_value jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $strip$
DECLARE v_result jsonb;v_key text;v_value jsonb;
BEGIN
 IF pg_catalog.jsonb_typeof(p_value)='object' THEN
  v_result:='{}'::jsonb;
  FOR v_key,v_value IN SELECT key,value FROM pg_catalog.jsonb_each(p_value) LOOP
   IF v_key<>'presentation' THEN
    v_result:=v_result||pg_catalog.jsonb_build_object(v_key,public.artales_strip_semantic_presentation(v_value));
   END IF;
  END LOOP;
  RETURN v_result;
 ELSIF pg_catalog.jsonb_typeof(p_value)='array' THEN
  SELECT pg_catalog.coalesce(pg_catalog.jsonb_agg(public.artales_strip_semantic_presentation(a.value) ORDER BY a.ordinality),'[]'::jsonb)
   INTO v_result FROM pg_catalog.jsonb_array_elements(p_value) WITH ORDINALITY a(value,ordinality);
  RETURN v_result;
 END IF;
 RETURN p_value;
END $strip$;
REVOKE ALL ON FUNCTION public.artales_strip_semantic_presentation(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_strip_semantic_presentation(jsonb) TO service_role;


-- Shape-independent proof: every presentation delta is attributed to exactly
-- one source-anchored QA flag; all unchanged node subtrees remain byte-equivalent
-- under the source/structure comparison below.
CREATE OR REPLACE FUNCTION public.artales_semantic_presentation_index(
 p_nodes jsonb,p_prefix text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $index$
DECLARE v_node jsonb;v_ord bigint;v_path text;v_index jsonb:='{}'::jsonb;
 v_kind text;v_targets jsonb;v_piece jsonb;
BEGIN
 IF pg_catalog.jsonb_typeof(p_nodes)<>'array' THEN
  RAISE EXCEPTION 'invalid_semantic_nodes'; END IF;
 FOR v_node,v_ord IN SELECT value,ordinality
  FROM pg_catalog.jsonb_array_elements(p_nodes) WITH ORDINALITY AS n(value,ordinality)
 LOOP
  v_path:=p_prefix||'/'||v_ord::text;
  v_kind:=v_node->>'kind';
  IF v_kind NOT IN ('chapter','section','paragraph','quote','epigraph','footnote','poem')
   OR v_node->>'id' IS NULL THEN RAISE EXCEPTION 'invalid_semantic_node'; END IF;
  IF v_kind IN ('chapter','section') THEN
   v_targets:=pg_catalog.jsonb_build_array(v_node#>>'{heading,id}');
  ELSIF v_kind='poem' THEN
   SELECT pg_catalog.coalesce(pg_catalog.jsonb_agg(line.value#>>'{atom,id}'),'[]'::jsonb)
   INTO v_targets FROM pg_catalog.jsonb_array_elements(v_node->'stanzas') s
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(s.value->'lines') line;
  ELSE
   v_targets:=pg_catalog.jsonb_build_array(v_node#>>'{atom,id}');
  END IF;
  v_piece:=pg_catalog.jsonb_build_object(
   'presentation',pg_catalog.coalesce(v_node->'presentation','null'::jsonb),
   'targets',v_targets);
  v_index:=v_index||pg_catalog.jsonb_build_object(v_path,v_piece);
  IF v_kind IN ('chapter','section') THEN
   v_index:=v_index||public.artales_semantic_presentation_index(v_node->'children',v_path);
  END IF;
 END LOOP;
 RETURN v_index;
END $index$;
REVOKE ALL ON FUNCTION public.artales_semantic_presentation_index(jsonb,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_semantic_presentation_index(jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.artales_commit_safe_layout_revision(
 p_candidate_id uuid,p_parent_sha text,p_revision jsonb,p_flag_ids uuid[],p_editor_id uuid,
 p_job_id uuid DEFAULT NULL,p_job_suggestions jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $commit$
DECLARE v_parent public.candidate_semantic_revisions%ROWTYPE;v_editor uuid;
 v_flags integer;v_issues integer;v_new_sha text;v_added jsonb;v_changed integer;
 v_old_index jsonb;v_new_index jsonb;v_path text;v_item jsonb;
 v_matched integer;v_job public.artales_semantic_ai_qa_jobs%ROWTYPE;
BEGIN
 IF current_setting('request.jwt.claim.role',true)<>'service_role'
 THEN RAISE EXCEPTION 'service_only_layout_commit' USING errcode='42501';END IF;
 IF p_parent_sha !~ '^[a-f0-9]{64}$' OR p_revision IS NULL
  OR pg_catalog.jsonb_typeof(p_revision)<>'object'
  OR p_flag_ids IS NULL OR pg_catalog.cardinality(p_flag_ids) NOT BETWEEN 1 AND 50
  OR (SELECT count(DISTINCT x) FROM pg_catalog.unnest(p_flag_ids) x)<>pg_catalog.cardinality(p_flag_ids)
 THEN RETURN pg_catalog.jsonb_build_object('result','invalid_batch');END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_candidate_id::text)::bigint);
 SELECT * INTO v_parent FROM public.candidate_semantic_revisions
 WHERE candidate_id=p_candidate_id ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR v_parent.revision_sha256<>p_parent_sha THEN
  RETURN pg_catalog.jsonb_build_object('result','stale_revision');END IF;
 SELECT assigned_to INTO v_editor FROM public.artales_editorial_tasks
 WHERE candidate_id=p_candidate_id AND revision_sha256=p_parent_sha
  AND kind='text_review' AND status='claimed' FOR UPDATE;
 IF v_editor IS NULL OR v_editor<>p_editor_id OR NOT EXISTS(
  SELECT 1 FROM public.profiles p WHERE p.id=p_editor_id
   AND p.is_active AND p.role::text IN ('admin','editor')) THEN
  RETURN pg_catalog.jsonb_build_object('result','not_current_editor');END IF;
 SELECT count(*) INTO v_flags FROM public.artales_semantic_qa_flags
 WHERE candidate_id=p_candidate_id AND revision_sha256=p_parent_sha AND status='open'
  AND kind IN ('typography','structure') AND id=ANY(p_flag_ids);
 IF v_flags<>pg_catalog.cardinality(p_flag_ids)
 THEN RETURN pg_catalog.jsonb_build_object('result','invalid_flags');END IF;
 v_new_sha:=p_revision->>'revision_sha256';
 IF v_new_sha !~ '^[a-f0-9]{64}$' OR v_new_sha=p_parent_sha
  OR p_revision->>'revision_ref'<>'sha256:'||v_new_sha
  OR p_revision->>'parent_revision_ref'<>'sha256:'||p_parent_sha
  OR (p_revision->>'round')::int<>(v_parent.revision->>'round')::int+1
  OR p_revision->'source' IS DISTINCT FROM v_parent.revision->'source'
  OR p_revision->'gaps' IS DISTINCT FROM v_parent.revision->'gaps'
  OR p_revision->'editorial_exclusions' IS DISTINCT FROM v_parent.revision->'editorial_exclusions'
  OR p_revision->'title_page' IS DISTINCT FROM v_parent.revision->'title_page'
  OR p_revision->>'work_id' IS DISTINCT FROM v_parent.revision->>'work_id'
  OR p_revision->>'work_slug' IS DISTINCT FROM v_parent.revision->>'work_slug'
  OR p_revision->>'composer_recipe' IS DISTINCT FROM v_parent.revision->>'composer_recipe'
  OR p_revision->>'schema'<>'artales.semantic-text.v2'
  OR p_revision->>'state'<>'draft_qa_only' OR p_revision->'release_allowed'<>'false'::jsonb
  OR public.artales_strip_semantic_presentation(p_revision->'blocks')
     IS DISTINCT FROM public.artales_strip_semantic_presentation(v_parent.revision->'blocks')
 THEN RETURN pg_catalog.jsonb_build_object('result','changed_source_or_structure');END IF;

 -- No unknown document-level fields can change: only explicit revision metadata,
 -- layout and review history differ. This also protects future schema additions.
 IF (p_revision - ARRAY['revision_sha256','revision_ref','parent_revision_ref',
                          'round','blocks','review_issues'])
   IS DISTINCT FROM
    (v_parent.revision - ARRAY['revision_sha256','revision_ref',
                              'parent_revision_ref','round','blocks','review_issues'])
 THEN RETURN pg_catalog.jsonb_build_object('result','changed_nonlayout_metadata');END IF;
 -- The JS composer verifies the exact original UTF-8 bytes. Postgres independently
 -- proves that EVERY changed presentation belongs to a specific flagged source atom.
 v_old_index:=public.artales_semantic_presentation_index(v_parent.revision->'blocks');
 v_new_index:=public.artales_semantic_presentation_index(p_revision->'blocks');
 IF (SELECT pg_catalog.array_agg(key ORDER BY key)
     FROM pg_catalog.jsonb_each(v_old_index))
   IS DISTINCT FROM
    (SELECT pg_catalog.array_agg(key ORDER BY key)
     FROM pg_catalog.jsonb_each(v_new_index))
 THEN RETURN pg_catalog.jsonb_build_object('result','changed_node_structure');END IF;
 v_changed:=0;
 FOR v_path,v_item IN SELECT key,value FROM pg_catalog.jsonb_each(v_old_index) LOOP
  IF v_item->'targets' IS DISTINCT FROM (v_new_index->v_path)->'targets'
  THEN RETURN pg_catalog.jsonb_build_object('result','changed_text_targets');END IF;
  IF v_item->'presentation' IS DISTINCT FROM
     (v_new_index->v_path)->'presentation' THEN
   v_changed:=v_changed+1;
   SELECT count(*) INTO v_matched
   FROM public.artales_semantic_qa_flags f
   JOIN LATERAL pg_catalog.jsonb_array_elements(p_revision->'review_issues')
     issue(value) ON issue.value->>'id'=f.id::text
   WHERE f.id=ANY(p_flag_ids) AND f.candidate_id=p_candidate_id
     AND f.revision_sha256=p_parent_sha AND f.status='open'
     AND (v_new_index->v_path->'targets') ? f.target_atom_id
     AND issue.value->>'requested_layout'='block_presentation'
     AND issue.value->'requested_presentation' IS NOT DISTINCT FROM
       (v_new_index->v_path)->'presentation';
   IF v_matched<>1 THEN
    RETURN pg_catalog.jsonb_build_object('result','unattributed_presentation_delta');
   END IF;
  END IF;
 END LOOP;
 IF v_changed<>v_flags THEN
  RETURN pg_catalog.jsonb_build_object('result','presentation_delta_count_mismatch');
 END IF;
 -- The optional job receipt is validated and completed in THIS SAME TRANSACTION.
 -- A crash cannot leave an already-created revision behind a running job.
 IF p_job_id IS NULL AND p_job_suggestions IS NOT NULL THEN
  RETURN pg_catalog.jsonb_build_object('result','unexpected_job_suggestions');
 END IF;
 IF p_job_id IS NOT NULL THEN
  SELECT * INTO v_job FROM public.artales_semantic_ai_qa_jobs
   WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.status<>'running'
   OR v_job.candidate_id<>p_candidate_id OR v_job.revision_sha256<>p_parent_sha
   OR v_job.created_by<>p_editor_id OR p_job_suggestions IS NULL
   OR pg_catalog.jsonb_typeof(p_job_suggestions)<>'array'
   OR pg_catalog.jsonb_array_length(p_job_suggestions)<>pg_catalog.cardinality(v_job.flag_ids)
   OR EXISTS(SELECT 1 FROM pg_catalog.unnest(p_flag_ids) flag
     WHERE NOT flag=ANY(v_job.flag_ids))
  THEN RETURN pg_catalog.jsonb_build_object('result','invalid_job_receipt');END IF;
  SELECT count(*) INTO v_matched
  FROM pg_catalog.jsonb_array_elements(p_job_suggestions) x
  WHERE x->>'action' IN ('compact','airy','center','protect_term','manual_review')
   AND (x->>'flagId') IN (
    SELECT f::text FROM pg_catalog.unnest(v_job.flag_ids) f
   );
  IF v_matched<>pg_catalog.cardinality(v_job.flag_ids)
   OR (SELECT count(DISTINCT x->>'flagId')
    FROM pg_catalog.jsonb_array_elements(p_job_suggestions) x)
      <>pg_catalog.cardinality(v_job.flag_ids) THEN
   RETURN pg_catalog.jsonb_build_object('result','invalid_job_suggestions');
  END IF;
 END IF;

 v_issues:=pg_catalog.jsonb_array_length(v_parent.revision->'review_issues');
 IF pg_catalog.jsonb_array_length(p_revision->'review_issues')<>v_issues+v_flags
  OR pg_catalog.coalesce((SELECT pg_catalog.jsonb_agg(value ORDER BY ordinality)
    FROM pg_catalog.jsonb_array_elements(p_revision->'review_issues') WITH ORDINALITY i(value,ordinality)
    WHERE ordinality<=v_issues),'[]'::jsonb) IS DISTINCT FROM v_parent.revision->'review_issues'
 THEN RETURN pg_catalog.jsonb_build_object('result','issue_history_changed');END IF;
 FOR v_added IN SELECT value FROM pg_catalog.jsonb_array_elements(p_revision->'review_issues')
   WITH ORDINALITY i(value,ordinality) WHERE ordinality>v_issues LOOP
  IF v_added->>'requested_layout'<>'block_presentation'
   OR (v_added->>'round')::int<>(p_revision->>'round')::int
   OR v_added->>'parent_revision_ref'<>'sha256:'||p_parent_sha
   OR NOT EXISTS(SELECT 1 FROM public.artales_semantic_qa_flags f
    WHERE f.id::text=v_added->>'id' AND f.id=ANY(p_flag_ids)
     AND f.target_atom_id=v_added->>'target_atom_id' AND f.comment=v_added->>'reason')
  THEN RETURN pg_catalog.jsonb_build_object('result','unverified_presentation_change');END IF;
 END LOOP;
 INSERT INTO public.candidate_semantic_revisions(candidate_id,snapshot_sha256,revision_sha256,
  revision,source_text,component_id,source_manifest,image_selection,status,authored_by)
 VALUES(p_candidate_id,v_parent.snapshot_sha256,v_new_sha,p_revision,v_parent.source_text,
  v_parent.component_id,v_parent.source_manifest,v_parent.image_selection,'draft',p_editor_id);
 UPDATE public.artales_semantic_qa_flags SET status='resolved',resolved_by=p_editor_id,
  resolved_at=now(),resolution_note='Formátování v revizi '||v_new_sha||
  ' čeká na výslovné přijetí editorem.'
 WHERE candidate_id=p_candidate_id AND revision_sha256=p_parent_sha
  AND status='open' AND id=ANY(p_flag_ids);
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF v_changed<>v_flags THEN RAISE EXCEPTION 'qa_flag_race';END IF;
 INSERT INTO public.artales_semantic_qa_flags(candidate_id,revision_sha256,target_atom_id,
  source_start,source_end,kind,comment,created_by)
 SELECT candidate_id,v_new_sha,target_atom_id,source_start,source_end,kind,comment,created_by
 FROM public.artales_semantic_qa_flags
 WHERE candidate_id=p_candidate_id AND revision_sha256=p_parent_sha AND status='open';
 IF NOT EXISTS(SELECT 1 FROM public.artales_editorial_tasks t
  WHERE t.candidate_id=p_candidate_id AND t.revision_sha256=v_new_sha
   AND t.kind='text_review' AND t.assigned_to=p_editor_id AND t.status='open')
 THEN RAISE EXCEPTION 'followup_qa_missing';END IF;
 UPDATE public.artales_editorial_tasks SET status='superseded'
 WHERE candidate_id=p_candidate_id AND revision_sha256=p_parent_sha
  AND kind='text_review' AND assigned_to=p_editor_id AND status='claimed';
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF v_changed<>1 THEN RAISE EXCEPTION 'supersede_failed';END IF;
 INSERT INTO public.artales_editorial_events(task_id,actor_id,action,note)
 SELECT t.id,p_editor_id,'superseded','Nahrazena revizí '||v_new_sha
 FROM public.artales_editorial_tasks t
 WHERE t.candidate_id=p_candidate_id AND t.revision_sha256=p_parent_sha
  AND t.kind='text_review' AND t.status='superseded';
 
 IF p_job_id IS NOT NULL THEN
  UPDATE public.artales_semantic_ai_qa_jobs SET status='completed',
   suggestions=p_job_suggestions,applied_revision_sha256=v_new_sha,
   updated_at=now(),finished_at=now()
  WHERE id=p_job_id AND status='running';
  GET DIAGNOSTICS v_matched=ROW_COUNT;
  IF v_matched<>1 THEN RAISE EXCEPTION 'atomic_job_receipt_failed';END IF;
 END IF;
 
 RETURN pg_catalog.jsonb_build_object('result','created','revision_sha256',v_new_sha,'changes',v_flags);
END $commit$;
REVOKE ALL ON FUNCTION public.artales_commit_safe_layout_revision(uuid,text,jsonb,uuid[],uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_commit_safe_layout_revision(uuid,text,jsonb,uuid[],uuid,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.artales_editorial_owner(text,text) TO service_role;
COMMIT;
