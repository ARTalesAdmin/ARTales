-- ARTales candidate metadata closeout: bilingual evidence is authoritative.
-- DRAFT for separately authorized production apply. Existing evidence/RLS
-- policies and all prior completed tasks remain unchanged.
-- Rollback: restore the previously captured pg_get_functiondef, not task rows.
BEGIN;
CREATE OR REPLACE FUNCTION public.artales_guard_editorial_task_evidence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $guard$
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
    AND (lower(btrim(a.name))=lower(btrim(c.proposed_author_name))
      OR lower(btrim(coalesce(a.name_en,'')))=lower(btrim(c.proposed_author_name)))
    AND char_length(btrim(coalesce(a.bio_en,''))) BETWEEN 200 AND 800
    AND char_length(btrim(coalesce(a.bio_cs,''))) BETWEEN 200 AND 800)
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
REVOKE ALL ON FUNCTION public.artales_guard_editorial_task_evidence() FROM PUBLIC,anon,authenticated;
-- Existing BEFORE UPDATE OF status trigger invokes this function without recreation.
COMMIT;
