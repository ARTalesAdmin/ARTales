#!/usr/bin/env bash
# Disposable PostgreSQL service only. Never point this at a real Supabase host.
set -euo pipefail
if [[ "${PGHOST:-}" != "127.0.0.1" || "${PGDATABASE:-}" != "postgres" ]]; then
  echo "Refusing non-local / non-fixture PostgreSQL target" >&2; exit 2
fi
root() { PGPASSWORD=ci-root-only psql -X -qAt -v ON_ERROR_STOP=1 -U postgres "$@"; }
actor() {
  local login="$1" id="$2" sql="$3"
  PGPASSWORD=ci-actor-only psql -X -qAt -v ON_ERROR_STOP=1 -U "$login"     -c "SET request.jwt.claim.sub = '$id'; $sql"
}
deny() {
  local name="$1" login="$2" id="$3" sql="$4"
  if actor "$login" "$id" "$sql" >/tmp/snapshot-ci-deny.out 2>&1; then
    echo "FAIL: unexpectedly allowed $name" >&2; exit 1
  fi
  echo "PASS denied: $name"
}
assert_eq() {
  if [[ "$1" != "$2" ]]; then
    echo "FAIL $3 expected=$2 actual=$1" >&2; exit 1
  fi
  echo "PASS: $3"
}
A=11111111-1111-4111-8111-111111111111
E=22222222-2222-4222-8222-222222222222
O=33333333-3333-4333-8333-333333333333
SHA11=$(printf 'a%.0s' {1..64})
SHA12=$(printf 'b%.0s' {1..64})
PATH11="gutenberg/11/sha256/$SHA11/original.epub"
root -f tests/db/snapshotGeneralFixture.sql >/dev/null
root -f supabase/migrations/20261027130000_artales_snapshot_general_v1.sql >/dev/null
assert_eq "$(root -c "select count(*) from pg_class where relname in ('candidate_snapshots','candidate_snapshot_claims') and relrowsecurity")" "2" "both tables have RLS"
assert_eq "$(root -c "select count(*) from pg_roles where rolname in ('snapshot_ci_admin','snapshot_ci_editor','snapshot_ci_outsider','snapshot_ci_anon') and rolbypassrls")" "0" "all test logins NOBYPASSRLS"
root -f supabase/migrations/20261027131000_artales_snapshot389_register.sql >/dev/null
assert_eq "$(root -c "select count(*) from public.candidate_snapshots where gutenberg_id=389")" "1" "existing #389 registered once"
assert_eq "$(root -c "select count(*) from storage.objects where bucket_id='artales-raw-snapshots'")" "1" "#389 was not re-uploaded"
assert_eq "$(actor snapshot_ci_editor "$E" "select count(*) from public.candidate_snapshots where gutenberg_id=389")" "1" "editor sees archived #389"
assert_eq "$(actor snapshot_ci_outsider "$O" "select count(*) from public.candidate_snapshots")" "0" "ordinary member sees no receipts"
deny "anonymous receipt access" snapshot_ci_anon "$O" "select * from public.candidate_snapshots"
if root -f supabase/migrations/20261027131000_artales_snapshot389_register.sql >/tmp/snapshot-ci-backfill.out 2>&1; then
  echo "FAIL: duplicate #389 backfill allowed" >&2; exit 1
