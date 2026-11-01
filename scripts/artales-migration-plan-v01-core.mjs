// ARTales PLAN v0.1: offline verifier for JSON results from Supabase CLI 2.122.0.
// This module has NO CLI invocation, DB, authentication or APPLY capability.
import {createHash} from "node:crypto";
import {admission,PROJECT,REPO} from "./artales-migration-plan-core.mjs";
export const CLI_PIN="2.122.0";
const sha256=s=>createHash("sha256").update(s,"utf8").digest("hex");
const fail=s=>{throw Error("artales_plan_v01_blocked:"+s);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const REDACTED_DB_URL="[ARTALES_DB_URL_REDACTED]";
const fixedCommands=[
 {id:"migration-list",argv:["migration","list","--linked","--project-ref",PROJECT,"--output-format","json"]},
 {id:"db-push-dry-run",argv:["db","push","--linked","--project-ref",PROJECT,
    "--dry-run","--skip-vault","--output-format","json"]}
];
const redactedDbUrlCommands=[
 {id:"migration-list",argv:["migration","list","--db-url",REDACTED_DB_URL,
   "--output-format","json"]},
 {id:"db-push-dry-run",argv:["db","push","--db-url",REDACTED_DB_URL,
   "--dry-run","--skip-vault","--output-format","json"]}
];
export function planCommands(transport="linked"){
 if(transport!=="linked"&&transport!=="db-url-redacted")
  fail("unsupported_transport");
 const selected=transport==="linked"?fixedCommands:redactedDbUrlCommands;
 return selected.map(c=>({id:c.id,argv:[...c.argv]}));
}
function parseJsonCapture(capture,expected){
 if(!capture||capture.id!==expected.id||!same(capture.argv,expected.argv)||
    capture.exitCode!==0||typeof capture.stdout!=="string"||
    capture.stdout.length>65536||!capture.stdout.trim()||
    typeof capture.stderr!=="string"||capture.stderr.length>65536||
    /(?:error:|warning:|failed|password|bearer\s|postgres(?:ql)?:\/\/|vault\.secrets|Loading config override)/i.test(capture.stderr))
   fail("cli_command_or_stderr_mismatch:"+expected.id);
 let parsed;
 try{parsed=JSON.parse(capture.stdout);}catch{fail("invalid_json:"+expected.id);}
 if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))
   fail("wrong_json_type:"+expected.id);
 return parsed;
}
function exactObject(obj,keys,label){
 const actual=Object.keys(obj).sort();
 if(!same(actual,[...keys].sort()))fail("unknown_or_missing_json_fields:"+label);
}
export function verifyPlanV01({inventory,readback,request,checkoutSha,observation,nowISO}){
 const source=admission({inventory,readback,request,checkoutSha,nowISO});
 const dbUrlMode=observation?.schema==="artales-cli-plan-observation/v0.2";
 const transport=dbUrlMode?"db-url-redacted":"linked";
 if(dbUrlMode&&(
    observation.transport!=="db-url-redacted"||
    Object.keys(observation).sort().join("|")!==
      ["schema","source","transport","projectRef","repository","mainSha",
       "cliVersion","completedAt","commands"].sort().join("|")))
   fail("db_url_observation_fields_or_transport");
 if(!observation||
    (!dbUrlMode&&observation.schema!=="artales-cli-plan-observation/v0.1")||
    observation.source!=="operator-attested-cli-json"||
    observation.projectRef!==PROJECT||observation.repository!==REPO||
    observation.mainSha!==checkoutSha||observation.cliVersion!==CLI_PIN||
    !Array.isArray(observation.commands)||observation.commands.length!==2)
  fail("observation_identity_or_version");
 const now=Date.parse(nowISO),when=Date.parse(observation.completedAt),
  ledgerTime=Date.parse(readback.observedAt);
 if(!Number.isFinite(when)||!Number.isFinite(now)||!Number.isFinite(ledgerTime)||
    when<ledgerTime||when>now+30000||now-when>900000||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(observation.completedAt))
  fail("stale_or_unordered_cli_observation");
 const expected=planCommands(transport);
 const list=parseJsonCapture(observation.commands[0],expected[0]);
 exactObject(list,["migrations","message"],"list");
 if(list.message!=="Migrations listed"||!Array.isArray(list.migrations))
  fail("list_json_shape");
 const applied=new Set(readback.migrations.map(m=>m.version));
 const expectedRows=inventory.map(m=>({
  local:m.version,remote:applied.has(m.version)?m.version:""
 }));
 if(list.migrations.length!==expectedRows.length)fail("list_row_count");
 list.migrations.forEach((row,i)=>{
  exactObject(row,["local","remote","time"],"list_row");
  if(row.local!==expectedRows[i].local||row.remote!==expectedRows[i].remote||
     typeof row.time!=="string"||
     !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.time))
   fail("list_history_or_identity_mismatch");
 });
 const push=parseJsonCapture(observation.commands[1],expected[1]);
 exactObject(push,["upToDate","dryRun","migrations","seeds","roles","message"],"push");
 const expectPending=source.pending.map(m=>m.filename);
 if(push.dryRun!==true||push.upToDate!==(expectPending.length===0)||
    !same(push.migrations,expectPending)||!same(push.seeds,[])||
    !same(push.roles,[])||
    push.message!==(expectPending.length===0?
      "Remote database is up to date.":"Finished supabase db push."))
  fail("push_dry_run_payload_drift");
 const proof={schema:dbUrlMode?"artales-migration-plan-proof/v0.2":"artales-migration-plan-proof/v0.1",
  ...(dbUrlMode?{transport:"db-url-redacted"}:{}),
  projectRef:PROJECT,repository:REPO,mainSha:source.headSha,
  sourcePlanDigest:source.planDigest,cliVersion:CLI_PIN,
  completedAt:observation.completedAt,pending:expectPending,
  listSha256:sha256(observation.commands[0].stdout),
  dryRunSha256:sha256(observation.commands[1].stdout)};
 return {...proof,proofDigest:sha256(JSON.stringify(proof)),
  evidenceClass:dbUrlMode?
    "operator-attested-redacted-db-url-cli-not-provider-authenticated":
    "operator-attested-cli-json-not-provider-authenticated",
  linkedIdentityIndependentlyVerified:false,
  noProductionDbWriteClaim:"CLI 2.122.0 dry-run, subject to external operator authorization",
  productionApplyAuthorized:false,mayApply:false};
}
