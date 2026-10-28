-- Disposable PostgreSQL fixture, not production. Models audited ARTales v0.8.6.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE identity_ci_reader LOGIN PASSWORD 'ci-actor-only' NOBYPASSRLS;
CREATE ROLE identity_ci_editor LOGIN PASSWORD 'ci-actor-only' NOBYPASSRLS;
CREATE ROLE identity_ci_admin LOGIN PASSWORD 'ci-actor-only' NOBYPASSRLS;
GRANT authenticated TO identity_ci_reader,identity_ci_editor,identity_ci_admin;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
CREATE TYPE public.app_role AS ENUM('admin','editor','member','reader');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
CREATE TABLE auth.users (id uuid PRIMARY KEY,email text NOT NULL,raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE public.profiles (
 id uuid PRIMARY KEY,email text NOT NULL,role public.app_role NOT NULL DEFAULT 'member',
 is_active boolean NOT NULL DEFAULT true,display_name text NOT NULL DEFAULT 'reader',
 handle text,invite_id uuid,invited_by_user_id uuid,profile_completed_at timestamptz,
 preferred_locale text NOT NULL DEFAULT 'en',reader_theme text NOT NULL DEFAULT 'light',
 reader_width text NOT NULL DEFAULT 'normal',reader_density text NOT NULL DEFAULT 'comfortable',
 reader_font_scale numeric NOT NULL DEFAULT 1,reader_controls_collapsed boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.invites (
 id uuid PRIMARY KEY,email text NOT NULL, invited_role text NOT NULL
 CHECK (invited_role IN ('editor','member','reader')),
 token_hash text NOT NULL, invited_by_user_id uuid, accepted_by_user_id uuid,
 status text NOT NULL CHECK(status IN ('pending','accepted','revoked','expired')),
 expires_at timestamptz,accepted_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.activity_log (
 actor_user_id uuid,target_type text,target_id uuid,action text NOT NULL,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE FUNCTION public.artales_find_pending_invite_for_email(input_email text)
 RETURNS public.invites LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
 AS 'SELECT i FROM public.invites i WHERE lower(i.email)=lower(input_email) AND i.status=''pending'' AND (i.expires_at IS NULL OR i.expires_at>now()) ORDER BY i.created_at DESC LIMIT 1';
-- Mimic the vulnerable legacy trigger only to prove the new migration replaces it.
CREATE FUNCTION public.artales_sync_profile_from_auth_user_v081()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth
 AS $legacy$
 DECLARE raw_role text;
 BEGIN
  raw_role:=coalesce(new.raw_user_meta_data ->> 'role','reader');
  INSERT INTO public.profiles(id,email,role) VALUES(new.id,new.email,raw_role::public.app_role);
  RETURN new;
 END;
 $legacy$;
CREATE TRIGGER zz_artales_profile_sync_v081 AFTER INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.artales_sync_profile_from_auth_user_v081();
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own profile" ON public.profiles
 FOR INSERT TO authenticated WITH CHECK (auth.uid()=id);
CREATE POLICY "Users can read own profile" ON public.profiles
 FOR SELECT TO authenticated USING (auth.uid()=id);
CREATE POLICY "Users can update own profile" ON public.profiles
 FOR UPDATE TO authenticated USING (auth.uid()=id) WITH CHECK (auth.uid()=id);
CREATE POLICY "Invite managers can read invites" ON public.invites
 FOR SELECT TO authenticated USING (EXISTS
  (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid()
   AND p.role IN ('admin','editor') AND p.is_active));
CREATE POLICY "Invite managers and invitees can update invites" ON public.invites
 FOR UPDATE TO authenticated USING
  (accepted_by_user_id=auth.uid() OR invited_by_user_id=auth.uid()
   OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid()
              AND p.is_active AND p.role IN ('admin','editor')))
 WITH CHECK(true);
GRANT ALL ON public.profiles,public.invites TO anon,authenticated,service_role;
GRANT SELECT ON public.activity_log TO authenticated;
INSERT INTO public.profiles(id,email,role,display_name,handle) VALUES
 ('11111111-1111-4111-8111-111111111111','admin@invalid.test','admin','Admin','a-admin'),
 ('22222222-2222-4222-8222-222222222222','editor@invalid.test','editor','Editor','a-editor'),
 ('33333333-3333-4333-8333-333333333333','reader@invalid.test','reader','Reader','a-reader');
INSERT INTO public.invites(id,email,invited_role,token_hash,invited_by_user_id,status,accepted_by_user_id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accepted@invalid.test','reader','synthetic1',
 '11111111-1111-4111-8111-111111111111','accepted',
 '33333333-3333-4333-8333-333333333333'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','pending@invalid.test','reader','synthetic2',
 '22222222-2222-4222-8222-222222222222','pending',NULL),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','invited@invalid.test','editor','synthetic3',
 '11111111-1111-4111-8111-111111111111','pending',NULL);
