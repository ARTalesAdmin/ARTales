#!/usr/bin/env bash
set -euo pipefail
[[ "${PGHOST:-}" == 127.0.0.1 && "${PGDATABASE:-}" == postgres ]] ||
 { echo "Refusing non-local fixture target" >&2; exit 2; }
root(){ PGPASSWORD=ci-root-only psql -X -qAt -v ON_ERROR_STOP=1 -U postgres "$@"; }
actor(){
 local login="$1" uid="$2" sql="$3";
 PGPASSWORD=ci-actor-only psql -X -qAt -v ON_ERROR_STOP=1 -U "$login" -c "SET request.jwt.claim.sub='$uid'; $sql"
}
deny(){
 local name="$1" login="$2" uid="$3" sql="$4";
 if actor "$login" "$uid" "$sql" >/tmp/artales-identity-deny.log 2>&1; then
   echo "FAIL: should reject $name" >&2; exit 1;
 fi
 echo "PASS denied: $name"
}
eq(){
 [[ "$1" == "$2" ]] || { echo "FAIL: $3 expected '$2' got '$1'" >&2; exit 1; }
 echo "PASS: $3"
}
R=33333333-3333-4333-8333-333333333333
E=22222222-2222-4222-8222-222222222222
A=11111111-1111-4111-8111-111111111111
root -f tests/db/artalesIdentityFixture.sql >/dev/null
# Prove fixture models the CURRENT dangerous old DML grant before patch.
eq "$(root -c "select has_column_privilege('authenticated','public.profiles','role','UPDATE')::text")" true "fixture starts with broad role UPDATE"
root -f supabase/migrations/20261028091029_artales_identity_role_authority_v1.sql >/dev/null
eq "$(root -c "select has_column_privilege('authenticated','public.profiles','role','UPDATE')::text")" false "role UPDATE removed"
eq "$(root -c "select has_column_privilege('authenticated','public.profiles','role','INSERT')::text")" false "role INSERT removed"
eq "$(root -c "select has_column_privilege('authenticated','public.profiles','is_active','UPDATE')::text")" false "active-state UPDATE removed"
eq "$(root -c "select has_column_privilege('authenticated','public.invites','invited_role','UPDATE')::text")" false "invite role UPDATE removed"
eq "$(root -c "select has_column_privilege('authenticated','public.invites','status','UPDATE')::text")" true "manager revoke column allowed"
eq "$(root -c "select has_table_privilege('service_role','public.profiles','UPDATE')::text")" true "service account retains full profile DML"
eq "$(root -c "select count(*) from pg_policies where schemaname='public' and tablename='profiles' and policyname='Users can insert own profile'")" 0 "dangerous self-insert policy removed"
deny "reader edits own role" identity_ci_reader "$R" "update public.profiles set role='admin' where id='$R'"
deny "reader deactivation override" identity_ci_reader "$R" "update public.profiles set is_active=true where id='$R'"
deny "self-insert admin profile" identity_ci_reader "$R" "insert into public.profiles(id,email,role) values ('44444444-4444-4444-8444-444444444444','fake@invalid.test','admin')"
deny "reader deletes own profile" identity_ci_reader "$R" "delete from public.profiles where id='$R'"
eq "$(actor identity_ci_reader "$R" "update public.profiles set display_name='Updated reader' where id='$R' returning display_name")" "Updated reader" "safe profile edit still works"
eq "$(actor identity_ci_reader "$R" "update public.profiles set display_name='Forged' where id='$E' returning display_name")" "" "cannot edit other user"
deny "reader rewrites invite target role" identity_ci_reader "$R" "update public.invites set invited_role='editor' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'"
eq "$(actor identity_ci_reader "$R" "update public.invites set status='pending' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning id")" "" "reader cannot resurrect accepted invitation"
eq "$(actor identity_ci_editor "$E" "update public.invites set status='revoked' where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' returning status")" "revoked" "editor revocation still works"
deny "editor reopens revoked invite" identity_ci_editor "$E" "update public.invites set status='pending' where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'"
# Auth signup trigger executes as trusted trigger owner, NOT an authenticated client.
root -c "insert into auth.users(id,email,raw_user_meta_data) values('55555555-5555-4555-8555-555555555555','forged@invalid.test','{\"role\":\"admin\"}'::jsonb)" >/dev/null
eq "$(root -c "select role::text from public.profiles where id='55555555-5555-4555-8555-555555555555'")" reader "uninvited metadata cannot assign admin"
root -c "insert into auth.users(id,email,raw_user_meta_data) values('66666666-6666-4666-8666-666666666666','invited@invalid.test','{\"role\":\"admin\",\"invite_id\":\"cccccccc-cccc-4ccc-8ccc-cccccccccccc\"}'::jsonb)" >/dev/null
eq "$(root -c "select role::text from public.profiles where id='66666666-6666-4666-8666-666666666666'")" editor "server-side verified invitation assigns role"
eq "$(root -c "select status from public.invites where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'")" accepted "invite acceptance preserved"
eq "$(root -c "select position('meta ->> ''role''' in pg_get_functiondef('public.artales_sync_profile_from_auth_user_v081()'::regprocedure))::text")" 0 "active signup trigger ignores mutable role"
eq "$(root -c "select count(*) from pg_trigger where tgrelid='auth.users'::regclass and tgname='zz_artales_profile_sync_v081' and tgenabled='O'")" 1 "auth trigger remains active"
echo "PASS: isolated ARTales role authority, onboarding and invites"
