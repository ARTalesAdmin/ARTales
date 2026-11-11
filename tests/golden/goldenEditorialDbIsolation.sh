#!/usr/bin/env bash
set -euo pipefail
[[ "${PGHOST:-}" == "127.0.0.1" && "${PGDATABASE:-}" == "postgres" && "${PGPORT:-}" == "5432" ]] || { echo "REFUSED non-local PostgreSQL" >&2; exit 2; }
root(){ PGPASSWORD=ci-root-only psql -X -qAt -v ON_ERROR_STOP=1 -U postgres "$@"; }
actor(){
 local uid="$1" sql="$2"
 PGPASSWORD=ci-actor-only psql -X -qAt -v ON_ERROR_STOP=1 -U golden_ci_editor \
  -c "SET request.jwt.claim.sub='$uid'; $sql"
}
eq(){ [[ "$1" == "$2" ]] || { echo "FAIL $3 expected=$2 actual=$1" >&2; exit 1; }; echo "PASS $3"; }
EDITOR=7e57a1e5-7e57-4ae5-8ae5-7e57a1e50003
CID=7e57a1e5-7e57-4ae5-8ae5-7e57a1e50001
COVER=works/$CID/cover/cover-synthetic.png
AUTHOR_CID=7e57a1e5-7e57-4ae5-8ae5-7e57a1e50011
AUTHOR_ID=7e57a1e5-7e57-4ae5-8ae5-7e57a1e50012
root -f tests/golden/goldenEditorialDbFixture.sql > /dev/null
root -f supabase/migrations/20261110130000_artales_unique_existing_author_byline.sql >/dev/null
awk '/^CREATE OR REPLACE FUNCTION public.artales_guard_editorial_task_evidence/{found=1} found{print}' \
 supabase/migrations/20261111133000_artales_editorial_exclusion_and_author_guard.sql \
 > /tmp/artales-golden-current-guard.sql
[[ "$(grep -c 'CREATE OR REPLACE FUNCTION' /tmp/artales-golden-current-guard.sql)" == 1 ]] ||
 { echo "FAIL missing canonical completion guard" >&2; exit 1; }
root -f /tmp/artales-golden-current-guard.sql >/dev/null
root -c "CREATE TRIGGER golden_evidence_guard BEFORE UPDATE OF status ON public.artales_editorial_tasks FOR EACH ROW EXECUTE FUNCTION public.artales_guard_editorial_task_evidence()" >/dev/null
if root -c "UPDATE public.artales_editorial_tasks SET status='completed' WHERE kind='cover_art'" >/tmp/golden-deny.log 2>&1; then
 echo "FAIL completed without cover" >&2; exit 1
fi
echo "PASS completion without cover denied"
eq "$(actor "$EDITOR" "SELECT public.artales_save_candidate_editorial_field('$CID','cover','works/$CID/cover/cover-nonexistent.png','Valid synthetic description',NULL)->>'result'")" cover_asset_missing "nonexistent asset rejected"
eq "$(actor "$EDITOR" "SELECT public.artales_save_candidate_editorial_field('$CID','cover','$COVER','Synthetic image alt description',NULL)->>'result'")" saved "cover persisted"
eq "$(root -c "SELECT cover_image_path FROM public.artales_candidate_editorial_metadata WHERE candidate_id='$CID'")" "$COVER" "cover linked"
root -c "UPDATE public.artales_editorial_tasks SET status='completed' WHERE candidate_id='$CID' AND kind='cover_art'" >/dev/null
eq "$(root -c "SELECT status FROM public.artales_editorial_tasks WHERE candidate_id='$CID' AND kind='cover_art'")" completed "real cover guard completes"
eq "$(actor "$EDITOR" "SELECT public.artales_save_candidate_editorial_field('$AUTHOR_CID','author','$AUTHOR_ID',NULL,NULL)->>'result'")" saved "existing author linked"
root -c "UPDATE public.artales_editorial_tasks SET status='completed' WHERE candidate_id='$AUTHOR_CID' AND kind='author_bio'" >/dev/null
eq "$(root -c "SELECT status FROM public.artales_editorial_tasks WHERE candidate_id='$AUTHOR_CID' AND kind='author_bio'")" completed "real author guard completes"
eq "$(root -c 'SELECT COUNT(*) FROM public.authors')" 1 "no duplicate author created"
if actor "7e57a1e5-7e57-4ae5-8ae5-7e57a1e50099" \
 "SELECT public.artales_save_candidate_editorial_field('$CID','cover','$COVER','Unauthorized image change',NULL)" >/tmp/golden-untrusted.log 2>&1; then
 echo "FAIL unauthorized user" >&2; exit 1
fi
echo "PASS untrusted actor denied"
echo "PASS GOLDEN_DB local fixture, discarded with PostgreSQL CI service"