fi
assert_eq "$(root -c "select count(*) from public.candidate_snapshots")" "1" "duplicate #389 backfill changed nothing"
deny "editor claim" snapshot_ci_editor "$E" "insert into public.candidate_snapshot_claims values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc',11,11,'$SHA11','$E',now())"
deny "member claim" snapshot_ci_outsider "$O" "insert into public.candidate_snapshot_claims values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc',11,11,'$SHA11','$O',now())"
actor snapshot_ci_admin "$A" "insert into public.candidate_snapshot_claims(candidate_id,source_id,decision_no,gutenberg_id,sha256,claimed_by) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc',11,11,'$SHA11','$A')" >/dev/null
deny "duplicate claim" snapshot_ci_admin "$A" "insert into public.candidate_snapshot_claims(candidate_id,source_id,decision_no,gutenberg_id,sha256,claimed_by) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc',11,11,'$SHA11','$A')"
RECEIPT="insert into public.candidate_snapshots(candidate_id,source_id,decision_no,gutenberg_id,catalog_url,locked_file_url,selected_file_url,acquired_from,storage_path,sha256,byte_count,embedded_images,captured_at,recorded_by,private_image_retention) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc',11,11,'https://www.gutenberg.org/ebooks/11','https://www.gutenberg.org/ebooks/11.epub.noimages','https://www.gutenberg.org/ebooks/11.epub.noimages','https://gutenberg.pglaf.org/cache/epub/11/pg11.epub','$PATH11','$SHA11',120,0,now(),'$A','none')"
deny "receipt before object exists" snapshot_ci_admin "$A" "$RECEIPT"
deny "wrong SHA storage path" snapshot_ci_admin "$A" "insert into storage.objects(bucket_id,name,owner_id,metadata) values ('artales-raw-snapshots','gutenberg/11/sha256/$SHA12/original.epub','$A','{\"mimetype\":\"application/epub+zip\",\"size\":120}'::jsonb)"
deny "editor storage upload" snapshot_ci_editor "$E" "insert into storage.objects(bucket_id,name,owner_id,metadata) values ('artales-raw-snapshots','$PATH11','$E','{\"mimetype\":\"application/epub+zip\",\"size\":120}'::jsonb)"
actor snapshot_ci_admin "$A" "insert into storage.objects(bucket_id,name,owner_id,metadata) values ('artales-raw-snapshots','$PATH11','$A','{\"mimetype\":\"application/epub+zip\",\"size\":120}'::jsonb)" >/dev/null
actor snapshot_ci_admin "$A" "$RECEIPT" >/dev/null
assert_eq "$(actor snapshot_ci_editor "$E" "select count(*) from public.candidate_snapshots where gutenberg_id=11")" "1" "editor can inspect receipt"
assert_eq "$(actor snapshot_ci_editor "$E" "select count(*) from storage.objects where name='$PATH11'")" "0" "editor cannot read original"
assert_eq "$(actor snapshot_ci_admin "$A" "select count(*) from storage.objects where name='$PATH11'")" "1" "claiming admin can read exact original"
deny "second immutable receipt" snapshot_ci_admin "$A" "$RECEIPT"
deny "receipt update" snapshot_ci_admin "$A" "update public.candidate_snapshots set byte_count=121 where gutenberg_id=11"
deny "receipt delete" snapshot_ci_admin "$A" "delete from public.candidate_snapshots where gutenberg_id=11"
root -c "insert into storage.objects(bucket_id,name,owner_id,metadata) values ('artales-raw-snapshots','gutenberg/11/sha256/$SHA12/original.epub','$A','{\"mimetype\":\"application/epub+zip\",\"size\":120}'::jsonb)" >/dev/null
assert_eq "$(actor snapshot_ci_admin "$A" "select count(*) from storage.objects where name='gutenberg/11/sha256/$SHA12/original.epub'")" "0" "mismatched digest is not visible"
# Two genuinely independent restricted LOGIN connections compete for one claim.
CLAIM12="insert into public.candidate_snapshot_claims(candidate_id,source_id,decision_no,gutenberg_id,sha256,claimed_by) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',12,12,'$SHA12','$A')"
(actor snapshot_ci_admin "$A" "begin; $CLAIM12; select pg_sleep(1); commit" >/tmp/snapshot-ci-race1.log 2>&1) & p1=$!
(actor snapshot_ci_admin "$A" "$CLAIM12" >/tmp/snapshot-ci-race2.log 2>&1) & p2=$!
n=0
if wait "$p1"; then n=$((n+1)); fi
if wait "$p2"; then n=$((n+1)); fi
assert_eq "$n" "1" "exactly one concurrent claim succeeds"
assert_eq "$(root -c "select count(*) from public.candidate_snapshot_claims where gutenberg_id=12")" "1" "concurrent race leaves one claim"
echo "PASS: isolated PostgreSQL RLS, immutable registry, #389 no-copy backfill, duplicate + race"
