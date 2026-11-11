import {readFileSync,writeFileSync,existsSync,renameSync} from "node:fs";
import {resolve} from "node:path";
if(process.env.GOLDEN_E2E_ISOLATED!=="yes")throw Error("Refusing to install golden migration bridge outside isolated CI");
const project=readFileSync(resolve("supabase/config.toml"),"utf8");
if(!project.includes('project_id = "artales-golden-browser"'))
 throw Error("Refusing non-golden Supabase project");
const baseline=readFileSync(resolve("supabase/migrations/20260926142755_remote_schema.sql"),"utf8");
if(!baseline.includes('artales_sync_profile_from_auth_user_v081')||
   !baseline.includes("meta ->> 'role'")||
   !baseline.includes('CREATE POLICY "Users can update own profile"')||
   !baseline.includes('CREATE POLICY "Invite managers and invitees can update invites"')||
   baseline.includes("CREATE TRIGGER zz_artales_profile_sync_v081"))
 throw Error("Baseline shape changed; review historical trigger bridge before continuing");
const file=resolve("supabase/migrations/20260926142756_golden_local_auth_trigger.sql");
if(existsSync(file))throw Error("Golden overlay already present, refusing overwrite");
writeFileSync(file,
"-- GOLDEN CI ONLY: restore the historical auth.users trigger omitted by schema-only baseline.\n"+
"-- No policy/security preflight bypass. Dropped with ephemeral CI database; never commit this SQL migration.\n"+
"CREATE TRIGGER zz_artales_profile_sync_v081 AFTER INSERT ON auth.users\n"+
"FOR EACH ROW EXECUTE FUNCTION public.artales_sync_profile_from_auth_user_v081();\n",
{flag:"wx"});
console.log("GOLDEN_LOCAL_HISTORY: generated exact legacy auth.users trigger on disposable DB");

const oneTime=resolve("supabase/migrations/20261028111000_artales_snapshot389_register.sql");
const oneTimeOutside=resolve("tests/browser/.golden-only-snapshot389-backfill.sql");
const oneTimeText=readFileSync(oneTime,"utf8");
if(!oneTimeText.includes("One-time evidence-backed readback registration for #389")||
 !oneTimeText.includes("historical_snapshot_storage_evidence_mismatch")||
 !oneTimeText.includes("INSERT INTO public.candidate_snapshots")||
 /\b(?:CREATE|ALTER|GRANT|REVOKE|DROP)\s+(?:TABLE|FUNCTION|POLICY|TRIGGER|VIEW)\b/i.test(oneTimeText)||
 existsSync(oneTimeOutside))
 throw Error("Unexpected #389 one-time migration; do not suppress new schema or security logic");
renameSync(oneTime,oneTimeOutside);
console.log("GOLDEN_LOCAL_HISTORY: excluded production-only #389 existing-data backfill from EMPTY local database (schema migrations remain active)");
