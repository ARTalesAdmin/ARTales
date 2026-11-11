-- ARTales: canonical editor-authorized, source-preserving edition exclusions.
-- The caller is an authorized server using service_role; p_editor_id is
-- independently checked against an active exact-revision QA assignment.
CREATE OR REPLACE FUNCTION public.artales_commit_editorial_exclusions(
 p_candidate_id uuid,p_parent_sha text,p_revision jsonb,p_flag_ids uuid[],p_editor_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_old public.candidate_semantic_revisions%ROWTYPE;
 v_new_sha text;v_new jsonb;v_prior jsonb;v_delta jsonb;v_expected jsonb;
 v_flags integer;v_changed integer;v_issue jsonb;v_old_count integer;
BEGIN
 IF current_setting('request.jwt.claim.role',true)<>'service_role'
 THEN RAISE EXCEPTION 'service_only_editorial_exclusions' USING errcode='42501';END IF;
 IF p_parent_sha !~ '^[a-f0-9]{64}$' OR p_revision IS NULL OR
  pg_catalog.jsonb_typeof(p_revision)<>'object' OR p_editor_id IS NULL OR
  p_flag_ids IS NULL OR pg_catalog.cardinality(p_flag_ids) NOT BETWEEN 1 AND 50 OR
  (SELECT count(DISTINCT id) FROM pg_catalog.unnest(p_flag_ids) id)
   <>pg_catalog.cardinality(p_flag_ids)
 THEN RETURN pg_catalog.jsonb_build_object('result','invalid_batch');END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_candidate_id::text)::bigint);
 SELECT * INTO v_old FROM public.candidate_semantic_revisions
 WHERE candidate_id=p_candidate_id ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR v_old.revision_sha256<>p_parent_sha
 THEN RETURN pg_catalog.jsonb_build_object('result','stale_revision');END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_editor_id AND p.is_active
     AND p.role::text IN ('admin','editor')) OR
    NOT EXISTS(SELECT 1 FROM public.artales_editorial_tasks t
     WHERE t.candidate_id=p_candidate_id AND t.revision_sha256=p_parent_sha
      AND t.kind='text_review' AND t.status='claimed' AND t.assigned_to=p_editor_id)
 THEN RETURN pg_catalog.jsonb_build_object('result','not_current_editor');END IF;
 SELECT count(*) INTO v_flags FROM public.artales_semantic_qa_flags f
 WHERE f.candidate_id=p_candidate_id AND f.revision_sha256=p_parent_sha
  AND f.status='open' AND f.kind IN ('text','structure','other')
  AND f.id=ANY(p_flag_ids);
 IF v_flags<>pg_catalog.cardinality(p_flag_ids)
 THEN RETURN pg_catalog.jsonb_build_object('result','invalid_flags');END IF;
 v_new_sha:=p_revision->>'revision_sha256';
 IF v_new_sha IS NULL OR v_new_sha !~ '^[a-f0-9]{64}$' OR v_new_sha=p_parent_sha OR
  p_revision->>'revision_ref'<>'sha256:'||v_new_sha OR
  p_revision->>'parent_revision_ref'<>'sha256:'||p_parent_sha OR
  (p_revision->>'round')::int<>(v_old.revision->>'round')::int+1 OR
  p_revision->'source' IS DISTINCT FROM v_old.revision->'source' OR
  p_revision->'blocks' IS DISTINCT FROM v_old.revision->'blocks' OR
  p_revision->'gaps' IS DISTINCT FROM v_old.revision->'gaps' OR
  p_revision->'title_page' IS DISTINCT FROM v_old.revision->'title_page' OR
  p_revision->>'work_id' IS DISTINCT FROM v_old.revision->>'work_id' OR
  p_revision->>'work_slug' IS DISTINCT FROM v_old.revision->>'work_slug' OR
  p_revision->>'schema'<>'artales.semantic-text.v2' OR
  p_revision->>'state'<>'draft_qa_only' OR
  p_revision->'release_allowed'<>'false'::jsonb
 THEN RETURN pg_catalog.jsonb_build_object('result','changed_source_or_structure');END IF;
 -- Exclude precisely the explicitly flagged source atoms, and nothing else.
 v_prior:=COALESCE(v_old.revision->'editorial_exclusions','[]'::jsonb);
 v_new:=p_revision->'editorial_exclusions';
 IF pg_catalog.jsonb_typeof(v_prior)<>'array' OR
    pg_catalog.jsonb_typeof(v_new)<>'array' OR
    pg_catalog.jsonb_array_length(v_new)<>pg_catalog.jsonb_array_length(v_prior)+v_flags OR
    (SELECT count(DISTINCT x) FROM pg_catalog.jsonb_array_elements_text(v_new) x)
     <>pg_catalog.jsonb_array_length(v_new)
 THEN RETURN pg_catalog.jsonb_build_object('result','invalid_exclusions');END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements_text(v_prior) x WHERE NOT v_new ? x)
 THEN RETURN pg_catalog.jsonb_build_object('result','prior_exclusions_removed');END IF;
 SELECT COALESCE(pg_catalog.jsonb_agg(f.target_atom_id ORDER BY f.target_atom_id),'[]'::jsonb)
 INTO v_expected FROM public.artales_semantic_qa_flags f
 WHERE f.candidate_id=p_candidate_id AND f.revision_sha256=p_parent_sha
  AND f.status='open' AND f.id=ANY(p_flag_ids);
 SELECT COALESCE(pg_catalog.jsonb_agg(item ORDER BY item),'[]'::jsonb) INTO v_delta
 FROM pg_catalog.jsonb_array_elements_text(v_new) item
 WHERE NOT v_prior ? item;
 IF v_delta IS DISTINCT FROM v_expected
 THEN RETURN pg_catalog.jsonb_build_object('result','unattributed_exclusion');END IF;
 IF EXISTS(
  SELECT 1 FROM pg_catalog.jsonb_array_elements_text(v_delta) ident
  WHERE NOT EXISTS(
   SELECT 1 FROM pg_catalog.jsonb_path_query(v_old.revision,'$.blocks.**') n
   WHERE n->>'kind' IN ('paragraph','quote','epigraph','footnote')
    AND n->'atom'->>'id'=ident
  )
 ) THEN RETURN pg_catalog.jsonb_build_object('result','non_text_target');END IF;
 -- All non-revision fields remain byte-for-byte canonical JSONB equal.
 IF (p_revision-ARRAY['revision_sha256','revision_ref','parent_revision_ref','round',
                       'review_issues','editorial_exclusions'])
  IS DISTINCT FROM
    (v_old.revision-ARRAY['revision_sha256','revision_ref','parent_revision_ref','round',
                           'review_issues','editorial_exclusions'])
 THEN RETURN pg_catalog.jsonb_build_object('result','non_exclusion_metadata_changed');END IF;
 v_old_count:=pg_catalog.jsonb_array_length(v_old.revision->'review_issues');
 IF pg_catalog.jsonb_array_length(p_revision->'review_issues')<>v_old_count+v_flags OR
  COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY ordinality)
    FROM pg_catalog.jsonb_array_elements(p_revision->'review_issues')
     WITH ORDINALITY i(value,ordinality) WHERE ordinality<=v_old_count),'[]'::jsonb)
   IS DISTINCT FROM v_old.revision->'review_issues'
 THEN RETURN pg_catalog.jsonb_build_object('result','issue_history_changed');END IF;
 FOR v_issue IN SELECT value FROM pg_catalog.jsonb_array_elements(p_revision->'review_issues')
  WITH ORDINALITY i(value,ordinality) WHERE ordinality>v_old_count LOOP
  IF v_issue->>'requested_layout'<>'exclude_from_edition' OR
    (v_issue->>'round')::int<>(p_revision->>'round')::int OR
    v_issue->>'parent_revision_ref'<>'sha256:'||p_parent_sha OR
    NOT EXISTS(SELECT 1 FROM public.artales_semantic_qa_flags f
      WHERE f.id::text=v_issue->>'id' AND f.id=ANY(p_flag_ids)
       AND f.target_atom_id=v_issue->>'target_atom_id'
       AND f.comment=v_issue->>'reason')
  THEN RETURN pg_catalog.jsonb_build_object('result','unverified_exclusion_issue');END IF;
 END LOOP;
 INSERT INTO public.candidate_semantic_revisions(
   candidate_id,snapshot_sha256,revision_sha256,revision,source_text,
   component_id,source_manifest,image_selection,status,authored_by)
 VALUES(p_candidate_id,v_old.snapshot_sha256,v_new_sha,p_revision,v_old.source_text,
   v_old.component_id,v_old.source_manifest,v_old.image_selection,'draft',p_editor_id);
 UPDATE public.artales_semantic_qa_flags SET status='resolved',resolved_by=p_editor_id,
  resolved_at=pg_catalog.now(),
  resolution_note='Vyřazeno pouze z ARTales edice; originál zachován, revize '||v_new_sha
 WHERE candidate_id=p_candidate_id AND revision_sha256=p_parent_sha
  AND status='open' AND id=ANY(p_flag_ids);
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF v_changed<>v_flags THEN RAISE EXCEPTION 'exclusion_flag_race';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.artales_editorial_tasks t
  WHERE t.candidate_id=p_candidate_id AND t.revision_sha256=v_new_sha
   AND t.kind='text_review' AND t.assigned_to=p_editor_id AND t.status='open')
 THEN RAISE EXCEPTION 'followup_qa_missing';END IF;
 UPDATE public.artales_editorial_tasks SET status='superseded'
 WHERE candidate_id=p_candidate_id AND revision_sha256=p_parent_sha
  AND kind='text_review' AND assigned_to=p_editor_id AND status='claimed';
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF v_changed<>1 THEN RAISE EXCEPTION 'supersede_failed';END IF;
 UPDATE public.artales_editorial_tasks SET status='claimed'
 WHERE candidate_id=p_candidate_id AND revision_sha256=v_new_sha
  AND kind='text_review' AND assigned_to=p_editor_id AND status='open';
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF v_changed<>1 THEN RAISE EXCEPTION 'qa_session_continuation_failed';END IF;
 RETURN pg_catalog.jsonb_build_object('result','created','revision_sha256',v_new_sha,'changes',v_flags);
