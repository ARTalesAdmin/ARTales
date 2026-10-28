import test from "node:test";
import assert from "node:assert/strict";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {PROJECT,REPO,inventoryFromDirectory} from "../scripts/artales-migration-plan-core.mjs";
import {CLI_PIN,planCommands,verifyPlanV01} from "../scripts/artales-migration-plan-v01-core.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const base=inventoryFromDirectory(join(root,"supabase","migrations"));
const HEAD="a".repeat(40),NOW="2026-10-28T14:30:00.000Z";
const next={version:"20261028091029",name:"artales_identity_role_authority_v1",
 filename:"20261028091029_artales_identity_role_authority_v1.sql",
 sha256:"b".repeat(64),md5:"c".repeat(32)};
const timeForVersion=v=>v.slice(0,4)+"-"+v.slice(4,6)+"-"+v.slice(6,8)+" "+
 v.slice(8,10)+":"+v.slice(10,12)+":"+v.slice(12,14);
function fixture(pending=false){
 const inventory=pending?[...base,next]:base;
 const readback={schema:"artales-migration-readback/v0",
  source:"operator-attested-provider-readback",projectRef:PROJECT,
  observedAt:"2026-10-28T14:25:00.000Z",
  migrations:base.map(m=>({version:m.version,name:m.name,
   ...(m.version==="20260926142755"?{}:{statementMd5:m.md5})}))};
 const request={schema:"artales-migration-request/v0",projectRef:PROJECT,
  repository:REPO,ref:"refs/heads/main",headSha:HEAD,
  expectedPending:pending?[{filename:next.filename,sha256:next.sha256}]:[]};
 const obs={schema:"artales-cli-plan-observation/v0.1",
  source:"operator-attested-cli-json",projectRef:PROJECT,repository:REPO,
  mainSha:HEAD,cliVersion:CLI_PIN,completedAt:"2026-10-28T14:29:00.000Z",
  commands:planCommands().map(cmd=>({id:cmd.id,argv:cmd.argv,exitCode:0,stdout:"",
   stderr:"Connecting to remote database...\n"}))};
 obs.commands[0].stdout=JSON.stringify({message:"Migrations listed",
  migrations:inventory.map(m=>({local:m.version,
   remote:base.some(x=>x.version===m.version)?m.version:"",
   time:timeForVersion(m.version)}))});
 obs.commands[1].stdout=JSON.stringify({upToDate:!pending,dryRun:true,
  migrations:pending?[next.filename]:[],seeds:[],roles:[],
  message:pending?"Finished supabase db push.":"Remote database is up to date."});
 return {inventory,readback,request,checkoutSha:HEAD,observation:obs,nowISO:NOW};
}
function blocked(f){assert.throws(()=>verifyPlanV01(f),/artales_plan_v01_blocked|artales_admission_blocked/);}
test("verified no-pending PLAN is a proof, NEVER apply authorization",()=>{
 const proof=verifyPlanV01(fixture());
 assert.deepEqual(proof.pending,[]);
 assert.equal(proof.productionApplyAuthorized,false);
 assert.equal(proof.linkedIdentityIndependentlyVerified,false);
 assert.equal(proof.mayApply,false);
 assert.match(proof.proofDigest,/^[a-f0-9]{64}$/);
});
test("one exactly approved pending identity migration is planned only",()=>{
 const proof=verifyPlanV01(fixture(true));
 assert.deepEqual(proof.pending,[next.filename]);
 assert.equal(proof.mayApply,false);
});
test("read-only command argv pins exact project, no role, seed or APPLY",()=>{
 const cmds=planCommands();
 assert.equal(cmds.length,2);
 for(const c of cmds){
  assert.ok(c.argv.includes("--project-ref")&&c.argv.includes(PROJECT));
  assert.ok(c.argv.includes("--linked"));
  assert.ok(c.argv.includes("json"));
  assert.ok(!c.argv.includes("--include-all")&&!c.argv.includes("--include-seed"));
 }
 assert.ok(cmds[1].argv.includes("--dry-run"));
 assert.ok(cmds[1].argv.includes("--skip-vault"));
});
test("tampered project, main, CLI pin and flags fail closed",()=>{
 for(const [key,val] of [["projectRef","wrong"],["mainSha","b".repeat(40)],
  ["cliVersion","2.119.0"]]){
  const f=fixture(true);f.observation[key]=val;blocked(f);
 }
 const f=fixture(true);f.observation.commands[1].argv.splice(4,2);blocked(f);
 const g=fixture(true);g.observation.commands[1].argv.push("--include-seed");blocked(g);
});
test("zero exit, fresh CLI evidence and strict JSON required",()=>{
 const f=fixture(true);f.observation.commands[1].exitCode=1;blocked(f);
 const g=fixture(true);g.observation.commands[1].stdout="not-json";blocked(g);
 const h=fixture(true);h.observation.completedAt="2026-10-28T13:00:00.000Z";blocked(h);
 const i=fixture(true);i.observation.commands[1].stderr="Warning: changing vault";blocked(i);
});
test("dry-run false, extra migration, unexpected seed/role or unknown key blocked",()=>{
 const f=fixture(true);const v=JSON.parse(f.observation.commands[1].stdout);
 v.dryRun=false;f.observation.commands[1].stdout=JSON.stringify(v);blocked(f);
 const g=fixture(true);const w=JSON.parse(g.observation.commands[1].stdout);
 w.migrations.push("20261028091030_unsafe.sql");g.observation.commands[1].stdout=JSON.stringify(w);blocked(g);
 const h=fixture(true);const x=JSON.parse(h.observation.commands[1].stdout);
 x.roles.push("roles.sql");h.observation.commands[1].stdout=JSON.stringify(x);blocked(h);
 const i=fixture(true);const y=JSON.parse(i.observation.commands[1].stdout);
 y.unknown=true;i.observation.commands[1].stdout=JSON.stringify(y);blocked(i);
});
test("remote drift, missing rows, duplicate rows and malformed times blocked",()=>{
 const f=fixture(true);const x=JSON.parse(f.observation.commands[0].stdout);
 x.migrations[0].remote="";f.observation.commands[0].stdout=JSON.stringify(x);blocked(f);
 const g=fixture(true);const y=JSON.parse(g.observation.commands[0].stdout);
 y.migrations.push(y.migrations[4]);g.observation.commands[0].stdout=JSON.stringify(y);blocked(g);
 const h=fixture(true);const z=JSON.parse(h.observation.commands[0].stdout);
 z.migrations[0].time="not-time";h.observation.commands[0].stdout=JSON.stringify(z);blocked(h);
});
