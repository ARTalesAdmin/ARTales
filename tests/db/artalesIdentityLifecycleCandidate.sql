-- A2.2 candidate. Existing verified identity and row-level serialization.
-- No data rewrite. Existing service-role application must be cut over separately.
DO $preflight$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='artales_private'
                  AND pg_get_userbyid(nspowner)='postgres')
 OR to_regprocedure('artales_private.sync_identity_v1(uuid)') IS NOT NULL
 OR NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
      WHERE t.tgrelid='auth.users'::regclass
      AND t.tgname='zz_artales_profile_sync_v081' AND t.tgenabled='O'
      AND p.oid='public.artales_sync_profile_from_auth_user_v081()'::regprocedure
      AND p.prosecdef AND pg_get_userbyid(p.proowner)='postgres')
 OR (SELECT count(*) FROM pg_proc WHERE oid IN (
       'public.artales_ensure_profile_after_login_v082()'::regprocedure,
       'public.artales_complete_onboarding_v082(text,text)'::regprocedure
     ) AND prosecdef AND pg_get_userbyid(proowner)='postgres')<>2
 OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='auth.users'::regclass
       AND attname='email_confirmed_at' AND NOT attisdropped)
 OR has_function_privilege('authenticated','public.artales_find_pending_invite_for_email(text)','EXECUTE')
 THEN RAISE EXCEPTION 'artales_identity_lifecycle_preflight_drift';
 END IF;
END
$preflight$;

