-- ARTales bilingual candidate annotations: both Czech and English are mandatory.
-- Does not touch published legacy works or public reader. Existing single-language
-- draft text is retained as legacy evidence but cannot complete the annotation task.
BEGIN;

ALTER TABLE public.artales_candidate_editorial_metadata
 ADD COLUMN IF NOT EXISTS work_description_cs text,
 ADD COLUMN IF NOT EXISTS work_description_en text;

DO $constraints$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint
   WHERE conrelid='public.artales_candidate_editorial_metadata'::regclass
    AND conname='artales_candidate_bilingual_description_pair_check') THEN
  ALTER TABLE public.artales_candidate_editorial_metadata
   ADD CONSTRAINT artales_candidate_bilingual_description_pair_check
   CHECK (
    (work_description_cs IS NULL AND work_description_en IS NULL)
    OR (
      work_description_cs IS NOT NULL AND work_description_en IS NOT NULL
      AND char_length(btrim(work_description_cs)) BETWEEN 200 AND 800
      AND char_length(btrim(work_description_en)) BETWEEN 200 AND 800
    )
   );
 END IF;
END $constraints$;

-- Fail closed on the deprecated single-language save route.
CREATE OR REPLACE FUNCTION public.artales_save_candidate_editorial_field(
 p_candidate_id uuid,p_field text,p_value text,
 p_alt text DEFAULT NULL,p_caption text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $save$
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
   WHERE a.id=v_new_id AND
    (lower(btrim(a.name))=lower(btrim(c.proposed_author_name)) OR
     lower(btrim(coalesce(a.name_en,'')))=lower(btrim(c.proposed_author_name))))
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
END $save$;

-- One audited, atomic write for both language versions. Reuses the candidate's
-- staff/ownership policy and row serialization without enabling direct table writes.
CREATE OR REPLACE FUNCTION public.artales_save_candidate_bilingual_description(
 p_candidate_id uuid, p_description_cs text, p_description_en text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $bilingual$
DECLARE v_actor uuid:=auth.uid();
 v_role text;
 v_cs text:=btrim(coalesce(p_description_cs,''));
 v_en text:=btrim(coalesce(p_description_en,''));
BEGIN
 SELECT p.role::text INTO v_role FROM public.profiles p
 WHERE p.id=v_actor AND p.is_active AND p.role::text IN ('admin','editor');
 IF NOT FOUND THEN RAISE EXCEPTION 'editorial_access_denied' USING errcode='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.work_candidates c WHERE c.id=p_candidate_id)
 THEN RETURN pg_catalog.jsonb_build_object('result','unknown_candidate'); END IF;
 IF char_length(v_cs) NOT BETWEEN 200 AND 800 OR
    char_length(v_en) NOT BETWEEN 200 AND 800 THEN
   RETURN pg_catalog.jsonb_build_object('result','bilingual_description_required');
 END IF;
 IF v_role<>'admin' AND NOT EXISTS(
   SELECT 1 FROM public.artales_editorial_tasks t
   WHERE t.candidate_id=p_candidate_id AND t.kind='work_description'
    AND t.assigned_to=v_actor AND t.status='claimed'
 ) THEN RETURN pg_catalog.jsonb_build_object('result','not_claimed'); END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_candidate_id::text)::bigint);
 INSERT INTO public.artales_candidate_editorial_metadata(candidate_id,updated_by)
 VALUES(p_candidate_id,v_actor) ON CONFLICT(candidate_id) DO NOTHING;
 UPDATE public.artales_candidate_editorial_metadata
 SET work_description_cs=v_cs,work_description_en=v_en,
     updated_by=v_actor,updated_at=now()
 WHERE candidate_id=p_candidate_id;
 RETURN pg_catalog.jsonb_build_object('result','saved','field','description');
END $bilingual$;
REVOKE ALL ON FUNCTION public.artales_save_candidate_bilingual_description(uuid,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_save_candidate_bilingual_description(uuid,text,text)
 TO authenticated;

-- No single-language text may count as proof of completed annotation.
CREATE OR REPLACE FUNCTION public.artales_guard_editorial_task_evidence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $guard$
DECLARE m public.artales_candidate_editorial_metadata%ROWTYPE;v_valid boolean;
BEGIN
 IF NEW.status<>'completed' OR OLD.status='completed'
  OR NEW.kind NOT IN ('collection_curation','cover_art','work_description','author_bio','author_visual')
 THEN RETURN NEW;END IF;
 SELECT * INTO m FROM public.artales_candidate_editorial_metadata
 WHERE candidate_id=NEW.candidate_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'editorial_evidence_missing' USING errcode='23514';END IF;
 v_valid:=CASE NEW.kind
  WHEN 'collection_curation' THEN m.collection_id IS NOT NULL
   AND EXISTS(SELECT 1 FROM public.collections c WHERE c.id=m.collection_id)
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
    AND (lower(btrim(a.name))=lower(btrim(c.proposed_author_name))
      OR lower(btrim(coalesce(a.name_en,'')))=lower(btrim(c.proposed_author_name)))
    AND (length(btrim(coalesce(a.bio_en,'')))>=40
     OR length(btrim(coalesce(a.bio_cs,'')))>=40
     OR length(btrim(coalesce(a.bio,'')))>=40))
  WHEN 'author_visual' THEN m.author_id IS NOT NULL
   AND EXISTS(SELECT 1 FROM public.authors a JOIN public.work_candidates c ON c.id=m.candidate_id
    WHERE a.id=m.author_id
    AND (lower(btrim(a.name))=lower(btrim(c.proposed_author_name))
      OR lower(btrim(coalesce(a.name_en,'')))=lower(btrim(c.proposed_author_name)))
    AND length(btrim(coalesce(a.portrait_image_alt,'')))>=8
    AND a.portrait_image_path IS NOT NULL
    AND EXISTS(SELECT 1 FROM storage.objects o
     WHERE o.bucket_id='artales-images' AND o.name=a.portrait_image_path))
  ELSE false END;
 IF NOT coalesce(v_valid,false) THEN
  RAISE EXCEPTION 'editorial_evidence_missing_for_%', NEW.kind USING errcode='23514';
 END IF;
 RETURN NEW;
END $guard$;
COMMIT;
