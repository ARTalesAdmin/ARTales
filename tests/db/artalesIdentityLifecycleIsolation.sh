#!/usr/bin/env bash
set -euo pipefail
[[ "${PGHOST:-}" == 127.0.0.1 && "${PGDATABASE:-}" == postgres ]] || exit 2
[[ "$#" == 1 && -f "$1" ]] || exit 2
root(){ PGPASSWORD=ci-root-only psql -X -qAt -v ON_ERROR_STOP=1 -U postgres "$@"; }
actor(){ local login="$1" uid="$2" query="$3"; PGPASSWORD=ci-actor-only psql -X -qAt -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -U "$login" -c "SET request.jwt.claim.sub='$uid'; $query"; }
reader(){ actor identity_ci_reader "$1" "$2"; }
eq(){ [[ "$1" == "$2" ]] || { echo "FAIL: $3 expected '$2' got '$1'" >&2; exit 1; }; echo "PASS: $3"; }
deny(){ local label="$1" login="$2" uid="$3" query="$4" out; if out=$(actor "$login" "$uid" "$query" 2>&1); then echo "FAIL: expected rejection $label" >&2; exit 1; fi; [[ "$out" == *42501* ]] || { echo "FAIL unexpected SQLSTATE: $out" >&2; exit 1; }; echo "PASS denied: $label"; }
R=33333333-3333-4333-8333-333333333333
A=11111111-1111-4111-8111-111111111111
I=77777777-7777-4777-8777-777777777777
U=90000000-0000-4000-8000-000000000001
D=90000000-0000-4000-8000-000000000002
C=90000000-0000-4000-8000-000000000003
M=90000000-0000-4000-8000-000000000004
X=90000000-0000-4000-8000-000000000005
root -f tests/db/artalesIdentityLifecycleFixture.sql >/dev/null
# Show the old RPC actually revives a disabled profile.
eq "$(reader "$I" "select public.artales_ensure_profile_after_login_v082()->>'ok'")" true "legacy RPC baseline"
eq "$(root -c "select is_active::text from public.profiles where id='$I'")" true "baseline reproduces reactivation"
root -c "update public.profiles set is_active=false where id='$I'" >/dev/null
root -1 -f "$1" >/dev/null
deny "anonymous self RPC" identity_ci_anon "" "select public.artales_ensure_profile_after_login_v082()"
deny "direct arbitrary target" identity_ci_reader "$R" "select artales_private.sync_identity_v1('$A')"
eq "$(reader "$I" "select public.artales_ensure_profile_after_login_v082()->>'reason'")" inactive "inactive login denied"
eq "$(reader "$I" "select public.artales_complete_onboarding_v082('Inactive Name','inactive-new')->>'reason'")" inactive "inactive onboarding denied"
eq "$(root -c "select is_active::text||':'||role::text from public.profiles where id='$I'")" false:editor "inactive state and role preserved"
eq "$(reader "$A" "select public.artales_ensure_profile_after_login_v082()->>'role'")" admin "existing admin preserved"
root <<'SQL' >/dev/null
INSERT INTO public.invites(email,invited_role,token_hash,status) VALUES
 ('new-unconfirmed@invalid.test','editor',repeat('7',64),'pending'),
 ('new-duplicate@invalid.test','member',repeat('8',64),'pending'),
 ('new-concurrent@invalid.test','editor',repeat('9',64),'pending'),
 ('new-ambiguous@invalid.test','editor',repeat('a',64),'pending'),
 ('new-ambiguous@invalid.test','member',repeat('b',64),'pending'),
 ('inactive@invalid.test','reader',repeat('c',64),'pending'),
 ('revoked-race@invalid.test','editor',repeat('d',64),'pending');
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('90000000-0000-4000-8000-000000000001','new-unconfirmed@invalid.test','{"role":"admin"}'),
 ('90000000-0000-4000-8000-000000000002','new-duplicate@invalid.test','{}'),
 ('90000000-0000-4000-8000-000000000003','new-concurrent@invalid.test','{}'),
 ('90000000-0000-4000-8000-000000000004','new-ambiguous@invalid.test','{}'),
 ('90000000-0000-4000-8000-000000000005','revoked-race@invalid.test','{}');
