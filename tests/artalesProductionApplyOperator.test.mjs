import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {validateApplyDispatch,validateApplyConnection,validatePriorPlan,
 validateApplyLedger,assertPostApply,assertPlanHistory,assertApprovedApplyEnvironment} from "../scripts/artales-production-apply-operator.mjs";
const project="nmhdwmszbwgrgfbmlguu";
const sha="a".repeat(40),digest="b".repeat(64),proof="c".repeat(64);
const filename="20261126125926_fixture_economic_authority.sql";
const runId="41308766110";
const now="2026-11-01T13:00:00.000Z";
const env={GITHUB_ACTIONS:"true",GITHUB_EVENT_NAME:"workflow_dispatch",
 GITHUB_REF:"refs/heads/main",GITHUB_REPOSITORY:"ARTalesAdmin/ARTales",
 GITHUB_SHA:sha,ARTALES_APPLY_MAIN_SHA:sha,
 ARTALES_PRODUCTION_APPLY_ENV:"artales-production-migrations",GITHUB_RUN_ATTEMPT:"1",
 ARTALES_APPLY_FILENAME:filename,ARTALES_APPLY_SQL_SHA256:digest,
 ARTALES_APPLY_PLAN_PROOF_DIGEST:proof,ARTALES_APPLY_PLAN_RUN_ID:runId};
const selection={sha,filename,sqlSha:digest,proof,runId};
const run={id:41308766110,name:"ARTales Production read-only PLAN (NO APPLY)",
 path:".github/workflows/artales-production-readonly-plan.yml",
 event:"workflow_dispatch",status:"completed",conclusion:"success",
 head_branch:"main",head_sha:sha,run_attempt:1,
 created_at:"2026-11-01T12:50:00.000Z"};
const receipt={schema:"artales-production-readonly-plan/v1",
 repository:"ARTalesAdmin/ARTales",projectRef:project,mainSha:sha,
 mode:"one-migration",migration:{filename,sha256:digest},deferred:[],
 role:"artales_prod_plan_ro",cliVersion:"2.122.0",
 planProofDigest:proof,sourcePlanDigest:"d".repeat(64),
 appliedCount:31,historyDigest:"e".repeat(64),checkpointDigest:"f".repeat(64),mayApply:false,productionApplyAuthorized:false,
 independentReadbackRequired:true,
 evidenceClass:"operator-attested-cli-not-independently-authenticated",
 preReadbackAt:"2026-11-01T12:51:00.000Z",
 postReadbackAt:"2026-11-01T12:52:00.000Z"};
function blocked(fn){assert.throws(fn,/artales_apply_blocked:/);}
test("requires exact main and one approved reviewed new SQL migration",()=>{
 assert.deepEqual(validateApplyDispatch(env,sha,true),selection);
 for(const [k,v] of [
  ["GITHUB_REF","refs/heads/develop"],["GITHUB_EVENT_NAME","pull_request"],
  ["GITHUB_SHA","f".repeat(40)],["ARTALES_APPLY_SQL_SHA256","invalid"],
  ["ARTALES_APPLY_FILENAME","20260101000000_dangerous.sql"],
  ["ARTALES_PRODUCTION_APPLY_ENV","artales-production-plan"],
  ["ARTALES_PRODUCTION_APPLY_ENV","artales-production-identity-owner-maintenance"],["GITHUB_RUN_ATTEMPT","2"],
  ["ARTALES_APPLY_FILENAME","20261028110000_artales_snapshot_general_v1.sql"],
  ["ARTALES_APPLY_PLAN_RUN_ID","0"]]){
  blocked(()=>validateApplyDispatch({...env,[k]:v},sha,true));
 }
 assert.equal(validateApplyDispatch({...env,ARTALES_APPLY_FILENAME:"20261127100000_another_reviewed_change.sql"},sha,true).filename,"20261127100000_another_reviewed_change.sql");
 blocked(()=>validateApplyDispatch(env,sha,false));
});
test("owner-maintenance operator only accepts exact postgres identity",()=>{
 const good="postgresql://postgres:placeholder@db."+
  project+".supabase.co:5432/postgres?sslmode=verify-full";
 assert.equal(validateApplyConnection(good).role,"postgres");
 const pool="postgresql://postgres."+project+
  ":placeholder@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=verify-full";
 assert.equal(validateApplyConnection(pool).connectionClass,"session-pooler");
 for(const wrong of [good.replace("postgres:placeholder","artales_prod_apply_operator:placeholder"),
  good.replace("postgres:placeholder","artales_prod_plan_ro:placeholder"),
  good.replace("verify-full","require"),good.replace(":5432",":6543"),
  good.replace(project,"wrong"),good.replace(":placeholder",":" )]){
  blocked(()=>validateApplyConnection(wrong));
 }
});
test("PLAN must come from exact successful historical protected workflow",()=>{
 assert.equal(validatePriorPlan(run,receipt,selection,now),true);
 for(const m of [
  {run:{...run,conclusion:"failure"}},
  {run:{...run,event:"pull_request"}},
  {run:{...run,head_sha:"e".repeat(40)}},
  {run:{...run,path:".github/workflows/other.yml"}},
  {run:{...run,run_attempt:2}},
  {receipt:{...receipt,mayApply:true}},
  {receipt:{...receipt,mode:"baseline",migration:null}},
  {receipt:{...receipt,role:"postgres"}},
  {receipt:{...receipt,planProofDigest:"0".repeat(64)}},
  {receipt:{...receipt,productionApplyAuthorized:true}},
  {receipt:{...receipt,migration:{filename,sha256:"0".repeat(64)}}},
  {receipt:{...receipt,appliedCount:4}},
 ]){
  blocked(()=>validatePriorPlan(m.run||run,m.receipt||receipt,selection,now));
 }
 blocked(()=>validatePriorPlan({...run,created_at:"2026-10-30T12:00:00Z"},
  receipt,selection,now));
});
const baseline=JSON.parse(readFileSync("supabase/history/production-checkpoint-20261126.json","utf8")).ledger.map(({version,name,statementCount,ledgerSha256})=>({version,name,statementCount,ledgerSha256,statements:null}));
const fixture={principal:"postgres",sessionPrincipal:"postgres",database:"postgres",
 readOnly:"off",superuser:false,createRole:true,createDb:true,bypassRls:true,
 ledgerOwner:"postgres",migrations:baseline};
