-- Retain current identity and task-claim checks. Permit unique full-name
-- author records for shorter bylines (e.g. Sheridan Le Fanu vs Joseph Sheridan Le Fanu).
-- Multiple matches remain forbidden. No data migration or duplicate authors.
CREATE OR REPLACE FUNCTION public.artales_save_candidate_editorial_field(p_candidate_id uuid, p_field text, p_value text, p_alt text DEFAULT NULL::text, p_caption text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid:=auth.uid();v_role text;v_kind text;v_new_id uuid;v_path text;
BEGIN
 SELECT p.role::text INTO v_role FROM public.profiles p
 WHERE p.id=v_actor AND p.is_active AND p.role::text IN ('admin','editor');
 IF NOT FOUND THEN RAISE EXCEPTION 'editorial_access_denied' USING errcode='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.work_candidates c WHERE c.id=p_candidate_id)
 THEN RETURN pg_catalog.jsonb_build_object('result','unknown_candidate');END IF;
 v_kind:=CASE p_field WHEN 'author' THEN 'author_bio' WHEN 'collection'
   THEN 'collection_curation' WHEN 'description' THEN 'work_description'
   WHEN 'cover' THEN 'cover_art' ELSE NULL END;
 IF p_field='description' THEN RETURN pg_catalog.jsonb_build_object('result','bilingual_required');END IF;
 IF v_kind IS NULL THEN RETURN pg_catalog.jsonb_build_object('result','invalid_field');END IF;
 IF v_role<>'admin' AND NOT EXISTS(SELECT 1 FROM public.artales_editorial_tasks t
  WHERE t.candidate_id=p_candidate_id AND t.assigned_to=v_actor AND t.status='claimed'
   AND (t.kind=v_kind OR (p_field='author' AND t.kind='author_visual')))
 THEN RETURN pg_catalog.jsonb_build_object('result','not_claimed');END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_candidate_id::text)::bigint);
 IF p_field IN ('author','collection') THEN
  IF p_value IS NULL OR p_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN RETURN pg_catalog.jsonb_build_object('result','select_record');END IF;
  v_new_id:=p_value::uuid;
  IF p_field='author' AND NOT EXISTS(
   SELECT 1 FROM public.authors a JOIN public.work_candidates c ON c.id=p_candidate_id
   WHERE a.id=v_new_id AND (
      lower(btrim(a.name))=lower(btrim(c.proposed_author_name)) OR
      lower(btrim(coalesce(a.name_en,'')))=lower(btrim(c.proposed_author_name)) OR
      (pg_catalog.array_length(pg_catalog.regexp_split_to_array(
        btrim(c.proposed_author_name),'[[:space:]]+'),1)>=2 AND
        NOT (
         pg_catalog.array_length(pg_catalog.regexp_split_to_array(
          btrim(c.proposed_author_name),'[[:space:]]+'),1)=2
         AND pg_catalog.split_part(lower(btrim(c.proposed_author_name)),' ',1)
            IN ('le','la','de','da','di','van','von','del','du','des','der')
        ) AND
        (
         pg_catalog.right(lower(btrim(a.name)),pg_catalog.length(btrim(c.proposed_author_name))+1)
            =' '||lower(btrim(c.proposed_author_name)) OR
         pg_catalog.right(lower(btrim(coalesce(a.name_en,''))),pg_catalog.length(btrim(c.proposed_author_name))+1)
            =' '||lower(btrim(c.proposed_author_name))
        ))
     )
     AND (SELECT count(*) FROM public.authors a2
      WHERE lower(btrim(a2.name))=lower(btrim(c.proposed_author_name)) OR
       lower(btrim(coalesce(a2.name_en,'')))=lower(btrim(c.proposed_author_name)) OR
       (pg_catalog.array_length(pg_catalog.regexp_split_to_array(
        btrim(c.proposed_author_name),'[[:space:]]+'),1)>=2 AND
        NOT (
         pg_catalog.array_length(pg_catalog.regexp_split_to_array(
          btrim(c.proposed_author_name),'[[:space:]]+'),1)=2
         AND pg_catalog.split_part(lower(btrim(c.proposed_author_name)),' ',1)
            IN ('le','la','de','da','di','van','von','del','du','des','der')
        ) AND (
        pg_catalog.right(lower(btrim(a2.name)),pg_catalog.length(btrim(c.proposed_author_name))+1)
           =' '||lower(btrim(c.proposed_author_name)) OR
        pg_catalog.right(lower(btrim(coalesce(a2.name_en,''))),pg_catalog.length(btrim(c.proposed_author_name))+1)
           =' '||lower(btrim(c.proposed_author_name))
       )))=1
  )
  THEN RETURN pg_catalog.jsonb_build_object('result','author_name_mismatch');END IF;
  IF p_field='collection' AND NOT EXISTS(SELECT 1 FROM public.collections WHERE id=v_new_id)
  THEN RETURN pg_catalog.jsonb_build_object('result','unknown_collection');END IF;
 ELSIF p_field='description' THEN
  IF p_value IS NULL OR length(btrim(p_value)) NOT BETWEEN 200 AND 800
  THEN RETURN pg_catalog.jsonb_build_object('result','description_required');END IF;
 ELSE
  v_path:=btrim(coalesce(p_value,''));
  IF v_path !~ ('^works/'||p_candidate_id::text||'/cover/[a-zA-Z0-9_.-]+[.](jpg|png|webp)$')
   OR length(btrim(coalesce(p_alt,''))) NOT BETWEEN 8 AND 350
   OR length(btrim(coalesce(p_caption,'')))>500
  THEN RETURN pg_catalog.jsonb_build_object('result','cover_required');END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects s
   WHERE s.bucket_id='artales-images' AND s.name=v_path)
  THEN RETURN pg_catalog.jsonb_build_object('result','cover_asset_missing');END IF;
 END IF;
 INSERT INTO public.artales_candidate_editorial_metadata(candidate_id,updated_by)
 VALUES(p_candidate_id,v_actor) ON CONFLICT(candidate_id) DO NOTHING;
 IF p_field='author' THEN
  UPDATE public.artales_candidate_editorial_metadata
   SET author_id=v_new_id,updated_by=v_actor,updated_at=now()
   WHERE candidate_id=p_candidate_id;
 ELSIF p_field='collection' THEN
  UPDATE public.artales_candidate_editorial_metadata
   SET collection_id=v_new_id,updated_by=v_actor,updated_at=now()
   WHERE candidate_id=p_candidate_id;
 ELSIF p_field='description' THEN
  UPDATE public.artales_candidate_editorial_metadata
   SET work_description=btrim(p_value),updated_by=v_actor,updated_at=now()
   WHERE candidate_id=p_candidate_id;
 ELSE
  UPDATE public.artales_candidate_editorial_metadata
   SET cover_image_path=v_path,cover_image_alt=btrim(p_alt),
    cover_image_caption=nullif(btrim(coalesce(p_caption,'')),''),
    updated_by=v_actor,updated_at=now() WHERE candidate_id=p_candidate_id;
 END IF;
 RETURN pg_catalog.jsonb_build_object('result','saved','field',p_field);
END $function$;
