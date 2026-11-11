import {readFileSync,writeFileSync,existsSync} from "node:fs";
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