END $function$;
REVOKE ALL ON FUNCTION public.artales_commit_editorial_exclusions(uuid,text,jsonb,uuid[],uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_commit_editorial_exclusions(uuid,text,jsonb,uuid[],uuid) TO service_role;

-- Finish guards must recognize the same uniquely linked full-name author
-- as artales_save_candidate_editorial_field, preserving bilingual/visual proofs.

CREATE OR REPLACE FUNCTION public.artales_guard_editorial_task_evidence()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE m public.artales_candidate_editorial_metadata%ROWTYPE;v_valid boolean;
BEGIN
 IF NEW.status<>'completed' OR OLD.status='completed'
  OR NEW.kind NOT IN ('collection_curation','cover_art','work_description','author_bio','author_visual')
 THEN RETURN NEW; END IF;
 SELECT * INTO m FROM public.artales_candidate_editorial_metadata
 WHERE candidate_id=NEW.candidate_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'editorial_evidence_missing' USING errcode='23514'; END IF;
 v_valid:=CASE NEW.kind
  WHEN 'collection_curation' THEN m.collection_id IS NOT NULL
   AND EXISTS(SELECT 1 FROM public.collections c WHERE c.id=m.collection_id
    AND char_length(btrim(coalesce(c.description_cs,''))) BETWEEN 200 AND 800
    AND char_length(btrim(coalesce(c.description_en,''))) BETWEEN 200 AND 800)
  WHEN 'cover_art' THEN m.cover_image_path IS NOT NULL
   AND length(btrim(coalesce(m.cover_image_alt,'')))>=8
   AND EXISTS(SELECT 1 FROM storage.objects o
    WHERE o.bucket_id='artales-images' AND o.name=m.cover_image_path)
  WHEN 'work_description' THEN
   char_length(btrim(coalesce(m.work_description_cs,''))) BETWEEN 200 AND 800
   AND char_length(btrim(coalesce(m.work_description_en,''))) BETWEEN 200 AND 800
  WHEN 'author_bio' THEN m.author_id IS NOT NULL
   AND EXISTS(SELECT 1 FROM public.authors a JOIN public.work_candidates c ON c.id=m.candidate_id
    WHERE a.id=m.author_id
    AND (
     lower(btrim(a.name))=lower(btrim(c.proposed_author_name)) OR
     lower(btrim(coalesce(a.name_en,'')))=lower(btrim(c.proposed_author_name)) OR
     (pg_catalog.array_length(pg_catalog.regexp_split_to_array(btrim(c.proposed_author_name),'[[:space:]]+'),1)>=2
      AND NOT (
       pg_catalog.array_length(pg_catalog.regexp_split_to_array(btrim(c.proposed_author_name),'[[:space:]]+'),1)=2
       AND pg_catalog.split_part(lower(btrim(c.proposed_author_name)),' ',1)
         IN ('le','la','de','da','di','van','von','del','du','des','der')
      )
      AND (pg_catalog.right(lower(btrim(a.name)),pg_catalog.length(btrim(c.proposed_author_name))+1)
            =' '||lower(btrim(c.proposed_author_name))
       OR pg_catalog.right(lower(btrim(coalesce(a.name_en,''))),pg_catalog.length(btrim(c.proposed_author_name))+1)
            =' '||lower(btrim(c.proposed_author_name)))
      AND (SELECT count(*) FROM public.authors a2
       WHERE lower(btrim(a2.name))=lower(btrim(c.proposed_author_name))
        OR lower(btrim(coalesce(a2.name_en,'')))=lower(btrim(c.proposed_author_name))
        OR (pg_catalog.array_length(pg_catalog.regexp_split_to_array(btrim(c.proposed_author_name),'[[:space:]]+'),1)>=2
         AND (pg_catalog.right(lower(btrim(a2.name)),pg_catalog.length(btrim(c.proposed_author_name))+1)
               =' '||lower(btrim(c.proposed_author_name))
          OR pg_catalog.right(lower(btrim(coalesce(a2.name_en,''))),pg_catalog.length(btrim(c.proposed_author_name))+1)
               =' '||lower(btrim(c.proposed_author_name)))))=1
     )
    )
    AND char_length(btrim(coalesce(a.bio_en,''))) BETWEEN 200 AND 800
    AND char_length(btrim(coalesce(a.bio_cs,''))) BETWEEN 200 AND 800)
  WHEN 'author_visual' THEN m.author_id IS NOT NULL
   AND EXISTS(SELECT 1 FROM public.authors a JOIN public.work_candidates c ON c.id=m.candidate_id
    WHERE a.id=m.author_id
    AND (
     lower(btrim(a.name))=lower(btrim(c.proposed_author_name)) OR
     lower(btrim(coalesce(a.name_en,'')))=lower(btrim(c.proposed_author_name)) OR
     (pg_catalog.array_length(pg_catalog.regexp_split_to_array(btrim(c.proposed_author_name),'[[:space:]]+'),1)>=2
      AND NOT (
       pg_catalog.array_length(pg_catalog.regexp_split_to_array(btrim(c.proposed_author_name),'[[:space:]]+'),1)=2
       AND pg_catalog.split_part(lower(btrim(c.proposed_author_name)),' ',1)
         IN ('le','la','de','da','di','van','von','del','du','des','der')
      )
      AND (pg_catalog.right(lower(btrim(a.name)),pg_catalog.length(btrim(c.proposed_author_name))+1)
            =' '||lower(btrim(c.proposed_author_name))
       OR pg_catalog.right(lower(btrim(coalesce(a.name_en,''))),pg_catalog.length(btrim(c.proposed_author_name))+1)
            =' '||lower(btrim(c.proposed_author_name)))
      AND (SELECT count(*) FROM public.authors a2
       WHERE lower(btrim(a2.name))=lower(btrim(c.proposed_author_name))
        OR lower(btrim(coalesce(a2.name_en,'')))=lower(btrim(c.proposed_author_name))
        OR (pg_catalog.array_length(pg_catalog.regexp_split_to_array(btrim(c.proposed_author_name),'[[:space:]]+'),1)>=2
         AND (pg_catalog.right(lower(btrim(a2.name)),pg_catalog.length(btrim(c.proposed_author_name))+1)
               =' '||lower(btrim(c.proposed_author_name))
          OR pg_catalog.right(lower(btrim(coalesce(a2.name_en,''))),pg_catalog.length(btrim(c.proposed_author_name))+1)
               =' '||lower(btrim(c.proposed_author_name)))))=1
     )
    )
    AND length(btrim(coalesce(a.portrait_image_alt,'')))>=8
    AND a.portrait_image_path IS NOT NULL
    AND EXISTS(SELECT 1 FROM storage.objects o
     WHERE o.bucket_id='artales-images' AND o.name=a.portrait_image_path))
  ELSE false END;
 IF NOT coalesce(v_valid,false) THEN
  RAISE EXCEPTION 'editorial_evidence_missing_for_%', NEW.kind USING errcode='23514';
 END IF;
 RETURN NEW;
END $function$;
