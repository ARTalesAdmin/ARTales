-- ARTales A2.1: invitation access boundary.
-- Existing server token lookup must be live before applying.
-- Restrict this object only; preserve service-owned acceptance and identity trigger.
DO $preflight$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.invites'::regclass
                AND relrowsecurity AND NOT relforcerowsecurity
                AND pg_get_userbyid(relowner)='postgres')
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='invites')<>4
 OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invites'
                AND policyname='Pending invites can be read by token' AND cmd='SELECT')
 OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invites'
                AND policyname='Invite managers can read invites' AND cmd='SELECT'
                AND roles=ARRAY['authenticated'::name])
 OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invites'
                AND policyname='Invite managers can create invites' AND cmd='INSERT')
 OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invites'
                AND policyname='artales_invites_authenticated_revoke_only_v1' AND cmd='UPDATE')
 OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.artales_find_pending_invite_for_email(text)'::regprocedure
                AND prosecdef AND pg_get_userbyid(proowner)='postgres')
 OR NOT has_table_privilege('service_role','public.invites','SELECT')
 OR NOT has_table_privilege('service_role','public.invites','INSERT')
 OR NOT has_table_privilege('service_role','public.invites','UPDATE')
 OR NOT has_function_privilege('service_role','public.artales_find_pending_invite_for_email(text)','EXECUTE')
 THEN RAISE EXCEPTION 'artales_invite_boundary_preflight_drift';
 END IF;
END
$preflight$;

DROP POLICY "Pending invites can be read by token" ON public.invites;
DROP POLICY "Invite managers can create invites" ON public.invites;
CREATE POLICY "Invite managers can create invites" ON public.invites
 FOR INSERT TO authenticated
 WITH CHECK (
   status='pending' AND accepted_by_user_id IS NULL AND accepted_at IS NULL
   AND invited_by_user_id=(SELECT auth.uid())
   AND EXISTS (
     SELECT 1 FROM public.profiles p
     WHERE p.id=(SELECT auth.uid()) AND p.is_active IS TRUE
       AND (p.role::text='admin'
            OR (p.role::text='editor' AND invites.invited_role IN ('member','reader')))
   )
 );

-- Preserve only the precise manager listing, creation and revocation projection.
-- No client SELECT of bearer hashes, no fabricated acceptance fields, no broad table DML.
REVOKE ALL PRIVILEGES ON TABLE public.invites FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (status) ON TABLE public.invites FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,email,invited_role,status,invited_by_user_id,accepted_by_user_id,
 expires_at,accepted_at,created_at,note) ON TABLE public.invites TO authenticated;
GRANT INSERT (email,invited_role,token_hash,invited_by_user_id,status,expires_at,note)
 ON TABLE public.invites TO authenticated;
GRANT UPDATE (status) ON TABLE public.invites TO authenticated;

-- The existing SECURITY DEFINER caller/trigger executes as postgres.
-- Keep existing service access; do not expose the email helper to browsers.
REVOKE EXECUTE ON FUNCTION public.artales_find_pending_invite_for_email(text)
 FROM PUBLIC, anon, authenticated;

DO $verify$
DECLARE
 c record;
 r text;
 priv text;
 expected boolean;
BEGIN
 FOR r IN SELECT unnest(ARRAY['anon','authenticated']) LOOP
   FOREACH priv IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
     IF has_table_privilege(r,'public.invites',priv) THEN
       RAISE EXCEPTION 'artales_invite_boundary_broad_table_grant';
     END IF;
   END LOOP;
   FOR c IN SELECT attname::text AS name FROM pg_attribute
            WHERE attrelid='public.invites'::regclass AND attnum>0 AND NOT attisdropped LOOP
     FOREACH priv IN ARRAY ARRAY['SELECT','INSERT','UPDATE','REFERENCES'] LOOP
       expected := r='authenticated' AND (
         (priv='SELECT' AND c.name=ANY(ARRAY['id','email','invited_role','status','invited_by_user_id','accepted_by_user_id','expires_at','accepted_at','created_at','note']))
         OR (priv='INSERT' AND c.name=ANY(ARRAY['email','invited_role','token_hash','invited_by_user_id','status','expires_at','note']))
         OR (priv='UPDATE' AND c.name='status')
       );
       IF has_column_privilege(r,'public.invites',c.name,priv) IS DISTINCT FROM expected THEN
         RAISE EXCEPTION 'artales_invite_boundary_column_grant_drift';
       END IF;
     END LOOP;
   END LOOP;
   IF has_function_privilege(r,'public.artales_find_pending_invite_for_email(text)','EXECUTE') THEN
     RAISE EXCEPTION 'artales_invite_boundary_browser_helper';
   END IF;
 END LOOP;
 IF EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
      aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE p.oid='public.artales_find_pending_invite_for_email(text)'::regprocedure
        AND a.grantee=0 AND a.privilege_type='EXECUTE')
 OR NOT has_function_privilege('service_role','public.artales_find_pending_invite_for_email(text)','EXECUTE')
 OR NOT has_table_privilege('service_role','public.invites','SELECT')
 OR NOT has_table_privilege('service_role','public.invites','INSERT')
 OR NOT has_table_privilege('service_role','public.invites','UPDATE')
 OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invites'
            AND (policyname='Pending invites can be read by token' OR roles && ARRAY['anon','public']::name[]))
 THEN RAISE EXCEPTION 'artales_invite_boundary_postcondition';
 END IF;
END
$verify$;
