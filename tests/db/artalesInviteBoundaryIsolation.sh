#!/usr/bin/env bash
# Run only AFTER the historical identity isolation fixture and migration.
set -euo pipefail
[[ "${PGHOST:-}" == 127.0.0.1 && "${PGDATABASE:-}" == postgres ]] || exit 2
[[ "$#" == 1 && -f "$1" ]] || exit 2
migration="$1"
root(){ PGPASSWORD=ci-root-only psql -X -qAt -v ON_ERROR_STOP=1 -U postgres "$@"; }
actor(){ local login="$1" uid="$2" sql="$3"; PGPASSWORD=ci-actor-only psql -X -qAt -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -U "$login" -c "SET request.jwt.claim.sub='$uid'; $sql"; }
eq(){ [[ "$1" == "$2" ]] || { echo "FAIL: $3 expected '$2' got '$1'" >&2; exit 1; }; echo "PASS: $3"; }
deny(){ local label="$1" login="$2" uid="$3" sql="$4" out; if out=$(actor "$login" "$uid" "$sql" 2>&1); then echo "FAIL: expected rejection $label" >&2; exit 1; fi; [[ "$out" == *42501* ]] || { echo "FAIL: unexpected SQLSTATE $label: $out" >&2; exit 1; }; echo "PASS denied (42501): $label"; }
R=33333333-3333-4333-8333-333333333333
E=22222222-2222-4222-8222-222222222222
A=11111111-1111-4111-8111-111111111111
I=77777777-7777-4777-8777-777777777777
# Bring the minimal historical fixture to the audited live invite contract.
root <<'SQL' >/dev/null
ALTER TABLE public.invites ADD COLUMN note text;
-- Mirror the explicit direct ACLs independently observed in production.
-- A grant inherited solely from PUBLIC must not masquerade as service access.
GRANT EXECUTE ON FUNCTION public.artales_find_pending_invite_for_email(text)
 TO anon,authenticated,service_role;
ALTER TABLE public.invites ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.invites ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.invites ADD CONSTRAINT fixture_token_unique UNIQUE(token_hash);
CREATE POLICY "Pending invites can be read by token" ON public.invites
 FOR SELECT TO anon,authenticated USING(status='pending' AND (expires_at IS NULL OR expires_at>now()));
CREATE POLICY "Invite managers can create invites" ON public.invites
 FOR INSERT TO authenticated WITH CHECK(invited_by_user_id=auth.uid() AND EXISTS(
 SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active
 AND (p.role='admin' OR (p.role='editor' AND invites.invited_role IN ('member','reader')))));
INSERT INTO public.profiles(id,email,role,is_active,handle)
 VALUES('77777777-7777-4777-8777-777777777777','inactive@invalid.test','editor',false,'inactive-editor');
