import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,rmSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {assertCurrentRemoteMain,validatePlanConnection,validatePlanCertificate,validatePlanDispatch,validatePlanLedger} from "../scripts/artales-production-plan-operator.mjs";
const ref="nmhdwmszbwgrgfbmlguu",sha="a".repeat(40);
const url="postgresql://artales_prod_plan_ro:local-placeholder@db."+ref+".supabase.co:5432/postgres?sslmode=verify-full";
test("exact TLS project and role required",()=>{
 assert.equal(validatePlanConnection(url).role,"artales_prod_plan_ro");
 for(const changed of [url.replace("sslmode=verify-full","sslmode=disable"),
 url.replace("artales_prod_plan_ro","postgres"),url.replace(ref,"different"),
 url.replace(":5432",":6543")])assert.throws(()=>validatePlanConnection(changed),/blocked/);
});
test("protected manually dispatched main only",()=>{
 const env={GITHUB_ACTIONS:"true",GITHUB_EVENT_NAME:"workflow_dispatch",
 GITHUB_REF:"refs/heads/main",GITHUB_REPOSITORY:"ARTalesAdmin/ARTales",
 GITHUB_SHA:sha,ARTALES_EXPECTED_MAIN_SHA:sha,ARTALES_PLAN_MODE:"baseline",
 ARTALES_SELECTED_FILENAME:"",ARTALES_SELECTED_SHA256:""};
 assert.equal(validatePlanDispatch(env,sha,true).mode,"baseline");
 for(const key of ["GITHUB_SHA","ARTALES_EXPECTED_MAIN_SHA","GITHUB_REF","GITHUB_EVENT_NAME"]){
  assert.throws(()=>validatePlanDispatch({...env,[key]:"wrong"},sha,true),/blocked/);
 }
 assert.throws(()=>validatePlanDispatch(env,sha,false),/blocked/);
});
test("effective nonwrite permissions and ledger enforced",()=>{
 const ok={principal:"artales_prod_plan_ro",sessionPrincipal:"artales_prod_plan_ro",database:"postgres",
 readOnly:"on",defaultReadOnly:"on",inheritsPrivileges:false,roleMembershipCount:0,
 superuser:false,createRole:false,createDb:false,
 bypassRls:false,canCreateDatabase:false,canCreateMigrationSchema:false,
 canCreatePublicSchema:false,canInsert:false,canUpdate:false,canDelete:false,canTruncate:false,
 migrations:[{version:"20260926142755",name:"remote_schema"},...[
 ["20261023063248","prescreen_shadow_library_v1"],["20261024073928","candidate_intake_ab"],
 ["20261025095658","legal_screen_v1"],["20261027081945","snapshot389_storage_admin_rls"]
 ].map(([version,name])=>({version,name,statementMd5:"a".repeat(32)}))]};
 assert.equal(validatePlanLedger(ok).length,5);
 for(const field of ["canInsert","canUpdate","canDelete","superuser",
  "canCreatePublicSchema","inheritsPrivileges"])
 assert.throws(()=>validatePlanLedger({...ok,[field]:true}),/blocked/);
});
test("dormant workflow protected, no PR secrets and no apply",()=>{
 const w=readFileSync(".github/workflows/artales-production-readonly-plan.yml","utf8");
 assert.match(w,/workflow_dispatch:/);
 assert.match(w,/environment: artales-production-plan/);
 assert.match(w,/github.ref == 'refs\/heads\/main'/);
 assert.doesNotMatch(w,/\n  pull_request:|\n  schedule:|\n  push:/);
 assert.doesNotMatch(w,/migration repair|supabase db push/);
});


test("rejects missing or invalid CA instead of pretending SSL authenticates the provider",()=>{
 for(const bad of [undefined,"","-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----",
  "-----BEGIN PRIVATE KEY-----\nnot-allowed\n-----END PRIVATE KEY-----"]){
  assert.throws(()=>validatePlanCertificate(bad),/blocked/);
 }
 const dir=mkdtempSync(join(tmpdir(),"artales-ca-fixture-"));
 try{
  const ca=join(dir,"root.pem"),key=join(dir,"key.pem");
  const result=spawnSync("openssl",[
   "req","-x509","-newkey","rsa:2048","-nodes","-keyout",key,
   "-out",ca,"-days","2","-subj","/CN=artales-disposable-ca",
   "-addext","basicConstraints=critical,CA:TRUE"],{
    encoding:"utf8",timeout:25000
  });
  assert.equal(result.status,0,"isolated OpenSSL CA fixture creation");
  const pem=readFileSync(ca,"utf8");
  const accepted=validatePlanCertificate(pem);
  assert.match(accepted,/BEGIN CERTIFICATE/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test("rejects ANY membership allowing a SET ROLE escalation",()=>{
 const ok={principal:"artales_prod_plan_ro",sessionPrincipal:"artales_prod_plan_ro",
 database:"postgres",readOnly:"on",defaultReadOnly:"on",
 inheritsPrivileges:false,roleMembershipCount:1,
 superuser:false,createRole:false,createDb:false,bypassRls:false,
 canCreateDatabase:false,canCreateMigrationSchema:false,canCreatePublicSchema:false,
 canInsert:false,canUpdate:false,canDelete:false,canTruncate:false,
 migrations:[{version:"20260926142755",name:"remote_schema"},
  ...[["20261023063248","prescreen_shadow_library_v1"],
  ["20261024073928","candidate_intake_ab"],
  ["20261025095658","legal_screen_v1"],
  ["20261027081945","snapshot389_storage_admin_rls"]]
  .map(([version,name])=>({version,name,statementMd5:"a".repeat(32)}))]};
 assert.throws(()=>validatePlanLedger(ok),/role_or_ledger_invalid/);
 assert.equal(validatePlanLedger({...ok,roleMembershipCount:0}).length,5);
});


test("rejects stale or unverified main ref before and after protected PLAN",()=>{
 assert.equal(assertCurrentRemoteMain(sha,sha+"\trefs/heads/main\n"),true);
 for(const remote of [
   "b".repeat(40)+"\trefs/heads/main\n",
   sha+"\trefs/heads/develop\n",
   sha+"\trefs/heads/main",
   sha+"\trefs/heads/main\n"+sha+"\trefs/heads/other\n",
   "", "fatal: inaccessible remote\n"
 ]){
   assert.throws(()=>assertCurrentRemoteMain(sha,remote),/main_head_changed_or_unverifiable/);
 }
});
