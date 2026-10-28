#!/bin/sh
set -eu
# Disposable PostgreSQL proof. Uses fixture-only CI credentials, never ARTales.
test "$PGDATABASE" = "artales_plan_disposable" || {
 echo "ABORT: this script is confined to disposable CI database" >&2; exit 1;
}
test "$PGHOST" = "127.0.0.1" || {
 echo "ABORT: non-local database target" >&2; exit 1;
}
psql -X -q -v ON_ERROR_STOP=1 -f tests/sql/artalesPlanRoleFixture.sql
query_reader(){
 psql -X -At -v ON_ERROR_STOP=1 -c "SET ROLE artales_migration_plan_reader; $1"
}
denied(){
 if query_reader "$1" >/dev/null 2>&1; then
  echo "ABORT: expected privilege denial: $2" >&2; exit 1;
 fi
}
result=$(query_reader 'SELECT count(*) FROM supabase_migrations.schema_migrations;' | tail -n 1)
test "$result" = "1" || { echo "ledger SELECT blocked unexpectedly" >&2; exit 1; }
denied "DELETE FROM supabase_migrations.schema_migrations;" "ledger delete"
denied "INSERT INTO supabase_migrations.schema_migrations VALUES ('x','x');" "ledger insert"
denied "UPDATE supabase_migrations.schema_migrations SET name='x';" "ledger update"
denied "SELECT * FROM plan_private_fixture.canary;" "private read"
denied "INSERT INTO plan_private_fixture.canary VALUES (99);" "private write"
denied "CREATE TABLE public.artales_plan_should_not_exist(id int);" "public create"
# SECURITY DEFINER retains owner's rights, despite the proposed reader role.
query_reader 'SELECT public.artales_plan_ci_canary();' >/dev/null
value=$(psql -X -At -v ON_ERROR_STOP=1 -c \
 'SELECT value FROM plan_private_fixture.canary;')
test "$value" = "1" || {
 echo "PUBLIC SECURITY DEFINER inheritance was not proven" >&2; exit 1;
}
# NEVER globally REVOKE PUBLIC on ARTales. Only disposable fixture demonstrates
# the effective entitlement cannot be removed from the reader role alone.
psql -X -q -v ON_ERROR_STOP=1 -c \
 'REVOKE EXECUTE ON FUNCTION public.artales_plan_ci_canary() FROM PUBLIC;'
denied "SELECT public.artales_plan_ci_canary();" "revoked fixture-only public execute"
echo "DISPOSABLE ROLE PROOF PASS: ledger SELECT only; PUBLIC SECURITY DEFINER was callable before fixture-only global REVOKE"