INSERT INTO public.invites(id,email,invited_role,token_hash,invited_by_user_id,status,expires_at,note) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','target@invalid.test','editor',repeat('1',64),'11111111-1111-4111-8111-111111111111','pending',now()+interval '1 day','synthetic'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','revoke@invalid.test','reader',repeat('2',64),'22222222-2222-4222-8222-222222222222','pending',now()+interval '1 day',NULL),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','expired@invalid.test','reader',repeat('3',64),'11111111-1111-4111-8111-111111111111','pending',now()-interval '1 day',NULL);
SQL
T=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1
V=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2
# Prove the synthetic baseline actually models the public-access problem.
eq "$(actor identity_ci_anon "" "select count(*) from public.invites where id='$T'")" 1 "baseline public read"
eq "$(actor identity_ci_reader "$R" "select (public.artales_find_pending_invite_for_email('target@invalid.test')).id")" "$T" "baseline helper access"
root -1 -f "$migration" >/dev/null
deny "anonymous invite listing" identity_ci_anon "" "select id from public.invites"
deny "anonymous helper" identity_ci_anon "" "select public.artales_find_pending_invite_for_email('target@invalid.test')"
deny "reader helper" identity_ci_reader "$R" "select public.artales_find_pending_invite_for_email('target@invalid.test')"
deny "manager helper" identity_ci_admin "$A" "select public.artales_find_pending_invite_for_email('target@invalid.test')"
eq "$(actor identity_ci_reader "$R" "select count(id) from public.invites")" 0 "reader cannot list invites"
eq "$(actor identity_ci_reader "$I" "select count(id) from public.invites")" 0 "inactive manager cannot list"
eq "$(actor identity_ci_editor "$E" "select count(id) from public.invites where id='$T'")" 1 "editor can list"
eq "$(actor identity_ci_admin "$A" "select id,email,invited_role,status,invited_by_user_id,accepted_by_user_id,expires_at,accepted_at,created_at,note from public.invites where id='$T'" | cut -d '|' -f1)" "$T" "manager application projection"
deny "manager cannot read token hash" identity_ci_admin "$A" "select token_hash from public.invites"
deny "manager cannot truncate" identity_ci_admin "$A" "truncate public.invites"
deny "manager cannot update role" identity_ci_admin "$A" "update public.invites set invited_role='member' where id='$T'"
# The real app inserts these seven columns and requests only id.
eq "$(actor identity_ci_editor "$E" "insert into public.invites(email,invited_role,token_hash,invited_by_user_id,status,expires_at,note) values('editor-created@invalid.test','reader',repeat('4',64),'$E','pending',now()+interval '14 days',null) returning id" | grep -Ec '^[0-9a-f-]{36}$')" 1 "editor creates a reader invite"
eq "$(actor identity_ci_admin "$A" "insert into public.invites(email,invited_role,token_hash,invited_by_user_id,status,expires_at,note) values('admin-created@invalid.test','editor',repeat('5',64),'$A','pending',now()+interval '14 days',null) returning id" | grep -Ec '^[0-9a-f-]{36}$')" 1 "admin creates an editor invite"
deny "editor cannot invite editor" identity_ci_editor "$E" "insert into public.invites(email,invited_role,token_hash,invited_by_user_id,status) values('forbidden@invalid.test','editor',repeat('6',64),'$E','pending')"
deny "reader cannot create invite" identity_ci_reader "$R" "insert into public.invites(email,invited_role,token_hash,invited_by_user_id,status) values('forbidden@invalid.test','reader',repeat('6',64),'$R','pending')"
deny "inactive editor cannot create invite" identity_ci_reader "$I" "insert into public.invites(email,invited_role,token_hash,invited_by_user_id,status) values('forbidden@invalid.test','reader',repeat('6',64),'$I','pending')"
deny "manager cannot create accepted status" identity_ci_admin "$A" "insert into public.invites(email,invited_role,token_hash,invited_by_user_id,status) values('forbidden@invalid.test','reader',repeat('6',64),'$A','accepted')"
deny "manager cannot forge acceptance fields" identity_ci_admin "$A" "insert into public.invites(email,invited_role,token_hash,invited_by_user_id,status,accepted_by_user_id) values('forbidden@invalid.test','reader',repeat('6',64),'$A','pending','$R')"
deny "manager cannot impersonate inviter" identity_ci_admin "$A" "insert into public.invites(email,invited_role,token_hash,invited_by_user_id,status) values('forbidden@invalid.test','reader',repeat('6',64),'$E','pending')"
eq "$(actor identity_ci_editor "$E" "update public.invites set status='revoked' where id='$T' and status='pending' returning id")" "" "editor cannot revoke elevated invitation"
eq "$(actor identity_ci_editor "$E" "update public.invites set status='revoked' where id='$V' and status='pending' returning status")" revoked "editor revocation preserved"
eq "$(actor identity_ci_editor "$E" "update public.invites set status='pending' where id='$V' returning id")" "" "cannot reopen revoked invite"
eq "$(root -c "set role service_role; select id from public.invites where token_hash=repeat('1',64) and status='pending' and (expires_at is null or expires_at>now())")" "$T" "server token lookup preserved"
eq "$(root -c "set role service_role; select (public.artales_find_pending_invite_for_email('target@invalid.test')).id")" "$T" "service helper preserved"
# Auth trigger calls the internal helper as its owner, independent of browser EXECUTE.
root -c "insert into auth.users(id,email,raw_user_meta_data) values('88888888-8888-4888-8888-888888888888','target@invalid.test','{\"role\":\"admin\"}'::jsonb)" >/dev/null
eq "$(root -c "select role::text from public.profiles where id='88888888-8888-4888-8888-888888888888'")" editor "trusted signup role preserved"
eq "$(root -c "select status from public.invites where id='$T'")" accepted "trusted invite acceptance preserved"
eq "$(root -c "set role service_role; update public.invites set status='accepted' where email='admin-created@invalid.test' returning status")" accepted "service acceptance preserved"
echo 'ARTALES_A2_INVITE_BOUNDARY_ISOLATED_PASS'
