-- ARTales: release one immutable QA revision and the candidate's independent metadata tasks.
-- Publication is always an explicit authenticated admin action, never a task-completion side effect.
-- Replaces the existing signature, retains its SECURITY DEFINER owner and established ACL.
-- No existing publication or work records are rewritten.
CREATE OR REPLACE FUNCTION public.artales_publish_semantic_candidate(
 p_candidate_id uuid,p_revision_sha256 text,p_work_slug text,p_summary text,p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $artales_release$
DECLARE
 v_actor uuid:=auth.uid();
 v_candidate public.work_candidates%ROWTYPE;
 v_snapshot public.candidate_snapshots%ROWTYPE;
 v_rev public.candidate_semantic_revisions%ROWTYPE;
 v_meta public.artales_candidate_editorial_metadata%ROWTYPE;
 v_author public.authors%ROWTYPE;
 v_collection public.collections%ROWTYPE;
 v_work_id uuid;
 v_language text;
 v_task_kind text;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.id=v_actor
    AND p.is_active AND p.role::text='admin'
 ) THEN RAISE EXCEPTION 'release_admin_required' USING errcode='42501'; END IF;
 IF p_candidate_id IS NULL OR p_revision_sha256 !~ '^[a-f0-9]{64}$'
   OR p_work_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(p_work_slug)>100
   OR length(btrim(COALESCE(p_summary,''))) NOT BETWEEN 200 AND 800
   OR length(btrim(COALESCE(p_reason,''))) NOT BETWEEN 30 AND 4000
 THEN RAISE EXCEPTION 'release_metadata_invalid' USING errcode='22023'; END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_candidate_id::text)::bigint);
 SELECT * INTO v_candidate FROM public.work_candidates WHERE id=p_candidate_id FOR UPDATE;
 SELECT * INTO v_snapshot FROM public.candidate_snapshots WHERE candidate_id=p_candidate_id FOR UPDATE;
 SELECT * INTO v_rev FROM public.candidate_semantic_revisions
  WHERE candidate_id=p_candidate_id ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 SELECT * INTO v_meta FROM public.artales_candidate_editorial_metadata
  WHERE candidate_id=p_candidate_id FOR UPDATE;

 IF v_candidate.id IS NULL OR v_snapshot.candidate_id IS NULL
   OR v_rev.id IS NULL OR v_meta.candidate_id IS NULL OR
   v_rev.revision_sha256<>p_revision_sha256 OR v_rev.status<>'draft'
   OR v_rev.snapshot_sha256<>v_snapshot.sha256 OR v_rev.image_selection<>'none'
   OR v_rev.revision->>'revision_sha256'<>p_revision_sha256
   OR v_rev.revision->>'release_allowed'<>'false'
 THEN RAISE EXCEPTION 'release_source_or_revision_invalid' USING errcode='23514'; END IF;

 -- A verified snapshot is not by itself publication approval. Independent
 -- source clearance must be explicitly recorded by the established workflow.
 IF v_snapshot.publication_authorized IS DISTINCT FROM true
   OR v_snapshot.semantic_ready IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'release_snapshot_authority_missing' USING errcode='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.artales_semantic_publications pub
   WHERE pub.candidate_id=p_candidate_id)
   OR EXISTS(SELECT 1 FROM public.works w WHERE w.slug=p_work_slug)
 THEN RAISE EXCEPTION 'release_duplicate_or_slug_taken' USING errcode='23505'; END IF;

 IF NOT EXISTS(SELECT 1 FROM public.candidate_legal_locks l
   JOIN public.candidate_legal_decisions d ON d.candidate_id=l.candidate_id
    AND d.source_id=l.source_id AND d.decision_no=l.decision_no
   WHERE l.candidate_id=p_candidate_id AND d.verdict='approved'
    AND d.territory='CZ/EU')
 THEN RAISE EXCEPTION 'release_legal_not_approved' USING errcode='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.candidate_snapshot_reviews r
   WHERE r.candidate_id=p_candidate_id AND r.snapshot_sha256=v_snapshot.sha256
    AND r.text_correspondence='confirmed' AND r.image_disposition='exclude_all'
    AND r.id=(SELECT z.id FROM public.candidate_snapshot_reviews z
      WHERE z.candidate_id=p_candidate_id ORDER BY z.reviewed_at DESC,z.id DESC LIMIT 1))
 THEN RAISE EXCEPTION 'release_snapshot_review_missing' USING errcode='23514'; END IF;

 -- Only text approval binds to the exact current revision.
 IF NOT EXISTS(SELECT 1 FROM public.artales_editorial_tasks t
   WHERE t.candidate_id=p_candidate_id AND t.kind='text_review'
     AND t.revision_sha256=p_revision_sha256 AND t.status='completed')
 THEN RAISE EXCEPTION 'release_current_text_qa_missing' USING errcode='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.artales_semantic_qa_flags f
   WHERE f.candidate_id=p_candidate_id AND f.status='open')
   OR EXISTS(SELECT 1 FROM public.artales_semantic_ai_qa_jobs j
     WHERE j.candidate_id=p_candidate_id AND j.status IN ('queued','running'))
   OR EXISTS(
     SELECT 1 FROM pg_catalog.jsonb_array_elements(COALESCE(v_rev.revision->'review_issues','[]'::jsonb)) i
     WHERE (i.value->>'round')::integer=(v_rev.revision->>'round')::integer
      AND NOT EXISTS(SELECT 1 FROM public.artales_semantic_change_reviews d
       WHERE d.candidate_id=p_candidate_id AND d.revision_sha256=p_revision_sha256
        AND d.issue_id=i.value->>'id' AND d.decision='accepted'))
 THEN RAISE EXCEPTION 'release_qa_unresolved' USING errcode='23514'; END IF;

 -- Metadata tasks are work-scoped. A later layout-only revision cannot
 -- invalidate the already verified cover, author, annotation or collection.
 FOREACH v_task_kind IN ARRAY ARRAY[
   'cover_art','work_description','collection_curation','author_bio','author_visual'
 ] LOOP
  IF NOT EXISTS(SELECT 1 FROM public.artales_editorial_tasks t
    WHERE t.candidate_id=p_candidate_id AND t.kind=v_task_kind
      AND t.status='completed')
  THEN RAISE EXCEPTION 'release_metadata_task_incomplete_%',v_task_kind USING errcode='23514'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.artales_editorial_tasks t
   WHERE t.candidate_id=p_candidate_id AND t.status IN ('open','claimed','returned'))
 THEN RAISE EXCEPTION 'release_active_editorial_task' USING errcode='23514'; END IF;

 SELECT * INTO v_author FROM public.authors WHERE id=v_meta.author_id;
 SELECT * INTO v_collection FROM public.collections WHERE id=v_meta.collection_id;
 IF v_author.id IS NULL OR
   (pg_catalog.lower(btrim(v_author.name))<>pg_catalog.lower(btrim(v_candidate.proposed_author_name))
    AND pg_catalog.lower(btrim(COALESCE(v_author.name_en,'')))<>pg_catalog.lower(btrim(v_candidate.proposed_author_name)))
   OR v_collection.id IS NULL
   OR length(btrim(COALESCE(v_author.bio_cs,''))) NOT BETWEEN 200 AND 800
   OR length(btrim(COALESCE(v_author.bio_en,''))) NOT BETWEEN 200 AND 800
   OR length(btrim(COALESCE(v_collection.description_cs,''))) NOT BETWEEN 200 AND 800
   OR length(btrim(COALESCE(v_collection.description_en,''))) NOT BETWEEN 200 AND 800
   OR length(btrim(COALESCE(v_meta.work_description_cs,''))) NOT BETWEEN 200 AND 800
   OR length(btrim(COALESCE(v_meta.work_description_en,''))) NOT BETWEEN 200 AND 800
   OR btrim(p_summary)<>btrim(v_meta.work_description_en)
 THEN RAISE EXCEPTION 'release_candidate_metadata_invalid' USING errcode='23514'; END IF;
 IF v_meta.cover_image_path IS NULL OR length(btrim(COALESCE(v_meta.cover_image_alt,'')))<8
   OR NOT EXISTS(SELECT 1 FROM storage.objects o
     WHERE o.bucket_id='artales-images' AND o.name=v_meta.cover_image_path)
   OR v_author.portrait_image_path IS NULL OR length(btrim(COALESCE(v_author.portrait_image_alt,'')))<8
   OR NOT EXISTS(SELECT 1 FROM storage.objects o
     WHERE o.bucket_id='artales-images' AND o.name=v_author.portrait_image_path)
 THEN RAISE EXCEPTION 'release_visual_assets_missing' USING errcode='23514'; END IF;

 SELECT s.language_code INTO v_language FROM public.candidate_legal_sources s
   WHERE s.id=v_snapshot.source_id AND s.candidate_id=p_candidate_id;
 IF v_language IS NULL OR btrim(v_language)=''
 THEN RAISE EXCEPTION 'release_language_unknown' USING errcode='23514'; END IF;

 INSERT INTO public.works(
   title,title_en,slug,summary,summary_cs,summary_en,content,
   canonical_language,origin_type,source_label,source_reference,status,
   primary_author_id,collection_id,cover_image_path,cover_image_alt,
   cover_image_caption,created_by,updated_by,published_by,published_at,
   edition_title,edition_language,edition_source_url,edition_note_internal,content_blocks)
 VALUES(
   v_candidate.proposed_title,v_candidate.proposed_title,p_work_slug,
   btrim(v_meta.work_description_en),btrim(v_meta.work_description_cs),
   btrim(v_meta.work_description_en),v_rev.source_text,
   v_language,'public_domain','gutenberg',v_snapshot.catalog_url,'published',
   v_author.id,v_collection.id,v_meta.cover_image_path,v_meta.cover_image_alt,
   v_meta.cover_image_caption,v_actor,v_actor,v_actor,now(),
   v_candidate.proposed_title,v_language,v_snapshot.catalog_url,
   'Published from immutable semantic revision '||p_revision_sha256,'[]'::jsonb)
 RETURNING id INTO v_work_id;

 INSERT INTO public.work_collections(work_id,collection_id,is_primary,sort_order,created_by,updated_by)
 VALUES(v_work_id,v_collection.id,true,0,v_actor,v_actor);
 INSERT INTO public.candidate_release_decisions(candidate_id,revision_sha256,outcome,rationale,decided_by)
 VALUES(p_candidate_id,p_revision_sha256,'approved',btrim(p_reason),v_actor);
 INSERT INTO public.artales_semantic_publications(
  candidate_id,work_id,revision_sha256,semantic_revision,image_selection,visual_manifest,published_by)
 VALUES(p_candidate_id,v_work_id,p_revision_sha256,v_rev.revision,
  CASE WHEN EXISTS(SELECT 1 FROM public.artales_semantic_images i
   WHERE i.candidate_id=p_candidate_id AND i.revision_sha256=p_revision_sha256)
   THEN 'cleared' ELSE 'none' END,
  COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'anchor_atom_id',i.anchor_atom_id,'storage_path',i.storage_path,
   'caption',i.caption,'sha256',i.sha256) ORDER BY i.approved_at,i.id)
   FROM public.artales_semantic_images i WHERE i.candidate_id=p_candidate_id
   AND i.revision_sha256=p_revision_sha256),'[]'::jsonb),v_actor);
 RETURN pg_catalog.jsonb_build_object('result','published','work_id',v_work_id,'slug',p_work_slug);
END $artales_release$;