test("role and historical ledger validation denies dangerous drift",()=>{
 assert.equal(validateApplyLedger(fixture).length,31);
 for(const key of ["superuser","createRole","createDb","bypassRls"])
  blocked(()=>validateApplyLedger({...fixture,[key]:!fixture[key]}));
 blocked(()=>validateApplyLedger({...fixture,ledgerOwner:"other_owner"}));
 blocked(()=>validateApplyLedger({...fixture,principal:"other_role"}));
 blocked(()=>validateApplyLedger({...fixture,readOnly:"on"}));
 assert.throws(()=>validateApplyLedger({...fixture,migrations:[...baseline,baseline[0]]}),/blocked/);
});
test("post-APPLY verifies exact SQL source and all ordered statements",()=>{
 const hash=s=>createHash("sha256").update(s).digest("hex");
 const body="select 1;\nselect 2;\n";
 const selected={version:"20261126125926",name:"fixture_economic_authority",sha256:hash(body)};
 const row=statements=>({version:selected.version,name:selected.name,statementCount:statements.length,
  ledgerSha256:hash(JSON.stringify(statements)),statements});
 const after=[...baseline,row(["select 1","select 2"])];
 assert.equal(assertPostApply(baseline,after,selected,body),true);
 blocked(()=>assertPostApply(baseline,baseline,selected,body));
 blocked(()=>assertPostApply(baseline,after.concat(after.at(-1)),selected,body));
 assert.throws(()=>assertPostApply(baseline,[...baseline,row(["select 1","select 3"])],selected,body),/blocked/);
 assert.throws(()=>assertPostApply(baseline,[...baseline,row(["select 1"])],selected,body),/blocked/);
 blocked(()=>assertPostApply(baseline,after,selected,body+"select 3;"));
});
test("PLAN exact history and protected environment are mandatory",()=>{
 const stage={appliedCount:receipt.appliedCount,historyDigest:receipt.historyDigest,checkpointDigest:receipt.checkpointDigest,deferred:receipt.deferred};
 assert.equal(assertPlanHistory(receipt,stage),true);
 for(const key of ["historyDigest","checkpointDigest","appliedCount","deferred"])
  blocked(()=>assertPlanHistory(receipt,{...stage,[key]:null}));
 const environment={name:"artales-production-migrations",deployment_branch_policy:{custom_branch_policies:true},protection_rules:[{type:"required_reviewers",reviewers:[{type:"User",reviewer:{login:"ARTalesAdmin"}}]}]};
 assert.equal(assertApprovedApplyEnvironment(environment),true);
 blocked(()=>assertApprovedApplyEnvironment({...environment,protection_rules:[]}));
 blocked(()=>assertApprovedApplyEnvironment({...environment,name:"artales-production-identity-owner-maintenance"}));
 blocked(()=>assertApprovedApplyEnvironment({...environment,protection_rules:[{type:"required_reviewers",reviewers:[]}]}));
 blocked(()=>assertApprovedApplyEnvironment({...environment,deployment_branch_policy:null}));
});
test("production workflow requires separate protected environment; no PR or auto trigger",()=>{
 const yml=readFileSync(".github/workflows/artales-production-one-migration-apply.yml","utf8");
 assert.match(yml,/workflow_dispatch:/);
 assert.match(yml,/environment: artales-production-migrations/);
 assert.match(yml,/github.ref == 'refs\/heads\/main'/);
 assert.match(yml,/ARTALES_PROD_MIGRATION_DB_URL:.*secrets\./);
 assert.match(yml,/permissions:\n  contents: read\n  actions: read/);
 assert.doesNotMatch(yml,/\n  pull_request:|\n  push:|\n  schedule:|--include-all|migration repair/);
});
