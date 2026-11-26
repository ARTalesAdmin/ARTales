#!/usr/bin/env bash
set -euo pipefail
[[ "${PGHOST:-}" == 127.0.0.1 && "${PGDATABASE:-}" == postgres ]] || exit 2
root(){ psql -X -qAt -v ON_ERROR_STOP=1 "$@"; }
dir="$(mktemp -d)"
trap 'touch "$dir/release"; jobs -p | xargs -r kill 2>/dev/null || true; rm -rf "$dir"' EXIT
export LOCK_READY="$dir/ready" LOCK_RELEASE="$dir/release"
run_pair(){
  local name="$1" first="$2" second="$3" expected1="$4" expected2="$5"
  rm -f "$LOCK_READY" "$LOCK_RELEASE"
  PGAPPNAME="artales-econ-first" psql -X -qAt -v ON_ERROR_STOP=1 >"$dir/first" 2>&1 <<SQL &
begin;
set local role service_role;
select ($first)->>'code';
\\! touch "$LOCK_READY"
\\! for i in \$(seq 1 200); do test -f "$LOCK_RELEASE" && exit 0; sleep .05; done; exit 1
commit;
SQL
  local p1=$!
  for i in $(seq 1 100); do [[ -f "$LOCK_READY" ]] && break; sleep .05; done
  [[ -f "$LOCK_READY" ]] || { cat "$dir/first"; echo "first transaction did not reach barrier"; exit 1; }
  PGAPPNAME="artales-econ-second" root -c "set role service_role; select ($second)->>'code';" >"$dir/second" 2>&1 &
  local p2=$!
  local blocked=0
  for i in $(seq 1 100); do
    if [[ "$(root -c "select count(*) from pg_stat_activity where application_name='artales-econ-second' and wait_event_type='Lock'")" == 1 ]]; then blocked=1; break; fi
    sleep .05
  done
  touch "$LOCK_RELEASE"
  wait "$p1" || { cat "$dir/first"; exit 1; }
  wait "$p2" || { cat "$dir/second"; exit 1; }
  [[ "$blocked" == 1 ]] || { echo "No observed blocking: $name"; cat "$dir/first" "$dir/second"; exit 1; }
  [[ "$(cat "$dir/first")" == "$expected1" && "$(cat "$dir/second")" == "$expected2" ]] ||
    { echo "Unexpected result: $name"; cat "$dir/first" "$dir/second"; exit 1; }
  echo "PASS: $name (second request observed waiting for lock)"
}
U=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
V=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
X=cccccccc-cccc-4ccc-8ccc-cccccccccccc
W=88888888-8888-4888-8888-888888888888
W2=22222222-2222-4222-8222-222222222222
root -c "insert into public.profiles(id) values ('$U'),('$V'),('$X'); insert into public.reader_credit_ledger(user_id,amount,source) values ('$U',1,'purchase'),('$V',1,'purchase'),('$X',2,'purchase'); insert into public.reader_member_unlock_ledger(user_id,amount,source) values ('$V',1,'promo');"
run_pair "gift versus credit unlock" "public.artales_gift_reader_credit('$U',1)" "public.use_at_credit_online_unlock('$U','$W')" credit_gifted not_enough_credit
run_pair "AT versus member unlock of same title" "public.use_at_credit_online_unlock('$V','$W')" "public.use_member_online_unlock('$V','$W')" credit_unlock_used already_unlocked
run_pair "membership versus credit unlock" "public.activate_reader_membership_with_credits('$X','basic',2,2,0,false)" "public.use_at_credit_online_unlock('$X','$W2')" activated not_enough_credit
[[ "$(root -c "select sum(amount) from public.reader_credit_ledger where user_id in ('$U','$V','$X')")" == 0 ]]
[[ "$(root -c "select sum(amount) from public.reader_member_unlock_ledger where user_id='$V'")" == 1 ]]
[[ "$(root -c "select count(*) from public.reader_entitlements where user_id='$V' and work_id='$W'")" == 1 ]]
[[ "$(root -c "select count(*) from public.reader_entitlements where user_id='$U'")" == 0 ]]
echo "PASS: balances and entitlement counts after concurrent transactions"
