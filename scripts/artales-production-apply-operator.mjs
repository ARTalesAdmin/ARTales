// ARTales narrowly scoped one-migration APPLY. NEVER runnable from PR.
// Production execution requires a separately approved and protected GitHub
// environment, a separately selected database role and a prior live PLAN.
// No credentials, rights or environment are created by this source file.
import {spawnSync} from "node:child_process";
import {readFileSync,mkdtempSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {inventoryFromDirectory,PROJECT,REPO} from "./artales-migration-plan-core.mjs";
import {CLI_PIN,REDACTED_DB_URL,planCommands,verifyPlanV01} from "./artales-migration-plan-v01-core.mjs";
import {prepareOneMigrationStage} from "./artales-production-one-migration-stage.mjs";
import {assertCurrentRemoteMain,validatePlanCertificate} from "./artales-production-plan-operator.mjs";

const ROLE="postgres"; // Existing owner of identity tables, auth sync function and ledger.
const PLAN_WORKFLOW=".github/workflows/artales-production-readonly-plan.yml";
const ALLOWED=new Set(["20261028091029_artales_identity_role_authority_v1.sql"]);
// Owner access is one-time IDENTITY maintenance only. Snapshot/storage are excluded.
const hex=(s,n)=>typeof s==="string"&&new RegExp("^[a-f0-9]{"+n+"}$").test(s);
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=s=>{throw Error("artales_apply_blocked:"+s);};
export function validateApplyDispatch(env,sha,clean){
 if(!env||env.GITHUB_ACTIONS!=="true"||
    env.GITHUB_EVENT_NAME!=="workflow_dispatch"||
    env.GITHUB_REF!=="refs/heads/main"||env.GITHUB_REPOSITORY!==REPO||
    !hex(sha,40)||sha!==env.GITHUB_SHA||sha!==env.ARTALES_APPLY_MAIN_SHA||
    env.ARTALES_PRODUCTION_APPLY_ENV!=="artales-production-identity-owner-maintenance"||
    env.ARTALES_OWNER_MAINTENANCE_SCOPE!=="identity-20261028091029"||
    env.GITHUB_RUN_ATTEMPT!=="1"||clean!==true)
  fail("dispatch_or_main_not_exact");
 const filename=env.ARTALES_APPLY_FILENAME;
 const sqlSha=env.ARTALES_APPLY_SQL_SHA256;
 const proof=env.ARTALES_APPLY_PLAN_PROOF_DIGEST;
 const runId=env.ARTALES_APPLY_PLAN_RUN_ID;
 if(!ALLOWED.has(filename)||!hex(sqlSha,64)||!hex(proof,64)||
    typeof runId!=="string"||!/^[1-9][0-9]{5,17}$/.test(runId))
  fail("approved_artifact_or_migration_missing");
 return Object.freeze({sha,filename,sqlSha,proof,runId});
}
export function validateApplyConnection(raw){
 if(typeof raw!=="string"||raw.length<60||raw.length>2048||
    /[\s\r\n]/.test(raw))fail("credential_missing_or_invalid");
 let url;try{url=new URL(raw);}catch{fail("credential_url_invalid");}
 const direct=url.hostname==="db."+PROJECT+".supabase.co";
 const pooler=/^[a-z0-9-]+[.]pooler[.]supabase[.]com$/.test(url.hostname);
 let name;try{name=decodeURIComponent(url.username);}catch{fail("credential_username_invalid");}
 if(url.protocol!=="postgresql:"||!url.password||url.port!=="5432"||
    url.pathname!=="/postgres"||url.searchParams.size!==1||
    url.searchParams.get("sslmode")!=="verify-full"||url.hash||
    (!direct&&!pooler)||name!==(direct?ROLE:ROLE+"."+PROJECT))
  fail("credential_role_host_or_tls_invalid");
 return Object.freeze({role:ROLE,connectionClass:direct?"direct":"session-pooler"});
}
export function validatePriorPlan(run,receipt,selection,nowISO){
 if(!run||String(run.id)!==selection.runId||
    run.name!=="ARTales Production read-only PLAN (NO APPLY)"||
    run.path!==PLAN_WORKFLOW||run.event!=="workflow_dispatch"||
    run.status!=="completed"||run.conclusion!=="success"||
    run.head_branch!=="main"||run.head_sha!==selection.sha||
    run.run_attempt!==1)fail("plan_run_not_authoritative");
 const created=Date.parse(run.created_at),now=Date.parse(nowISO);
 if(!Number.isFinite(created)||!Number.isFinite(now)||
    created>now+30000||now-created>86400000)fail("plan_run_stale");
 if(!receipt||receipt.schema!=="artales-production-readonly-plan/v0"||
    receipt.repository!==REPO||receipt.projectRef!==PROJECT||
    receipt.mainSha!==selection.sha||receipt.mode!=="one-migration"||
    !receipt.migration||receipt.migration.filename!==selection.filename||
    receipt.migration.sha256!==selection.sqlSha||
    receipt.planProofDigest!==selection.proof||
    !hex(receipt.sourcePlanDigest,64)||
    receipt.role!=="artales_prod_plan_ro"||receipt.cliVersion!==CLI_PIN||
    receipt.mayApply!==false||receipt.productionApplyAuthorized!==false||
    receipt.independentReadbackRequired!==true||
    !Number.isInteger(receipt.appliedCount)||receipt.appliedCount<5||
    !Array.isArray(receipt.deferred)||
    receipt.evidenceClass!=="operator-attested-cli-not-independently-authenticated")
  fail("plan_receipt_drift_or_untrusted");
 const before=Date.parse(receipt.preReadbackAt),after=Date.parse(receipt.postReadbackAt);
 if(!Number.isFinite(before)||!Number.isFinite(after)||
    before<created-30000||after<before||after>now+30000||
    now-after>86400000)fail("plan_receipt_time_invalid");
 return true;
}
export function validateApplyLedger(data){
 if(!data||data.principal!==ROLE||data.sessionPrincipal!==ROLE||
    data.database!=="postgres"||data.readOnly!=="off"||
    data.superuser!==false||data.createRole!==true||
    data.createDb!==true||data.bypassRls!==true||
    data.profilesOwner!==ROLE||data.invitesOwner!==ROLE||
    data.syncFunctionOwner!==ROLE||data.ledgerOwner!==ROLE||
    !Array.isArray(data.migrations)||data.migrations.length<5||
    data.migrations.length>200)fail("apply_role_or_ledger_invalid");
 let previous="";
 for(const r of data.migrations){
  if(!r||!/^[0-9]{14}$/.test(r.version||"")||
     !/^[a-z0-9_]+$/.test(r.name||"")||
     (r.version!=="20260926142755"&&!hex(r.statementMd5,32))||
     r.version<=previous)fail("apply_ledger_order_or_fingerprint");
  previous=r.version;
 }
 return data.migrations.map(x=>({...x}));
}
export function assertPostApply(before,after,selected){
 if(!Array.isArray(before)||!Array.isArray(after)||
    after.length!==before.length+1||!eq(after.slice(0,-1),before)||
    !selected||!hex(selected.md5,32)||
    !eq(after.at(-1),{
      version:selected.version,name:selected.name,statementMd5:selected.md5
    }))fail("post_apply_history_mismatch");
 return true;
}
const SQL=[
"SELECT json_build_object(",
" 'principal',current_user,'sessionPrincipal',session_user,",
" 'database',current_database(),",
" 'readOnly',current_setting('transaction_read_only'),",
" 'superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),",
" 'createRole',(SELECT rolcreaterole FROM pg_roles WHERE rolname=current_user),",
" 'createDb',(SELECT rolcreatedb FROM pg_roles WHERE rolname=current_user),",
" 'bypassRls',(SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user),",
" 'profilesOwner',(SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public.profiles'::regclass),",
" 'invitesOwner',(SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public.invites'::regclass),",
" 'syncFunctionOwner',(SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.artales_sync_profile_from_auth_user_v081()'::regprocedure),",
" 'ledgerOwner',(SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='supabase_migrations.schema_migrations'::regclass),",
" 'migrations',(SELECT COALESCE(json_agg(json_build_object(",
"  'version',version,'name',name,'statementMd5',md5(statements[1]))",
"  ORDER BY version),'[]'::json)",
"  FROM supabase_migrations.schema_migrations));"
].join("\n");
function runBin(bin,args,cwd){
 const p=spawnSync(bin,args,{cwd,encoding:"utf8",timeout:180000,maxBuffer:131072,
  stdio:["ignore","pipe","pipe"],
  env:{PATH:process.env.PATH||"",HOME:process.env.HOME||"",
   CI:"true",NPM_CONFIG_FUND:"false",NPM_CONFIG_UPDATE_NOTIFIER:"false"}});
 if(p.error||p.status!==0)fail("command_failed_"+bin);
 return {stdout:p.stdout||"",stderr:p.stderr||""};
}
function ledger(url){
 const r=runBin("psql",["-X","--no-password","-v","ON_ERROR_STOP=1",
  "-t","-A","--dbname",url,"-c",SQL]);
 if(r.stderr.trim()||r.stdout.length>110000)fail("psql_warning_or_size");
 let data;try{data=JSON.parse(r.stdout.trim());}catch{fail("psql_invalid_json");}
 return {migrations:validateApplyLedger(data),observedAt:new Date().toISOString()};
}
function cli(stage,args){
 return runBin("npm",["exec","--yes","--package=supabase@"+CLI_PIN,
   "--","supabase",...args],stage);
}
function checkedPlanCli(stage,url,sha,inventory,readback,selection){
 const results=planCommands("db-url-redacted").map(spec=>{
  const args=spec.argv.map(a=>a===REDACTED_DB_URL?url:a);
  const value=cli(stage,args);
  return {id:spec.id,argv:spec.argv,exitCode:0,
    stdout:value.stdout,stderr:value.stderr};
 });
 const observation={schema:"artales-cli-plan-observation/v0.2",
  source:"operator-attested-cli-json",transport:"db-url-redacted",
  projectRef:PROJECT,repository:REPO,mainSha:sha,cliVersion:CLI_PIN,
  completedAt:new Date().toISOString(),commands:results};
 return verifyPlanV01({inventory,readback,request:{
   schema:"artales-migration-request/v0",projectRef:PROJECT,repository:REPO,
   ref:"refs/heads/main",headSha:sha,expectedPending:[
     {filename:selection.filename,sha256:selection.sqlSha}]},
  checkoutSha:sha,observation,nowISO:new Date().toISOString()});
}
async function getRun(runId){
 if(!process.env.GITHUB_TOKEN)fail("github_actions_read_token_missing");
 const url="https://api.github.com/repos/"+REPO+"/actions/runs/"+runId;
 let res;try{res=await fetch(url,{headers:{
  Accept:"application/vnd.github+json",
  Authorization:"Bearer "+process.env.GITHUB_TOKEN,
  "X-GitHub-Api-Version":"2022-11-28"
 },redirect:"error",signal:AbortSignal.timeout(10000)});}
 catch{fail("github_plan_api_unreachable");}
 if(!res.ok)fail("github_plan_api_rejected");
 let body;try{body=await res.json();}catch{fail("github_plan_api_invalid");}
 return body;
}
async function main(){
 const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
 const sha=runBin("git",["rev-parse","HEAD"],root).stdout.trim();
 const clean=runBin("git",["status","--porcelain"],root).stdout.trim()==="";
 const selected=validateApplyDispatch(process.env,sha,clean);
 assertCurrentRemoteMain(sha,runBin("git",
  ["ls-remote","--exit-code","origin","refs/heads/main"],root).stdout);
 const receiptPath=join(process.env.RUNNER_TEMP||"","artales-approved-plan",
  "artales-plan-receipt.json");
 if(!process.env.RUNNER_TEMP||!receiptPath.startsWith(process.env.RUNNER_TEMP))
  fail("plan_artifact_path_missing");
 let receipt;
 try{const data=readFileSync(receiptPath,"utf8");if(data.length>15000)fail("plan_receipt_size");
     receipt=JSON.parse(data);}
 catch{fail("plan_receipt_unavailable");}
 const run=await getRun(selected.runId);
 validatePriorPlan(run,receipt,selected,new Date().toISOString());
 const dbUrl=process.env.ARTALES_PROD_OWNER_DB_URL;
 const identity=validateApplyConnection(dbUrl);
 const pem=validatePlanCertificate(process.env.ARTALES_PROD_OWNER_CA_PEM);
 const workspace=mkdtempSync(join(tmpdir(),"artales-one-apply-"));
 try{
  const certPath=join(workspace,"supabase-root-ca.pem");
  writeFileSync(certPath,pem,{flag:"wx",mode:0o600});
  const verifiedUrl=new URL(dbUrl);
  verifiedUrl.searchParams.set("sslrootcert",certPath);
  const url=verifiedUrl.toString();
  const before=ledger(url);
  if(before.migrations.length!==receipt.appliedCount)
   fail("stale_plan_applied_count");
  const stage=prepareOneMigrationStage({
   sourceMigrationsDir:join(root,"supabase","migrations"),
   stageRoot:join(workspace,"stage"),sourceSha:sha,projectRef:PROJECT,
   repository:REPO,applied:before.migrations.map(r=>({version:r.version,name:r.name})),
   selectedFilename:selected.filename,selectedSha256:selected.sqlSha
  });
  if(!eq(stage.receipt.deferred,receipt.deferred))
   fail("pending_set_changed_since_plan");
  const inventory=inventoryFromDirectory(join(stage.stageRoot,"supabase","migrations"));
  const chosen=inventory.at(-1);
  if(!chosen||chosen.filename!==selected.filename||chosen.sha256!==selected.sqlSha)
   fail("selected_sql_digest_changed");
  const readback={schema:"artales-migration-readback/v0",
   source:"operator-attested-provider-readback",projectRef:PROJECT,
   observedAt:before.observedAt,migrations:before.migrations};
  const version=cli(stage.stageRoot,["--version"]);
  if(version.stdout.trim()!==CLI_PIN||version.stderr.trim())
   fail("cli_version_changed");
  const proof=checkedPlanCli(stage.stageRoot,url,sha,inventory,readback,selected);
  if(!eq(proof.pending,[selected.filename])||proof.mayApply!==false)
   fail("new_plan_invalid");
  const latest=ledger(url);
  if(!eq(latest.migrations,before.migrations))
   fail("provider_drift_before_apply");
  assertCurrentRemoteMain(sha,runBin("git",
    ["ls-remote","--exit-code","origin","refs/heads/main"],root).stdout);
  // A durable held_unknown artifact is written BEFORE provider mutation;
  // any interrupted call requires independent readback, never automatic retry.
  const path=join(process.env.RUNNER_TEMP,"artales-apply-receipt.json");
  const data={schema:"artales-production-one-migration-apply/v0",
   authorityClass:"one-time-owner-maintenance-separately-approved",
   ownerIdentityExpected:"postgres",
   repository:REPO,projectRef:PROJECT,mainSha:sha,filename:selected.filename,
   sqlSha256:selected.sqlSha,planRunId:selected.runId,
   planProofDigest:selected.proof,preflightDigest:proof.proofDigest,
   operatorRole:identity.role,connectionClass:identity.connectionClass,
   appliedCountBefore:before.migrations.length,
   status:"held_unknown",requiresIndependentReadback:true,autoRetryAllowed:false,
   completedAt:null};
  writeFileSync(path,JSON.stringify(data,null,2)+"\n",{flag:"wx",mode:0o600});
  const applied=cli(stage.stageRoot,["db","push","--db-url",url,
    "--skip-vault","--output-format","json"]);
  let output;try{output=JSON.parse(applied.stdout);}catch{fail("write_returned_unparseable");}
  if(!output||output.dryRun!==false||output.upToDate!==false||
    !eq(output.migrations,[selected.filename])||!eq(output.seeds,[])||
    !eq(output.roles,[])||output.message!=="Finished supabase db push.")
   fail("write_output_unknown");
  const after=ledger(url);
  assertPostApply(before.migrations,after.migrations,chosen);
  assertCurrentRemoteMain(sha,runBin("git",
    ["ls-remote","--exit-code","origin","refs/heads/main"],root).stdout);
  data.status="applied_requires_independent_readback";
  data.appliedCountAfter=after.migrations.length;
  data.completedAt=new Date().toISOString();
  writeFileSync(path,JSON.stringify(data,null,2)+"\n",{mode:0o600});
  process.stdout.write("ARTALES_ONE_MIGRATION_APPLIED_INDEPENDENT_READBACK_REQUIRED\n");
 }finally{rmSync(workspace,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
 main().catch(e=>{
  const s=String(e?.message||"");
  console.error(/^artales_(?:apply|stage|admission|plan_v01|production_plan)_blocked:[a-z0-9_]+$/.test(s)?
   s:"artales_apply_blocked:unclassified_failure");
  process.exitCode=1;
 });
}
