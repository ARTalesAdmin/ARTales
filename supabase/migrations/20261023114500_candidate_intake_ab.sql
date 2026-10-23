-- Candidate intake A+B; source-only until separately authorized production apply.
-- Depends ONLY on the live shadow-library migration 20261023063248.
-- Open Library is a bibliographic hint, NEVER a cleared source or edition.
BEGIN;

CREATE FUNCTION public.artales_candidate_identity_part(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = ''
AS $fn$
  SELECT btrim(regexp_replace(
    translate(lower(coalesce(p_value, '')), 'áàâäãåāčćçďđéěèêëēíìîïīľĺłňńñóòôöõøōřŕšśťţúùůûüūýÿžźż', 'aaaaaaacccddeeeeeeiiiiilllnnnooooooorrssttuuuuuuyyzzz'),
    '[^a-z0-9]+', ' ', 'g'
  ));
$fn$;

CREATE FUNCTION public.artales_candidate_identity(p_title text, p_author text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = ''
AS $fn$
  SELECT public.artales_candidate_identity_part(p_title) || '|' ||
         public.artales_candidate_identity_part(p_author);
$fn$;

CREATE TABLE public.work_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_title text NOT NULL CHECK (length(btrim(proposed_title)) BETWEEN 1 AND 300),
  proposed_author_name text NOT NULL CHECK (length(btrim(proposed_author_name)) BETWEEN 1 AND 200),
  identity_key text GENERATED ALWAYS AS
    (public.artales_candidate_identity(proposed_title, proposed_author_name)) STORED
    NOT NULL UNIQUE,
  origin text NOT NULL CHECK (origin IN
    ('manual','prescreen','internal_list','reader_request','nexus','other')),
  origin_reference text CHECK (origin_reference IS NULL OR length(origin_reference) <= 500),
  prescreen_title_id uuid UNIQUE REFERENCES public.prescreen_shadow_titles(id) ON DELETE RESTRICT,
  prescreen_work_key text UNIQUE,
  prescreen_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(prescreen_metadata)='object'),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','checking','ready','deferred','rejected')),
  priority smallint NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 5000),
  discovery_status text NOT NULL DEFAULT 'pending'
    CHECK (discovery_status IN ('pending','needs_review','complete')),
  rights_status text NOT NULL DEFAULT 'unknown'
    CHECK (rights_status IN ('unknown','review_required','clear','blocked')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  updated_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_prescreen_provenance CHECK (
    (origin='prescreen' AND prescreen_title_id IS NOT NULL AND prescreen_work_key IS NOT NULL)
    OR (origin<>'prescreen' AND prescreen_title_id IS NULL AND prescreen_work_key IS NULL)
  ),
  CONSTRAINT candidate_identity_nonempty CHECK (
    length(public.artales_candidate_identity_part(proposed_title))>0
    AND length(public.artales_candidate_identity_part(proposed_author_name))>0
  )
);
CREATE INDEX work_candidates_triage_idx
  ON public.work_candidates(status,priority DESC,created_at ASC);

ALTER TABLE public.work_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.work_candidates FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.work_candidates TO authenticated;
-- Editors can work in Candidates; only admins may transfer from admin Prescreen.
CREATE POLICY work_candidates_editor_select ON public.work_candidates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
    AND p.is_active AND p.role IN ('admin','editor')));
CREATE POLICY work_candidates_editor_insert ON public.work_candidates FOR INSERT TO authenticated
  WITH CHECK (
    created_by=(SELECT auth.uid()) AND updated_by=(SELECT auth.uid())
    AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.is_active AND p.role IN ('admin','editor'))
  );
CREATE POLICY work_candidates_editor_update ON public.work_candidates FOR UPDATE TO authenticated
  USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.is_active AND p.role IN ('admin','editor')))
  WITH CHECK (
    updated_by=(SELECT auth.uid())
    AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.is_active AND p.role IN ('admin','editor'))
  );

-- Linked transfer state cannot be silently reverted by the legacy upsert route.
ALTER TABLE public.prescreen_shadow_handoffs
  ADD CONSTRAINT prescreen_handoff_transfer_complete CHECK (
    (state='transferred') =
    (transferred_candidate_id IS NOT NULL AND transferred_at IS NOT NULL)
  );
ALTER TABLE public.prescreen_shadow_handoffs
  ADD CONSTRAINT prescreen_handoff_candidate_fk FOREIGN KEY (transferred_candidate_id)
  REFERENCES public.work_candidates(id) ON DELETE RESTRICT;
CREATE FUNCTION public.artales_guard_prescreen_transfer()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
BEGIN
  IF OLD.state='transferred' AND
    (NEW.state IS DISTINCT FROM OLD.state OR
     NEW.title_id IS DISTINCT FROM OLD.title_id OR
     NEW.transferred_candidate_id IS DISTINCT FROM OLD.transferred_candidate_id OR
     NEW.transferred_at IS DISTINCT FROM OLD.transferred_at) THEN
    RAISE EXCEPTION 'prescreen_handoff_already_transferred' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER artales_guard_prescreen_transfer BEFORE UPDATE ON public.prescreen_shadow_handoffs
FOR EACH ROW EXECUTE FUNCTION public.artales_guard_prescreen_transfer();