SQL
eq "$(root -c "select role::text from public.profiles where id='$U'")" reader "unverified registration remains reader"
eq "$(reader "$U" "select public.artales_ensure_profile_after_login_v082()->>'role'")" reader "unverified session cannot elevate"
eq "$(root -c "select status from public.invites where email='new-unconfirmed@invalid.test'")" pending "unverified invite remains pending"
eq "$(reader "$I" "select public.artales_ensure_profile_after_login_v082()->>'reason'")" inactive "inactive cannot accept new invite"
eq "$(root -c "select status from public.invites where email='inactive@invalid.test'")" pending "inactive invite not consumed"
root -c "update auth.users set email_confirmed_at=now() where id in ('$U','$D','$C','$M','$X')" >/dev/null
eq "$(reader "$U" "select public.artales_ensure_profile_after_login_v082()->>'role'")" editor "verified identity receives invitation role"
eq "$(root -c "select status from public.invites where email='new-unconfirmed@invalid.test'")" accepted "acceptance committed"
eq "$(reader "$U" "select public.artales_ensure_profile_after_login_v082()->>'role'")" editor "replay preserves role"
eq "$(root -c "select count(*) from public.activity_log where actor_user_id='$U' and action='invite_accepted'")" 1 "single acceptance audit"
eq "$(reader "$M" "select public.artales_ensure_profile_after_login_v082()->>'inviteConflict'")" true "ambiguous invitations fail closed"
eq "$(root -c "select role::text from public.profiles where id='$M'")" reader "ambiguity cannot elevate"
eq "$(root -c "select count(*) from public.invites where email='new-ambiguous@invalid.test' and status='pending'")" 2 "ambiguous invitations not consumed"
eq "$(reader "$U" "select public.artales_complete_onboarding_v082('Verified Name','verified-handle')->>'ok'")" true "onboarding succeeds"
eq "$(root -c "select (profile_completed_at is not null)::text from public.profiles where id='$U'")" true "completion marker recorded"
eq "$(reader "$D" "select public.artales_complete_onboarding_v082('Duplicate Name','verified-handle')->>'reason'")" handle_taken "duplicate handle safely rejected"
# Two actual independent authenticated connections race on a single identity.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
(reader "$C" "select public.artales_ensure_profile_after_login_v082()->>'role'" >"$tmp/one") & one=$!
(reader "$C" "select public.artales_ensure_profile_after_login_v082()->>'role'" >"$tmp/two") & two=$!
wait "$one"; wait "$two"
eq "$(cat "$tmp/one")" editor "concurrent first caller"
eq "$(cat "$tmp/two")" editor "concurrent second caller"
eq "$(root -c "select count(*) from public.activity_log where actor_user_id='$C' and action='invite_accepted'")" 1 "concurrent acceptance audited once"
# Hold the revocation row lock, then race a real session RPC against it.
(root -c "begin; update public.invites set status='revoked' where email='revoked-race@invalid.test'; select pg_sleep(2); commit" >"$tmp/revoke") & revoke=$!
for n in $(seq 1 50); do
  [[ "$(root -c "select count(*) from pg_stat_activity where query like 'begin; update public.invites set status=%revoked-race@invalid.test%' and pid<>pg_backend_pid() and wait_event='PgSleep'")" == 1 ]] && break
  sleep .1
done
eq "$(root -c "select count(*) from pg_stat_activity where query like 'begin; update public.invites set status=%revoked-race@invalid.test%' and pid<>pg_backend_pid() and wait_event='PgSleep'")" 1 "revocation lock is held"
eq "$(reader "$X" "select public.artales_ensure_profile_after_login_v082()->>'role'")" reader "revocation wins race without elevation"
wait "$revoke"
eq "$(root -c "select status from public.invites where email='revoked-race@invalid.test'")" revoked "revoked status remains"
eq "$(root -c "select count(*) from public.activity_log where actor_user_id='$X' and action='invite_accepted'")" 0 "no audit for failed acceptance"
echo ARTALES_A2_IDENTITY_LIFECYCLE_ISOLATED_PASS
