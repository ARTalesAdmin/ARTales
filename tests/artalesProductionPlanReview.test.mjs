import test from "node:test";
import assert from "node:assert/strict";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {inventoryFromDirectory,PROJECT,REPO} from "../scripts/artales-migration-plan-core.mjs";
import {CLI_PIN,planCommands} from "../scripts/artales-migration-plan-v01-core.mjs";
import {verifyPlanForHumanReview,describeApplyBoundary} from "../scripts/artales-production-plan-review.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const base=inventoryFromDirectory(join(root,"supabase","migrations"));
const SHA="c".repeat(40),NOW="2026-10-28T14:30:00.000Z";
const next={version:"20261028091029",name:"artales_identity_role_authority_v1",
 filename:"20261028091029_artales_identity_role_authority_v1.sql",
 sha256:"b".repeat(64),md5:"d".repeat(32)};
const rowTime=v=>v.slice(0,4)+"-"+v.slice(4,6)+"-"+v.slice(6,8)+" "+
 v.slice(8,10)+":"+v.slice(10,12)+":"+v.slice(12,14);
function fixture(withPending=true){
 const inventory=withPending?[...base,next]:[...base];
 const readback={schema:"artales-migration-readback/v0",
  source:"operator-attested-provider-readback",projectRef:PROJECT,
  observedAt:"2026-10-28T14:25:00.000Z",
  migrations:base.map(m=>({version:m.version,name:m.name,
   ...(m.version==="20260926142755"?{}:{statementMd5:m.md5})}))};
 const request={schema:"artales-migration-request/v0",projectRef:PROJECT,
  repository:REPO,ref:"refs/heads/main",headSha:SHA,
  expectedPending:withPending?[{filename:next.filename,sha256:next.sha256}]:[]};
 const observation={schema:"artales-cli-plan-observation/v0.1",
  source:"operator-attested-cli-json",projectRef:PROJECT,repository:REPO,
  mainSha:SHA,cliVersion:CLI_PIN,completedAt:"2026-10-28T14:29:00.000Z",
  commands:planCommands().map(c=>({id:c.id,argv:c.argv,exitCode:0,
   stdout:"",stderr:"Connecting to remote database...\n"}))};
 observation.commands[0].stdout=JSON.stringify({message:"Migrations listed",
  migrations:inventory.map(m=>({local:m.version,
   remote:base.some(b=>b.version===m.version)?m.version:"",
   time:rowTime(m.version)}))});
 observation.commands[1].stdout=JSON.stringify({
  upToDate:!withPending,dryRun:true,
  migrations:withPending?[next.filename]:[],seeds:[],roles:[],
  message:withPending?"Finished supabase db push.":"Remote database is up to date."
 });
 return {inventory,readback,request,observation,checkoutSha:SHA,
  envelope:{schema:"artales-migration-envelope/v0",projectRef:PROJECT,
   repository:REPO,sourceRef:"refs/heads/main",sourceSha:SHA,
   migrations:[{filename:next.filename,sha256:next.sha256}]},nowISO:NOW};
}
const blocked=f=>assert.throws(()=>verifyPlanForHumanReview(f),/blocked|invalid_migration/);
test("one exact pending migration yields a review-only receipt",()=>{
 const r=verifyPlanForHumanReview(fixture());
 assert.equal(r.migration.filename,next.filename);
 assert.equal(r.migration.sha256,next.sha256);
 assert.match(r.planProofDigest,/^[a-f0-9]{64}$/);
 assert.equal(r.productionApplyAuthorized,false);
 assert.equal(r.mayApply,false);
 assert.match(r.evidenceClass,/not-provider-authenticated/);
 const apply=describeApplyBoundary(r);
 assert.equal(apply.state,"NOT_IMPLEMENTED");
 assert.equal(apply.mayApply,false);
});
test("zero pending is not an APPLY review and stays blocked",()=>{
 blocked(fixture(false));
});
test("wrong project, head, source ref, hash and extra approval field blocked",()=>{
 const mutators=[
  f=>{f.envelope.projectRef="different";},
  f=>{f.envelope.sourceSha="e".repeat(40);},
  f=>{f.envelope.sourceRef="refs/heads/develop";},
  f=>{f.envelope.migrations[0].sha256="0".repeat(64);},
  f=>{f.envelope.approved=true;},
  f=>{f.envelope.migrations[0].approved=true;},
  f=>{f.request.expectedPending[0].sha256="0".repeat(64);}
 ];
 for(const mutate of mutators){const f=fixture();mutate(f);blocked(f);}
});
test("unknown CLI result, failed exit and false dry-run blocked",()=>{
 const mutators=[
  f=>{f.observation.cliVersion="0.0.0";},
  f=>{f.observation.commands[1].exitCode=1;},
  f=>{f.observation.commands[1].stdout='{"dryRun":false}';},
  f=>{f.observation.completedAt="2026-10-28T12:00:00.000Z";},
  f=>{f.observation.commands[1].argv.push("--include-seed");}
 ];
 for(const mutate of mutators){const f=fixture();mutate(f);blocked(f);}
});
test("missing second approval remains nonexecutable even with guessed human approval",()=>{
 const f=fixture();f.envelope.authorized=true;blocked(f);
 const valid=verifyPlanForHumanReview(fixture());
 const mutated={...valid,productionApplyAuthorized:true};
 assert.throws(()=>describeApplyBoundary(mutated),/blocked/);
 assert.equal(describeApplyBoundary(valid).productionApplyAuthorized,false);
});
