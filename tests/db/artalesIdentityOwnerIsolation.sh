#!/usr/bin/env bash
# Synthetic PostgreSQL 17 only. NO network or production credentials.
set -euo pipefail
if [[ "$ARTALES_LOCAL_PG17_ONLY" != "1" ||
      "$PGHOST" != "127.0.0.1" ||
      "$PGPORT" != "5432" ||
      "$PGDATABASE" != "artales_identity_fixture" ||
      "$PGUSER" != "postgres" ]]; then
  echo "ARTALES_IDENTITY_FIXTURE_BLOCKED_WRONG_TARGET" >&2
  exit 1
fi
cd "$(dirname "$0")/../.."
psql -X -v ON_ERROR_STOP=1 -f tests/db/artalesIdentityOwnerFixture.sql >/dev/null

# A regular role cannot replace owner-only RLS policies, even with CREATE in public.
if denied=$(psql -X -v ON_ERROR_STOP=1 -c 'SET ROLE artales_ci_nonowner; DROP POLICY "Users can update own profile" ON public.profiles;' 2>&1); then
  echo "ARTALES_IDENTITY_FIXTURE_UNEXPECTED_POLICY_MUTATION" >&2
  exit 1
fi
if [[ "$denied" != *"must be owner"* ]]; then
  echo "ARTALES_IDENTITY_FIXTURE_WRONG_POLICY_DENIAL" >&2
  exit 1
fi
# CREATE on public still cannot replace a postgres-owned trigger function.
if denied=$(psql -X -v ON_ERROR_STOP=1 -c "SET ROLE artales_ci_nonowner; CREATE OR REPLACE FUNCTION public.artales_sync_profile_from_auth_user_v081() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END';" 2>&1); then
  echo "ARTALES_IDENTITY_FIXTURE_UNEXPECTED_FUNCTION_MUTATION" >&2
  exit 1
fi
if [[ "$denied" != *"must be owner"* ]]; then
  echo "ARTALES_IDENTITY_FIXTURE_WRONG_FUNCTION_DENIAL" >&2
  exit 1
fi

# Test the exact immutable migration source as owner, without rewriting SQL.
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261028091029_artales_identity_role_authority_v1.sql >/dev/null

psql -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
DO $check$
BEGIN
  IF has_column_privilege('authenticated','public.profiles','role','UPDATE')
     OR has_column_privilege('authenticated','public.profiles','is_active','UPDATE')
     OR has_table_privilege('authenticated','public.profiles','INSERT')
     OR has_column_privilege('authenticated','public.invites','invited_role','UPDATE')
     OR NOT has_column_privilege('authenticated','public.profiles','display_name','UPDATE')
     OR NOT has_column_privilege('authenticated','public.profiles','handle','UPDATE')
     OR NOT has_column_privilege('authenticated','public.invites','status','UPDATE')
  THEN RAISE EXCEPTION 'artales_identity_acl_postcondition_failed'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles'
     AND policyname='Users can insert own profile')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invites'
        AND policyname='artales_invites_authenticated_revoke_only_v1')
  THEN RAISE EXCEPTION 'artales_identity_policy_postcondition_failed'; END IF;
END
$check$;

-- A user-editable role claim may NOT assign elevated app role without an invitation.
INSERT INTO auth.users(id,email,raw_user_meta_data)
VALUES ('11111111-1111-4111-8111-111111111111','uninvited@example.test',
        '{"role":"admin","display_name":"Fixture User","handle":"fixture_user"}'::jsonb);

-- An authoritative server-side invitation may assign the invited role,
-- but NEVER the role requested by user-editable metadata.
INSERT INTO public.invites(id,email,status,invited_role)
VALUES ('22222222-2222-4222-8222-222222222222','invited@example.test',
        'pending','editor');
INSERT INTO auth.users(id,email,raw_user_meta_data)
VALUES ('33333333-3333-4333-8333-333333333333','invited@example.test',
        '{"role":"admin","invite_id":"22222222-2222-4222-8222-222222222222"}'::jsonb);

DO $verify$
BEGIN
 IF (SELECT role::text FROM public.profiles
     WHERE id='11111111-1111-4111-8111-111111111111') <> 'reader'
 OR (SELECT role::text FROM public.profiles
     WHERE id='33333333-3333-4333-8333-333333333333') <> 'editor'
 OR (SELECT status FROM public.invites
     WHERE id='22222222-2222-4222-8222-222222222222') <> 'accepted'
 OR (SELECT count(*) FROM public.activity_log) <> 2
 THEN RAISE EXCEPTION 'artales_identity_invitation_or_metadata_security_failed'; END IF;
END
$verify$;
SQL
echo "ARTALES_IDENTITY_OWNER_PG17_ISOLATION_PASS_NO_PRODUCTION"
