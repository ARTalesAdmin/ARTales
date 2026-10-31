import test from "node:test";
import assert from "node:assert/strict";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {PROJECT,REPO,inventoryFromDirectory} from "../scripts/artales-migration-plan-core.mjs";
import {CLI_PIN,REDACTED_DB_URL,planCommands,verifyPlanV01}
 from "../scripts/artales-migration-plan-v01-core.mjs";
import {buildRedactedDbUrlObservation}
 from "../scripts/artales-production-db-url-observation.mjs";
import {verifyPlanForHumanReview} from "../scripts/artales-production-plan-review.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const base=inventoryFromDirectory(join(root,"supabase","migrations"));
const HEAD="c".repeat(40),NOW="2026-10-31T19:40:00.000Z";
const dbUrl="postgresql://artales_plan_probe_ro:disposable-secret-123@127.0.0.1:5432/cli_contract";
const next={version:"20261028091029",name:"artales_identity_role_authority_v1",
  filename:"20261028091029_artales_identity_role_authority_v1.sql",
  sha256:"b".repeat(64),md5:"d".repeat(32)};
const time=v=>v.slice(0,4)+"-"+v.slice(4,6)+"-"+v.slice(6,8)+" "+
 v.slice(8,10)+":"+v.slice(10,12)+":"+v.slice(12,14);
function fixture(){
 const inventory=[...base,next],observedAt="2026-10-31T19:37:00.000Z";
 const readback={schema:"artales-migration-readback/v0",
  source:"operator-attested-provider-readback",projectRef:PROJECT,observedAt,
  migrations:base.map(m=>({version:m.version,name:m.name,
   ...(m.version==="20260926142755"?{}:{statementMd5:m.md5})}))};
 const request={schema:"artales-migration-request/v0",projectRef:PROJECT,
  repository:REPO,ref:"refs/heads/main",headSha:HEAD,
  expectedPending:[{filename:next.filename,sha256:next.sha256}]};
 const list={message:"Migrations listed",
  migrations:inventory.map(m=>({local:m.version,
  remote:base.some(x=>x.version===m.version)?m.version:"",time:time(m.version)}))};
 const push={upToDate:false,dryRun:true,migrations:[next.filename],
  seeds:[],roles:[],message:"Finished supabase db push."};
 const rawCommands=planCommands("db-url-redacted").map((cmd,i)=>({
   id:cmd.id,argv:cmd.argv.map(a=>a===REDACTED_DB_URL?dbUrl:a),
   exitCode:0,stdout:JSON.stringify(i===0?list:push),
   stderr:"Connecting to remote database...\n"}));
 const config={dbUrl,expectedRole:"artales_plan_probe_ro",
   projectRef:PROJECT,repository:REPO,mainSha:HEAD,cliVersion:CLI_PIN,
   completedAt:"2026-10-31T19:39:00.000Z",rawCommands};
 return {inventory,readback,request,config,envelope:{
  schema:"artales-migration-envelope/v0",projectRef:PROJECT,repository:REPO,
  sourceRef:"refs/heads/main",sourceSha:HEAD,
  migrations:[{filename:next.filename,sha256:next.sha256}]}};
}
test("db-url capture redacts credential and binds separate v0.2 transport",()=>{
 const f=fixture();const observation=buildRedactedDbUrlObservation(f.config);
 const json=JSON.stringify(observation);
 assert.ok(!json.includes("disposable-secret-123")&&!json.includes("127.0.0.1"));
 assert.equal(observation.commands[0].argv[3],REDACTED_DB_URL);
 const proof=verifyPlanV01({...f,observation,checkoutSha:HEAD,nowISO:NOW});
 assert.equal(proof.transport,"db-url-redacted");
 assert.equal(proof.linkedIdentityIndependentlyVerified,false);
 assert.equal(proof.productionApplyAuthorized,false);
 assert.equal(proof.mayApply,false);
 const review=verifyPlanForHumanReview({...f,observation,checkoutSha:HEAD,nowISO:NOW});
 assert.equal(review.cliTransport,"db-url-redacted");
 assert.equal(review.mayApply,false);
});
test("old linked PLAN contract remains unchanged and separate",()=>{
 assert.equal(planCommands()[0].argv[2],"--linked");
 assert.equal(planCommands("db-url-redacted")[0].argv[2],"--db-url");
 assert.throws(()=>planCommands("other"),/blocked/);
});
test("refuses raw secrets in observation, fabricated authorization or live transport claim",()=>{
 const f=fixture();const observation=buildRedactedDbUrlObservation(f.config);
 for(const mutate of [
  x=>{x.commands[0].argv[3]=dbUrl;},
  x=>{x.commands[1].argv.push("--include-all");},
  x=>{x.commands[1].stdout=JSON.stringify({...JSON.parse(x.commands[1].stdout),dryRun:false});},
  x=>{x.transport="linked";},
  x=>{x.approved=true;}
 ]){
  const v=structuredClone(observation);mutate(v);
  assert.throws(()=>verifyPlanV01({...f,observation:v,checkoutSha:HEAD,nowISO:NOW}),/blocked/);
 }
});
test("capture fails closed on wrong target/role, argv, stderr and secret-bearing JSON",()=>{
 for(const change of [
  x=>{x.expectedRole="postgres";},
  x=>{x.projectRef="other";},
  x=>{x.rawCommands[0].argv[3]="postgresql://postgres:other@localhost/db";},
  x=>{x.rawCommands[1].argv=x.rawCommands[1].argv.filter(a=>a!=="--dry-run");},
  x=>{x.rawCommands[0].stderr="warning: token leaked";},
  x=>{x.rawCommands[0].stdout=JSON.stringify({message:"Migrations listed",
    migrations:[],password:"disposable-secret-123"});},
  x=>{x.rawCommands[1].stdout=JSON.stringify({...JSON.parse(x.rawCommands[1].stdout),
    migrations:["postgresql://bad-secret"]});}
 ]){
  const f=fixture();change(f.config);
  assert.throws(()=>buildRedactedDbUrlObservation(f.config),/artales_db_url_capture_blocked/);
 }
});
test("stale/false provider evidence remains blocked even after redaction",()=>{
 for(const mutate of [
  f=>{f.readback.observedAt="2026-10-31T18:00:00.000Z";},
  f=>{f.request.expectedPending[0].sha256="0".repeat(64);},
  f=>{f.config.rawCommands[1].stdout=JSON.stringify({upToDate:false,dryRun:true,
    migrations:["20261028111000_artales_snapshot389_register.sql"],
    seeds:[],roles:[],message:"Finished supabase db push."});}
 ]){
  const f=fixture();mutate(f);
  const observation=buildRedactedDbUrlObservation(f.config);
  assert.throws(()=>verifyPlanV01({...f,observation,checkoutSha:HEAD,nowISO:NOW}),/blocked/);
 }
});
