import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validatePlanConnection,validatePlanDispatch,validatePlanLedger} from "../scripts/artales-production-plan-operator.mjs";
const ref="nmhdwmszbwgrgfbmlguu",sha="a".repeat(40);
const url="postgresql://artales_prod_plan_ro:local-placeholder@db."+ref+".supabase.co:5432/postgres?sslmode=require";
test("exact TLS project and role required",()=>{
 assert.equal(validatePlanConnection(url).role,"artales_prod_plan_ro");
 for(const changed of [url.replace("sslmode=require","sslmode=disable"),
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
 readOnly:"on",defaultReadOnly:"on",superuser:false,createRole:false,createDb:false,
 bypassRls:false,canCreateDatabase:false,canCreateMigrationSchema:false,
 canCreatePublicSchema:false,canInsert:false,canUpdate:false,canDelete:false,canTruncate:false,
 migrations:[{version:"20260926142755",name:"remote_schema"},...[
 ["20261023063248","prescreen_shadow_library_v1"],["20261024073928","candidate_intake_ab"],
 ["20261025095658","legal_screen_v1"],["20261027081945","snapshot389_storage_admin_rls"]
 ].map(([version,name])=>({version,name,statementMd5:"a".repeat(32)}))]};
 assert.equal(validatePlanLedger(ok).length,5);
 for(const field of ["canInsert","canUpdate","canDelete","superuser","canCreatePublicSchema"])
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
