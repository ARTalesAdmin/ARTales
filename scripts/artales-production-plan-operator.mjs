// Protected, manually dispatched, read-only PLAN runtime. No APPLY capability.
// All database queries are static SELECTs. Secrets and raw stderr are never logged.
import {spawnSync} from "node:child_process";
import {X509Certificate} from "node:crypto";
import {mkdtempSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {inventoryFromDirectory,PROJECT,REPO} from "./artales-migration-plan-core.mjs";
import {CLI_PIN,REDACTED_DB_URL,planCommands,verifyPlanV01} from "./artales-migration-plan-v01-core.mjs";
import {prepareOneMigrationStage} from "./artales-production-one-migration-stage.mjs";
import {buildRedactedDbUrlObservation} from "./artales-production-db-url-observation.mjs";
import {verifyPlanForHumanReview} from "./artales-production-plan-review.mjs";
const ROLE="artales_prod_plan_ro";
const fail=s=>{throw Error("artales_production_plan_blocked:"+s);};
const hex40=s=>typeof s==="string"&&/^[a-f0-9]{40}$/.test(s);
const hex64=s=>typeof s==="string"&&/^[a-f0-9]{64}$/.test(s);
export function validatePlanConnection(dbUrl){
 if(typeof dbUrl!=="string"||dbUrl.length<50||dbUrl.length>2048||/[\s\r\n]/.test(dbUrl))
  fail("db_url_required");
 let u;try{u=new URL(dbUrl);}catch{fail("db_url_invalid");}
 if(u.protocol!=="postgresql:"||!u.password||u.hash||u.port!=="5432"||
    u.pathname!=="/postgres"||u.searchParams.size!==1||
    u.searchParams.get("sslmode")!=="verify-full")fail("db_url_tls_port_or_params");
 const direct=u.hostname==="db."+PROJECT+".supabase.co";
 const pooler=/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(u.hostname);
 let username;try{username=decodeURIComponent(u.username);}catch{fail("db_url_username");}
 if((!direct&&!pooler)||username!==(direct?ROLE:ROLE+"."+PROJECT))
  fail("db_url_project_or_role");
 return Object.freeze({role:ROLE,connectionClass:direct?"direct":"session-pooler"});
}
export function validatePlanCertificate(pem){
 if(typeof pem!=="string"||pem.length<400||pem.length>16384||
    /PRIVATE KEY/.test(pem))fail("ca_certificate_missing_or_invalid");
 const matches=pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
 if(!matches||matches.length!==1||pem.trim()!==matches[0])
  fail("ca_certificate_format");
 let cert;
 try{cert=new X509Certificate(matches[0]);}
 catch{fail("ca_certificate_unparseable");}
 const now=Date.now(),start=Date.parse(cert.validFrom),end=Date.parse(cert.validTo);
 if(cert.ca!==true||!Number.isFinite(start)||!Number.isFinite(end)||
    start>now||end<=now)fail("ca_certificate_not_valid_ca");
 return matches[0]+"\n";
}
export function validatePlanDispatch(env,head,clean){
 if(!env||env.GITHUB_ACTIONS!=="true"||
    env.GITHUB_EVENT_NAME!=="workflow_dispatch"||
    env.GITHUB_REF!=="refs/heads/main"||env.GITHUB_REPOSITORY!==REPO||
    !hex40(head)||head!==env.GITHUB_SHA||head!==env.ARTALES_EXPECTED_MAIN_SHA||
    clean!==true)fail("not_clean_exact_main_dispatch");
 const mode=env.ARTALES_PLAN_MODE;
 const filename=env.ARTALES_SELECTED_FILENAME||"";
 const sha256=env.ARTALES_SELECTED_SHA256||"";
 if(mode==="baseline"&&(filename||sha256))fail("baseline_cannot_select");
 if(mode!=="baseline"&&mode!=="one-migration")fail("invalid_mode");
 if(mode==="one-migration"&&(!/^[0-9]{14}_[a-z0-9_]+\.sql$/.test(filename)||
    !hex64(sha256)))fail("invalid_selected_migration");
 return {mode,filename,sha256,mainSha:head};
}
export function validatePlanLedger(data){
 if(!data||data.principal!==ROLE||data.sessionPrincipal!==ROLE||
    data.database!=="postgres"||data.readOnly!=="on"||
    data.defaultReadOnly!=="on"||
    ["superuser","createRole","createDb","bypassRls","canCreateDatabase",
     "canCreateMigrationSchema","canCreatePublicSchema",
     "canInsert","canUpdate","canDelete","canTruncate"].some(k=>data[k]!==false)||
    !Array.isArray(data.migrations)||data.migrations.length<5||
    data.migrations.length>200)fail("role_or_ledger_invalid");
 let prev="";
 const result=[];
 for(const row of data.migrations){
  if(!row||!/^[0-9]{14}$/.test(row.version||"")||row.version<=prev||
    !/^[a-z0-9_]+$/.test(row.name||"")||
    (row.version!=="20260926142755"&&
     !/^[a-f0-9]{32}$/.test(row.statementMd5||"")))
   fail("ledger_order_or_fingerprint");
  prev=row.version;
  result.push({version:row.version,name:row.name,
   ...(row.version==="20260926142755"?{}:{statementMd5:row.statementMd5})});
 }
 if(result[0].version!=="20260926142755"||result[0].name!=="remote_schema")
  fail("baseline_missing");
 return result;
}
const READ_SQL=[
 "SELECT json_build_object(",
 " 'principal',current_user,'sessionPrincipal',session_user,",
 " 'database',current_database(),",
 " 'readOnly',current_setting('transaction_read_only'),",
 " 'defaultReadOnly',current_setting('default_transaction_read_only'),",
 " 'superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),",
 " 'createRole',(SELECT rolcreaterole FROM pg_roles WHERE rolname=current_user),",
 " 'createDb',(SELECT rolcreatedb FROM pg_roles WHERE rolname=current_user),",
 " 'bypassRls',(SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user),",
 " 'canCreateDatabase',has_database_privilege(current_user,current_database(),'CREATE'),",
 " 'canCreateMigrationSchema',has_schema_privilege(current_user,'supabase_migrations','CREATE'),",
 " 'canCreatePublicSchema',has_schema_privilege(current_user,'public','CREATE'),",
 " 'canInsert',has_table_privilege(current_user,'supabase_migrations.schema_migrations','INSERT'),",
 " 'canUpdate',has_table_privilege(current_user,'supabase_migrations.schema_migrations','UPDATE'),",
 " 'canDelete',has_table_privilege(current_user,'supabase_migrations.schema_migrations','DELETE'),",
 " 'canTruncate',has_table_privilege(current_user,'supabase_migrations.schema_migrations','TRUNCATE'),",
 " 'migrations',(SELECT COALESCE(json_agg(json_build_object(",
 "  'version',version,'name',name,'statementMd5',md5(statements[1]))",
 "  ORDER BY version),'[]'::json)",
 "  FROM supabase_migrations.schema_migrations));"
].join("\n");
function runBin(command,args,cwd){
 const p=spawnSync(command,args,{
  cwd,encoding:"utf8",timeout:150000,maxBuffer:131072,
  stdio:["ignore","pipe","pipe"],
  env:{PATH:process.env.PATH||"",HOME:process.env.HOME||"",
   CI:"true",NPM_CONFIG_FUND:"false",NPM_CONFIG_UPDATE_NOTIFIER:"false"}
 });
 if(p.error||p.status!==0)fail("command_failed_"+command);
 return {stdout:p.stdout||"",stderr:p.stderr||""};
}
function readLedger(dbUrl){
 const r=runBin("psql",["-X","--no-password","-v","ON_ERROR_STOP=1",
  "-t","-A","--dbname",dbUrl,"-c",READ_SQL]);
 if(r.stderr.trim()||r.stdout.length>120000)fail("psql_warning_or_size");
 let parsed;try{parsed=JSON.parse(r.stdout.trim());}catch{fail("psql_invalid_json");}
 return {migrations:validatePlanLedger(parsed),observedAt:new Date().toISOString()};
}
function cliCommands(stage,dbUrl){
 return planCommands("db-url-redacted").map(cmd=>{
  const args=cmd.argv.map(v=>v===REDACTED_DB_URL?dbUrl:v);
  const r=runBin("npm",["exec","--yes","--package=supabase@"+CLI_PIN,
   "--","supabase",...args],stage);
  return {id:cmd.id,argv:args,exitCode:0,stdout:r.stdout,stderr:r.stderr};
 });
}
function main(){
 const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
 const sha=runBin("git",["rev-parse","HEAD"],root).stdout.trim();
 const clean=runBin("git",["status","--porcelain"],root).stdout.trim()==="";
 const selected=validatePlanDispatch(process.env,sha,clean);
 if(process.env.ARTALES_PRODUCTION_PLAN_ENV!=="artales-production-plan")
  fail("protected_environment_marker_missing");
 const dbUrl=process.env.ARTALES_PROD_PLAN_DB_URL;
 const identity=validatePlanConnection(dbUrl);
 const caPem=validatePlanCertificate(process.env.ARTALES_PROD_PLAN_CA_PEM);
 const workspace=mkdtempSync(join(tmpdir(),"artales-plan-"));
 try{
  const caFile=join(workspace,"supabase-root-ca.pem");
  writeFileSync(caFile,caPem,{flag:"wx",mode:0o600});
  const verifiedUrl=new URL(dbUrl);
  verifiedUrl.searchParams.set("sslrootcert",caFile);
  const runtimeDbUrl=verifiedUrl.toString();
  const before=readLedger(runtimeDbUrl);
  const request={schema:"artales-migration-request/v0",
   projectRef:PROJECT,repository:REPO,ref:"refs/heads/main",
   headSha:sha,expectedPending:selected.mode==="baseline"?[]:[
    {filename:selected.filename,sha256:selected.sha256}]};
  const readback={schema:"artales-migration-readback/v0",
   source:"operator-attested-provider-readback",projectRef:PROJECT,
   observedAt:before.observedAt,migrations:before.migrations};
  let cwd=root,stageReceipt=null;
  if(selected.mode==="one-migration"){
   const stage=prepareOneMigrationStage({
    sourceMigrationsDir:join(root,"supabase","migrations"),
    stageRoot:join(workspace,"stage"),sourceSha:sha,
    projectRef:PROJECT,repository:REPO,
    applied:before.migrations.map(({version,name})=>({version,name})),
    selectedFilename:selected.filename,selectedSha256:selected.sha256
   });
   cwd=stage.stageRoot;stageReceipt=stage.receipt;
  }
  const inventory=inventoryFromDirectory(join(cwd,"supabase","migrations"));
  const version=runBin("npm",["exec","--yes","--package=supabase@"+CLI_PIN,
   "--","supabase","--version"],cwd);
  if(version.stdout.trim()!==CLI_PIN||version.stderr.trim())
   fail("cli_version_mismatch");
  const observation=buildRedactedDbUrlObservation({
   dbUrl:runtimeDbUrl,expectedRole:identity.role,projectRef:PROJECT,repository:REPO,
   mainSha:sha,cliVersion:CLI_PIN,completedAt:new Date().toISOString(),
   rawCommands:cliCommands(cwd,runtimeDbUrl)
  });
  const verification={inventory,readback,request,checkoutSha:sha,
    observation,nowISO:new Date().toISOString()};
  const proof=verifyPlanV01(verification);
  if(selected.mode==="baseline"&&proof.pending.length!==0)
   fail("baseline_has_pending");
  let review=null;
  if(selected.mode==="one-migration"){
   review=verifyPlanForHumanReview({...verification,
    envelope:{schema:"artales-migration-envelope/v0",
      projectRef:PROJECT,repository:REPO,sourceRef:"refs/heads/main",
      sourceSha:sha,migrations:[{filename:selected.filename,sha256:selected.sha256}]}
   });
  }
  const after=readLedger(runtimeDbUrl);
  if(JSON.stringify(before.migrations)!==JSON.stringify(after.migrations))
   fail("ledger_changed_during_plan");
  if(!process.env.RUNNER_TEMP)fail("missing_runner_temp");
  const receipt={schema:"artales-production-readonly-plan/v0",
   repository:REPO,projectRef:PROJECT,mainSha:sha,mode:selected.mode,
   migration:review?.migration||null,
   deferred:stageReceipt?.deferred||[],
   role:identity.role,connectionClass:identity.connectionClass,
   appliedCount:before.migrations.length,
   preReadbackAt:before.observedAt,postReadbackAt:after.observedAt,
   planProofDigest:proof.proofDigest,
   sourcePlanDigest:proof.sourcePlanDigest,cliVersion:CLI_PIN,
   evidenceClass:"operator-attested-cli-not-independently-authenticated",
   independentReadbackRequired:true,
   productionApplyAuthorized:false,mayApply:false};
  writeFileSync(join(process.env.RUNNER_TEMP,"artales-plan-receipt.json"),
   JSON.stringify(receipt,null,2)+"\n",{flag:"wx",mode:0o600});
  process.stdout.write("ARTALES_READONLY_PLAN_VERIFIED_NO_APPLY\n");
 }finally{rmSync(workspace,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
 try{main();}catch(e){
  // Raw CLI/psql errors may contain secrets: never echo them or their stacks.
  const s=String(e?.message||"");
  console.error(/^artales_(?:production_plan|admission|stage|plan_v01|runner_plan|db_url_capture)_blocked:[a-z0-9_]+$/.test(s)?
   s:"artales_production_plan_blocked:unclassified_failure");
  process.exitCode=1;
 }
}