-- Invoker-only implementation. Its only callers are owner-executed wrappers.
-- Serialize one auth identity before the profile, then lock eligible invitations.
CREATE FUNCTION artales_private.sync_identity_v1(target_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE
 u auth.users%rowtype;
 p public.profiles%rowtype;
 candidate public.invites%rowtype;
 selected public.invites%rowtype;
 candidate_count integer:=0;
 accepted_id uuid;
 safe_handle text;
 safe_display text;
BEGIN
 IF target_id IS NULL THEN
   RETURN jsonb_build_object('ok',false,'reason','not_authenticated');
 END IF;
 SELECT * INTO u FROM auth.users WHERE id=target_id FOR UPDATE;
 IF NOT FOUND OR nullif(btrim(u.email),'') IS NULL THEN
   RETURN jsonb_build_object('ok',false,'reason','missing_email');
 END IF;
 SELECT * INTO p FROM public.profiles WHERE id=target_id FOR UPDATE;
 IF FOUND AND p.is_active IS NOT TRUE THEN
   RETURN jsonb_build_object('ok',false,'reason','inactive');
 END IF;
 IF p.id IS NULL THEN
   safe_display:=coalesce(nullif(btrim(u.raw_user_meta_data->>'display_name'),''),nullif(split_part(lower(u.email),'@',1),''),'reader');
   safe_handle:=lower(nullif(btrim(u.raw_user_meta_data->>'handle'),''));
   IF safe_handle IS NULL OR safe_handle !~ '^[a-z0-9._-]{3,30}$' OR EXISTS (
       SELECT 1 FROM public.profiles WHERE handle=safe_handle AND id<>target_id
   ) THEN
     safe_handle:='user-'||left(replace(target_id::text,'-',''),8);
   END IF;
   BEGIN
     INSERT INTO public.profiles(id,email,role,is_active,display_name,handle)
     VALUES(target_id,lower(u.email),'reader',true,safe_display,safe_handle)
     ON CONFLICT(id) DO NOTHING;
   EXCEPTION WHEN unique_violation THEN
     -- Do not fail registration because a generated or requested handle was taken.
     INSERT INTO public.profiles(id,email,role,is_active,display_name,handle)
     VALUES(target_id,lower(u.email),'reader',true,safe_display,NULL)
     ON CONFLICT(id) DO NOTHING;
   END;
   SELECT * INTO STRICT p FROM public.profiles WHERE id=target_id FOR UPDATE;
   IF p.is_active IS NOT TRUE THEN
     RETURN jsonb_build_object('ok',false,'reason','inactive');
   END IF;
 END IF;
 -- Never authorize using mutable metadata or an unverified email.
 IF u.email_confirmed_at IS NOT NULL THEN
   FOR candidate IN SELECT i.* FROM public.invites i
     WHERE lower(i.email)=lower(u.email) AND i.status='pending'
       AND (i.expires_at IS NULL OR i.expires_at>clock_timestamp())
     ORDER BY i.created_at DESC,i.id DESC LIMIT 2 FOR UPDATE
   LOOP
     candidate_count:=candidate_count+1;
     selected:=candidate;
   END LOOP;
   -- Ambiguous authority is denied, without preventing an existing account login.
   IF candidate_count=1 THEN
     UPDATE public.invites i SET status='accepted',accepted_by_user_id=target_id,
       accepted_at=clock_timestamp(),updated_at=clock_timestamp()
     WHERE i.id=selected.id AND i.status='pending' AND lower(i.email)=lower(u.email)
       AND (i.expires_at IS NULL OR i.expires_at>clock_timestamp())
       AND i.invited_role IN ('editor','member','reader')
     RETURNING i.id INTO accepted_id;
     IF accepted_id IS NOT NULL THEN
       UPDATE public.profiles SET role=selected.invited_role::public.app_role,
         invite_id=coalesce(p.invite_id,selected.id),
         invited_by_user_id=coalesce(p.invited_by_user_id,selected.invited_by_user_id)
       WHERE id=target_id AND is_active IS TRUE RETURNING * INTO STRICT p;
       INSERT INTO public.activity_log(actor_user_id,target_type,target_id,action,metadata)
       VALUES(target_id,'invite',accepted_id,'invite_accepted',
         jsonb_build_object('role',p.role,'invitedBy',selected.invited_by_user_id,'source','identity_lifecycle_v1'));
     END IF;
   END IF;
   -- Only sync the email from a verified auth identity. Do not overwrite any
   -- role, activity, profile preferences or historical referral on normal login.
   IF p.email IS DISTINCT FROM lower(u.email) THEN
     UPDATE public.profiles SET email=lower(u.email) WHERE id=target_id
       AND is_active IS TRUE RETURNING * INTO STRICT p;
   END IF;
 END IF;
 RETURN jsonb_build_object('ok',true,'role',p.role,'acceptedInviteId',accepted_id,
   'inviteConflict',candidate_count>1);
END
$fn$;
REVOKE ALL ON FUNCTION artales_private.sync_identity_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.artales_sync_profile_from_auth_user_v081()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE result jsonb;
BEGIN
 result:=artales_private.sync_identity_v1(NEW.id);
 IF NOT coalesce((result->>'ok')::boolean,false)
    AND result->>'reason' IS DISTINCT FROM 'inactive' THEN
   RAISE EXCEPTION 'artales_identity_signup_sync_failed';
 END IF;
 RETURN NEW;
END
$fn$;

CREATE OR REPLACE FUNCTION public.artales_ensure_profile_after_login_v082()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
BEGIN
 RETURN artales_private.sync_identity_v1(auth.uid());
END
$fn$;

CREATE OR REPLACE FUNCTION public.artales_complete_onboarding_v082(display_name_input text,handle_input text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE
 actor_id uuid:=auth.uid();
 display_name_normalized text;
 handle_normalized text;
 ensured jsonb;
 profile_role public.app_role;
BEGIN
 IF actor_id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_authenticated'); END IF;
 display_name_normalized:=nullif(regexp_replace(btrim(coalesce(display_name_input,'')),'\s+',' ','g'),'');
 handle_normalized:=lower(nullif(btrim(coalesce(handle_input,'')),''));
 IF display_name_normalized IS NULL OR handle_normalized IS NULL THEN
   RETURN jsonb_build_object('ok',false,'reason','missing');
 END IF;
 IF handle_normalized !~ '^[a-z0-9._-]{3,30}$' THEN
   RETURN jsonb_build_object('ok',false,'reason','handle');
 END IF;
 ensured:=artales_private.sync_identity_v1(actor_id);
 IF NOT coalesce((ensured->>'ok')::boolean,false) THEN RETURN ensured; END IF;
 IF EXISTS (SELECT 1 FROM public.profiles WHERE handle=handle_normalized AND id<>actor_id) THEN
   RETURN jsonb_build_object('ok',false,'reason','handle_taken');
 END IF;
 BEGIN
   UPDATE public.profiles SET display_name=display_name_normalized,handle=handle_normalized,
      profile_completed_at=clock_timestamp()
   WHERE id=actor_id AND is_active IS TRUE RETURNING role INTO profile_role;
 EXCEPTION WHEN unique_violation THEN
   RETURN jsonb_build_object('ok',false,'reason','handle_taken');
 END;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','inactive'); END IF;
 INSERT INTO public.activity_log(actor_user_id,target_type,target_id,action,metadata)
 VALUES(actor_id,'profile',actor_id,'profile_onboarding_completed',
   jsonb_build_object('handle',handle_normalized,'source','identity_lifecycle_v1'));
 RETURN jsonb_build_object('ok',true,'role',profile_role,'acceptedInviteId',ensured->'acceptedInviteId',
   'inviteConflict',ensured->'inviteConflict');
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.artales_sync_profile_from_auth_user_v081() FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.artales_ensure_profile_after_login_v082() FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.artales_complete_onboarding_v082(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.artales_ensure_profile_after_login_v082() TO authenticated;
GRANT EXECUTE ON FUNCTION public.artales_complete_onboarding_v082(text,text) TO authenticated;

DO $verify$
DECLARE
 sig text;
 r text;
BEGIN
 FOREACH sig IN ARRAY ARRAY['artales_private.sync_identity_v1(uuid)','public.artales_sync_profile_from_auth_user_v081()',
 'public.artales_ensure_profile_after_login_v082()','public.artales_complete_onboarding_v082(text,text)'] LOOP
   FOREACH r IN ARRAY ARRAY['anon','service_role','authenticated'] LOOP
     IF has_function_privilege(r,sig,'EXECUTE') IS DISTINCT FROM
       (r='authenticated' AND sig IN ('public.artales_ensure_profile_after_login_v082()','public.artales_complete_onboarding_v082(text,text)'))
     THEN RAISE EXCEPTION 'artales_identity_lifecycle_acl_drift'; END IF;
   END LOOP;
   IF EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
       aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
       WHERE p.oid=to_regprocedure(sig) AND a.grantee=0 AND a.privilege_type='EXECUTE')
   THEN RAISE EXCEPTION 'artales_identity_lifecycle_public_execute'; END IF;
 END LOOP;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass
       AND tgname='zz_artales_profile_sync_v081' AND tgenabled='O')
 THEN RAISE EXCEPTION 'artales_identity_lifecycle_trigger_missing'; END IF;
END
$verify$;
