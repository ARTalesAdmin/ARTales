-- Disposable PostgreSQL 17 owner-boundary fixture. NEVER use in production.
-- This constructs only the objects needed by the exact staged ARTales identity migration.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE artales_ci_nonowner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE, CREATE ON SCHEMA public TO artales_ci_nonowner;
CREATE TYPE public.app_role AS ENUM ('admin','editor','member','reader');
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  raw_user_meta_data jsonb
);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  role public.app_role NOT NULL DEFAULT 'reader',
  is_active boolean NOT NULL DEFAULT true,
  display_name text,
  handle text,
  invite_id uuid,
  invited_by_user_id uuid,
  profile_completed_at timestamptz,
  preferred_locale text,
  reader_theme text,
  reader_width text,
  reader_density text,
  reader_font_scale numeric,
  reader_controls_collapsed boolean
);
CREATE TABLE public.invites (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz,
  invited_role public.app_role NOT NULL,
  invited_by_user_id uuid,
  accepted_by_user_id uuid,
  accepted_at timestamptz,
  updated_at timestamptz
);
CREATE TABLE public.activity_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid,
  target_type text,
  target_id uuid,
  action text,
  metadata jsonb
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
CREATE FUNCTION public.artales_find_pending_invite_for_email(looking_for text)
RETURNS public.invites LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $func$
  SELECT * FROM public.invites
  WHERE lower(email)=lower(looking_for) AND status='pending'
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY id LIMIT 1
$func$;
-- Existing vulnerable function only for migration preflight validation.
CREATE FUNCTION public.artales_sync_profile_from_auth_user_v081()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $func$
DECLARE meta jsonb;
BEGIN
  meta := coalesce(new.raw_user_meta_data,'{}'::jsonb);
  PERFORM meta ->> 'role';
  RETURN new;
END
$func$;
CREATE TRIGGER zz_artales_profile_sync_v081
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.artales_sync_profile_from_auth_user_v081();
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated
USING (id=auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (id=auth.uid()) WITH CHECK (id=auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id=auth.uid());
CREATE POLICY "Invite managers and invitees can update invites" ON public.invites
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.invites TO authenticated;
