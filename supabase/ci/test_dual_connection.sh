#!/usr/bin/env bash
set -euo pipefail
# CI ONLY: 2 independent local TCP PostgreSQL sessions, never --linked.
export PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres
psql -X -v ON_ERROR_STOP=1 -f supabase/ci/201_concurrency_fixture.sql >/dev/null
actor=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
promote_first() {
  local candidate="$1" marker="$2" sleep_seconds="$3" log="$4"
  psql -X -v ON_ERROR_STOP=1 >"$log" 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$actor',true);
SELECT public.promote_candidate_to_edit_text('$candidate'::uuid)->>'result' AS result;
\\! touch $marker
SELECT pg_sleep($sleep_seconds);
COMMIT;
SQL
}
promote_second() {
  local candidate="$1" timeout="$2"
  psql -X -At -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$actor',true);
SET LOCAL lock_timeout='$timeout';
SELECT public.promote_candidate_to_edit_text('$candidate'::uuid)->>'result';
COMMIT;
SQL
}
wait_marker() {
  local marker="$1"
  for i in {1..100}; do
    [ -e "$marker" ] && return 0
    sleep 0.1
  done
  echo "Timed out waiting for first independent connection" >&2
  return 1
}
assert_single() {
  local candidate="$1" suffix="${1//-/}" 
  local counts
  counts="$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT (SELECT count(*) FROM public.works WHERE slug='candidate-$suffix') || ':' || (SELECT count(*) FROM public.editorial_tasks WHERE source_external_id='candidate-edit:$candidate') || ':' || (SELECT count(*) FROM public.work_candidate_promotion_attempts WHERE candidate_id='$candidate' AND result='promoted');")"
  [ "$counts" = "1:1:1" ] || { echo "duplicate or missing artifacts: $counts" >&2; return 1; }
}
run_pair() {
  local candidate="$1" mode="$2" marker
  marker="$(mktemp -u /tmp/artales-ci-concurrency.XXXXXX)"
  local first_log second_log
  first_log="$(mktemp)"; second_log="$(mktemp)"
  promote_first "$candidate" "$marker" 3 "$first_log" &
  local pid=$!
  trap 'kill "$pid" 2>/dev/null || true; rm -f "$marker" "$first_log" "$second_log"' EXIT
  wait_marker "$marker"
  if [ "$mode" = "timeout" ]; then
    if promote_second "$candidate" "300ms" >"$second_log" 2>&1; then
      echo "Expected lock timeout, second connection unexpectedly succeeded" >&2
      exit 1
    fi
    grep -qi "lock timeout" "$second_log" || { cat "$second_log"; exit 1; }
  else
    promote_second "$candidate" "15s" >"$second_log" 2>&1
    grep -q 'already_promoted' "$second_log" || { cat "$second_log"; exit 1; }
  fi
  wait "$pid"
  grep -q 'promoted' "$first_log"
  assert_single "$candidate"
  promote_second "$candidate" "5s" | grep -q '^already_promoted || { echo "retry not idempotent" >&2; exit 1; }
  rm -f "$marker" "$first_log" "$second_log"
  trap - EXIT
  echo "PASS: $mode independent sessions, single draft/task/audit, idempotent retry"
}
run_pair 11111111-1111-4111-8111-111111111111 success
run_pair 33333333-3333-4333-8333-333333333333 timeout
 || { echo "retry not idempotent" >&2; exit 1; }
  rm -f "$marker" "$first_log" "$second_log"
  trap - EXIT
  echo "PASS: $mode independent sessions, single draft/task/audit, idempotent retry"
}
run_pair 11111111-1111-4111-8111-111111111111 success
run_pair 33333333-3333-4333-8333-333333333333 timeout