-- A PostgREST RPC is one PostgreSQL transaction. Invoker keeps RLS active.
CREATE FUNCTION public.artales_create_manual_candidate(
  p_title text,p_author text,p_priority integer DEFAULT 50,
  p_notes text DEFAULT '',p_origin_reference text DEFAULT NULL
) RETURNS TABLE(candidate_id uuid,outcome text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE v_identity text;v_id uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.is_active AND p.role IN ('admin','editor')) THEN
    RAISE EXCEPTION 'candidate_forbidden' USING ERRCODE='42501';
  END IF;
  IF length(btrim(coalesce(p_title,''))) NOT BETWEEN 1 AND 300
    OR length(btrim(coalesce(p_author,''))) NOT BETWEEN 1 AND 200
    OR p_priority NOT BETWEEN 0 AND 100
    OR length(coalesce(p_notes,''))>5000
    OR length(coalesce(p_origin_reference,''))>500 THEN
    RAISE EXCEPTION 'candidate_invalid_input' USING ERRCODE='22023';
  END IF;
  v_identity:=public.artales_candidate_identity(p_title,p_author);
  IF split_part(v_identity,'|',1)='' OR split_part(v_identity,'|',2)='' THEN
    RAISE EXCEPTION 'candidate_invalid_identity' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.works w JOIN public.authors a ON a.id=w.primary_author_id
    WHERE public.artales_candidate_identity(w.title,a.name)=v_identity) THEN
    RETURN QUERY SELECT NULL::uuid,'existing_work'::text;RETURN;
  END IF;
  INSERT INTO public.work_candidates
    (proposed_title,proposed_author_name,origin,origin_reference,status,priority,notes,created_by,updated_by)
  VALUES(btrim(p_title),btrim(p_author),'manual',nullif(btrim(p_origin_reference),''),
    'new',p_priority,coalesce(p_notes,''),(SELECT auth.uid()),(SELECT auth.uid()))
  ON CONFLICT DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT c.id INTO v_id FROM public.work_candidates c WHERE c.identity_key=v_identity;
    RETURN QUERY SELECT v_id,'existing_candidate'::text;RETURN;
  END IF;
  RETURN QUERY SELECT v_id,'created'::text;
END
$fn$;

CREATE FUNCTION public.artales_transfer_prescreen_handoff(p_title_id uuid)
RETURNS TABLE(candidate_id uuid,outcome text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE v_handoff record;v_title record;v_id uuid;v_identity text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
    AND p.is_active AND p.role='admin') THEN
    RAISE EXCEPTION 'prescreen_transfer_forbidden' USING ERRCODE='42501';
  END IF;
  SELECT h.id,h.state,h.transferred_candidate_id
    INTO v_handoff FROM public.prescreen_shadow_handoffs h
    WHERE h.title_id=p_title_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid,'not_selected'::text;RETURN;
  END IF;
  IF v_handoff.state='transferred' THEN
    RETURN QUERY SELECT v_handoff.transferred_candidate_id::uuid,'already_transferred'::text;RETURN;
  END IF;
  IF v_handoff.state<>'queued' THEN
    RETURN QUERY SELECT NULL::uuid,'not_queued'::text;RETURN;
  END IF;
  SELECT t.* INTO v_title FROM public.prescreen_shadow_titles t WHERE t.id=p_title_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'prescreen_title_missing' USING ERRCODE='23503';
  END IF;
  v_identity:=public.artales_candidate_identity(v_title.title,v_title.author);
  IF EXISTS(SELECT 1 FROM public.works w JOIN public.authors a ON a.id=w.primary_author_id
    WHERE public.artales_candidate_identity(w.title,a.name)=v_identity) THEN
    RETURN QUERY SELECT NULL::uuid,'existing_work'::text;RETURN;
  END IF;
  INSERT INTO public.work_candidates
    (proposed_title,proposed_author_name,origin,origin_reference,prescreen_title_id,
     prescreen_work_key,prescreen_metadata,status,priority,notes,
     discovery_status,rights_status,created_by,updated_by)
  VALUES
    (v_title.title,v_title.author,'prescreen',v_title.source_work_key,p_title_id,
     v_title.source_work_key,
     jsonb_build_object('provider',v_title.provider,'sourceUrl',v_title.source_url,
       'firstPublished',v_title.first_published,'authorBorn',v_title.author_born,
       'authorDied',v_title.author_died,'authorCount',v_title.author_count,
       'prescreenState',v_title.state,'prescreenReason',v_title.reason,
       'originalIdentityKey',v_title.identity_key,'form',v_title.form,
       'themes',v_title.themes),
     'new',50,'','pending','unknown',(SELECT auth.uid()),(SELECT auth.uid()))
  ON CONFLICT DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT c.id INTO v_id FROM public.work_candidates c
       WHERE c.identity_key=v_identity OR c.prescreen_work_key=v_title.source_work_key
       ORDER BY c.created_at ASC LIMIT 1;
    RETURN QUERY SELECT v_id,'existing_candidate'::text;RETURN;
  END IF;
  UPDATE public.prescreen_shadow_handoffs h SET
      state='transferred',transferred_candidate_id=v_id,transferred_at=now()
    WHERE h.id=v_handoff.id;
  RETURN QUERY SELECT v_id,'transferred'::text;
END
$fn$;

REVOKE ALL ON FUNCTION public.artales_candidate_identity_part(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.artales_candidate_identity(text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.artales_create_manual_candidate(text,text,integer,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.artales_transfer_prescreen_handoff(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.artales_candidate_identity_part(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.artales_candidate_identity(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.artales_create_manual_candidate(text,text,integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.artales_transfer_prescreen_handoff(uuid) TO authenticated;

COMMIT;
