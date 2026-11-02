import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateApplyDispatch,validateApplyConnection,validatePriorPlan,
 validateApplyLedger,assertPostApply} from "../scripts/artales-production-apply-operator.mjs";
const project="nmhdwmszbwgrgfbmlguu";
const sha="a".repeat(40),digest="b".repeat(64),proof="c".repeat(64);
const filename="20261028091029_artales_identity_role_authority_v1.sql";
const runId="41308766110";
const now="2026-11-01T13:00:00.000Z";
const env={GITHUB_ACTIONS:"true",GITHUB_EVENT_NAME:"workflow_dispatch",
 GITHUB_REF:"refs/heads/main",GITHUB_REPOSITORY:"ARTalesAdmin/ARTales",
 GITHUB_SHA:sha,ARTALES_APPLY_MAIN_SHA:sha,
 ARTALES_PRODUCTION_APPLY_ENV:"artales-production-identity-owner-maintenance",
 ARTALES_OWNER_MAINTENANCE_SCOPE:"identity-20261028091029",GITHUB_RUN_ATTEMPT:"1",
 ARTALES_APPLY_FILENAME:filename,ARTALES_APPLY_SQL_SHA256:digest,
 ARTALES_APPLY_PLAN_PROOF_DIGEST:proof,ARTALES_APPLY_PLAN_RUN_ID:runId};
const selection={sha,filename,sqlSha:digest,proof,runId};
const run={id:41308766110,name:"ARTales Production read-only PLAN (NO APPLY)",
 path:".github/workflows/artales-production-readonly-plan.yml",
 event:"workflow_dispatch",status:"completed",conclusion:"success",
 head_branch:"main",head_sha:sha,run_attempt:1,
 created_at:"2026-11-01T12:50:00.000Z"};
const receipt={schema:"artales-production-readonly-plan/v0",
 repository:"ARTalesAdmin/ARTales",projectRef:project,mainSha:sha,
 mode:"one-migration",migration:{filename,sha256:digest},deferred:[],
 role:"artales_prod_plan_ro",cliVersion:"2.122.0",
 planProofDigest:proof,sourcePlanDigest:"d".repeat(64),
 appliedCount:5,mayApply:false,productionApplyAuthorized:false,
 independentReadbackRequired:true,
 evidenceClass:"operator-attested-cli-not-independently-authenticated",
 preReadbackAt:"2026-11-01T12:51:00.000Z",
 postReadbackAt:"2026-11-01T12:52:00.000Z"};
function blocked(fn){assert.throws(fn,/artales_apply_blocked:/);}
test("requires exact main and one approved allowlisted SQL migration",()=>{
 assert.deepEqual(validateApplyDispatch(env,sha,true),selection);
 for(const [k,v] of [
  ["GITHUB_REF","refs/heads/develop"],["GITHUB_EVENT_NAME","pull_request"],
  ["GITHUB_SHA","f".repeat(40)],["ARTALES_APPLY_SQL_SHA256","invalid"],
  ["ARTALES_APPLY_FILENAME","20260101000000_dangerous.sql"],
  ["ARTALES_PRODUCTION_APPLY_ENV","artales-production-plan"],
  ["ARTALES_OWNER_MAINTENANCE_SCOPE","snapshot"],["GITHUB_RUN_ATTEMPT","2"],
  ["ARTALES_APPLY_FILENAME","20261028110000_artales_snapshot_general_v1.sql"],
  ["ARTALES_APPLY_PLAN_RUN_ID","0"]]){
  blocked(()=>validateApplyDispatch({...env,[k]:v},sha,true));
 }
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
const baseline=[{version:"20260926142755",name:"remote_schema"},
 ...[["20261023063248","prescreen_shadow_library_v1"],
     ["20261024073928","candidate_intake_ab"],
     ["20261025095658","legal_screen_v1"],
     ["20261027081945","snapshot389_storage_admin_rls"]]
    .map(([version,name])=>({version,name,statementMd5:"c".repeat(32)}))];
const fixture={principal:"postgres",
 sessionPrincipal:"postgres",database:"postgres",
 readOnly:"off",superuser:false,createRole:true,createDb:true,
 bypassRls:true,profilesOwner:"postgres",invitesOwner:"postgres",
 syncFunctionOwner:"postgres",ledgerOwner:"postgres",migrations:baseline};
test("role and historical ledger validation denies dangerous drift",()=>{
 assert.equal(validateApplyLedger(fixture).length,5);
 for(const key of ["superuser","createRole","createDb","bypassRls"]){
  blocked(()=>validateApplyLedger({...fixture,[key]:!fixture[key]}));
 }
 for(const key of ["profilesOwner","invitesOwner","syncFunctionOwner","ledgerOwner"])
  blocked(()=>validateApplyLedger({...fixture,[key]:"other_owner"}));
 blocked(()=>validateApplyLedger({...fixture,principal:"other_role"}));
 blocked(()=>validateApplyLedger({...fixture,readOnly:"on"}));
 blocked(()=>validateApplyLedger({...fixture,migrations:[baseline[0],baseline[0]]}));
});
test("post-APPLY verifies the exact additional version and SQL md5",()=>{
 const selected={version:"20261028091029",name:"artales_identity_role_authority_v1",
  md5:"e".repeat(32)};
 const after=[...baseline,{version:selected.version,name:selected.name,
  statementMd5:selected.md5}];
 assert.equal(assertPostApply(baseline,after,selected),true);
 blocked(()=>assertPostApply(baseline,baseline,selected));
 blocked(()=>assertPostApply(baseline,after.concat(after.at(-1)),selected));
 blocked(()=>assertPostApply(baseline,[...baseline, {...after.at(-1),statementMd5:"0".repeat(32)}],selected));
});
test("production workflow requires separate protected environment; no PR or auto trigger",()=>{
 const yml=readFileSync(".github/workflows/artales-production-one-migration-apply.yml","utf8");
 assert.match(yml,/workflow_dispatch:/);
 assert.match(yml,/environment: artales-production-identity-owner-maintenance/);
 assert.match(yml,/github.ref == 'refs\/heads\/main'/);
 assert.match(yml,/ARTALES_PROD_OWNER_DB_URL:.*secrets\./);
 assert.match(yml,/permissions:\n  contents: read\n  actions: read/);
 assert.doesNotMatch(yml,/\n  pull_request:|\n  push:|\n  schedule:|--include-all|migration repair/);
});
