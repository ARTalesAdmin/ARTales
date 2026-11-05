-- ARTales: candidate-bound editorial metadata and evidence-based task completion.
-- Forward-only draft, no production APPLY without a separate rollout gate.
-- A semantic candidate is not yet a row in public.works. Keep legacy books untouched.
BEGIN;

CREATE TABLE IF NOT EXISTS public.artales_candidate_editorial_metadata(
 candidate_id uuid PRIMARY KEY REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
 author_id uuid REFERENCES public.authors(id) ON DELETE RESTRICT,
 collection_id uuid REFERENCES public.collections(id) ON DELETE RESTRICT,
 work_description text,
 cover_image_path text,
 cover_image_alt text,
 cover_image_caption text,
 updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(work_description IS NULL OR length(btrim(work_description))<=800),
 CHECK(cover_image_alt IS NULL OR length(btrim(cover_image_alt))<=350),
 CHECK(cover_image_caption IS NULL OR length(btrim(cover_image_caption))<=500)
);
ALTER TABLE public.artales_candidate_editorial_metadata ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artales_candidate_editorial_metadata FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.artales_candidate_editorial_metadata TO authenticated;
DROP POLICY IF EXISTS candidate_editorial_metadata_staff_read ON public.artales_candidate_editorial_metadata;
CREATE POLICY candidate_editorial_metadata_staff_read ON public.artales_candidate_editorial_metadata
 FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active
  AND (p.role::text='admin' OR (p.role::text='editor' AND EXISTS(
   SELECT 1 FROM public.artales_editorial_tasks t
   WHERE t.candidate_id=artales_candidate_editorial_metadata.candidate_id
    AND t.assigned_to=p.id AND t.status IN ('open','claimed','returned')
  ))))
);

-- Writes are *field-scoped* and owner-checked. No direct client INSERT or UPDATE.
-- Saving one task must not overwrite another editor's work.
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
  IF p_field='author' AND NOT EXISTS(SELECT 1 FROM public.authors WHERE id=v_new_id)
  THEN RETURN pg_catalog.jsonb_build_object('result','unknown_author');END IF;
  IF p_field='collection' AND NOT EXISTS(SELECT 1 FROM public.collections WHERE id=v_new_id)
  THEN RETURN pg_catalog.jsonb_build_object('result','unknown_collection');END IF;
 ELSIF p_field='description' THEN
  IF p_value IS NULL OR length(btrim(p_value)) NOT BETWEEN 200 AND 800
  THEN RETURN pg_catalog.jsonb_build_object('result','description_required');END IF;
 ELSE
  v_path:=btrim(pg_catalog.coalesce(p_value,''));
  IF v_path !~ ('^works/'||p_candidate_id::text||'/cover/[a-zA-Z0-9_.-]+[.](jpg|png|webp)$')
   OR length(btrim(pg_catalog.coalesce(p_alt,''))) NOT BETWEEN 8 AND 350
   OR length(btrim(pg_catalog.coalesce(p_caption,'')))>500
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
    cover_image_caption=pg_catalog.nullif(btrim(pg_catalog.coalesce(p_caption,'')),''),
    updated_by=v_actor,updated_at=now() WHERE candidate_id=p_candidate_id;
 END IF;
 RETURN pg_catalog.jsonb_build_object('result','saved','field',p_field);
END $save$;
REVOKE ALL ON FUNCTION public.artales_save_candidate_editorial_field(uuid,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_save_candidate_editorial_field(uuid,text,text,text,text)
 TO authenticated;

-- Evidence check is independent of frontend; any attempted status transition must pass.
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
   AND length(btrim(pg_catalog.coalesce(m.cover_image_alt,'')))>=8
   AND EXISTS(SELECT 1 FROM storage.objects o
    WHERE o.bucket_id='artales-images' AND o.name=m.cover_image_path)
  WHEN 'work_description' THEN length(btrim(pg_catalog.coalesce(m.work_description,''))) BETWEEN 200 AND 800
  WHEN 'author_bio' THEN m.author_id IS NOT NULL
   AND EXISTS(SELECT 1 FROM public.authors a WHERE a.id=m.author_id
    AND length(btrim(pg_catalog.coalesce(
     pg_catalog.nullif(a.bio_en,''),pg_catalog.nullif(a.bio_cs,''),a.bio,'')))>=40)
  WHEN 'author_visual' THEN m.author_id IS NOT NULL
   AND EXISTS(SELECT 1 FROM public.authors a WHERE a.id=m.author_id
    AND length(btrim(pg_catalog.coalesce(a.portrait_image_alt,'')))>=8
    AND a.portrait_image_path IS NOT NULL
    AND EXISTS(SELECT 1 FROM storage.objects o
     WHERE o.bucket_id='artales-images' AND o.name=a.portrait_image_path))
  ELSE false END;
 IF NOT pg_catalog.coalesce(v_valid,false) THEN
  RAISE EXCEPTION 'editorial_evidence_missing_for_%', NEW.kind USING errcode='23514';
 END IF;
 RETURN NEW;
END $guard$;
REVOKE ALL ON FUNCTION public.artales_guard_editorial_task_evidence() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS artales_editorial_task_evidence_gate ON public.artales_editorial_tasks;
CREATE TRIGGER artales_editorial_task_evidence_gate
 BEFORE UPDATE OF status ON public.artales_editorial_tasks FOR EACH ROW
 EXECUTE FUNCTION public.artales_guard_editorial_task_evidence();
COMMIT;
