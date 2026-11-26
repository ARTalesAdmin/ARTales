import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync,cpSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {createHash} from "node:crypto";
import {prepareOneMigrationStage} from "../scripts/artales-production-one-migration-stage.mjs";
import {assertLedgerSourceMatch,verifyCheckpoint,CHECKPOINT_PATH} from "../scripts/artales-migration-history.mjs";
import {inventoryFromDirectory,admission} from "../scripts/artales-migration-plan-core.mjs";
const digest=s=>createHash("sha256").update(s).digest("hex");
const historical=JSON.parse(readFileSync(CHECKPOINT_PATH,"utf8"));
const first="20261126125926_fixture_first.sql",second="20261126131030_fixture_second.sql";
const sql="-- comments ; retained\nselect 'a;b';\nDO $$ BEGIN PERFORM 1; END $$;\n";
function fixture(){
 const root=mkdtempSync(join(tmpdir(),"artales-stage-test-"));
 const repo=join(root,"repo"),src=join(repo,"supabase","migrations"),out=join(root,"stage");
 mkdirSync(src,{recursive:true});mkdirSync(join(repo,"supabase","history"),{recursive:true});
 cpSync("supabase/migrations",src,{recursive:true});cpSync("ops/sql",join(repo,"ops","sql"),{recursive:true});
 writeFileSync(join(repo,CHECKPOINT_PATH),JSON.stringify(historical));
 writeFileSync(join(src,first),sql);writeFileSync(join(src,second),"select 2;\n");
 const applied=historical.ledger.map(({version,name,statementCount,ledgerSha256})=>({version,name,statementCount,ledgerSha256,statements:null}));
 const args={sourceMigrationsDir:src,stageRoot:out,sourceSha:"a".repeat(40),
  projectRef:historical.projectRef,repository:historical.repository,applied,
  selectedFilename:first,selectedSha256:digest(sql)};
 return {root,src,out,args,repo};
}
function withFixture(fn){const f=fixture();try{fn(f);}finally{rmSync(f.root,{recursive:true,force:true});}}
function run(f){return prepareOneMigrationStage(f.args);}
const fragments=["-- comments ; retained\nselect 'a;b'","DO $$ BEGIN PERFORM 1; END $$"];
const nextRow=(statements=fragments)=>({version:first.slice(0,14),name:"fixture_first",statementCount:statements.length,ledgerSha256:digest(JSON.stringify(statements)),statements});
test("validates real historical source blobs and stages only first pending with non-executable history",()=>withFixture(f=>{
 const s=run(f);assert.equal(s.receipt.appliedCount,31);
 assert.equal(s.receipt.deferred.length,1);assert.equal(s.receipt.mayApply,false);
 assert.equal(s.inventory.length,32);
 const dir=join(f.out,"supabase","migrations");
 assert.equal(readdirSync(dir).length,32);
 assert.match(readFileSync(join(dir,"20260926142755_remote_schema.sql"),"utf8"),/RAISE EXCEPTION/);
 assert.equal(readFileSync(join(dir,first),"utf8"),sql);
 assert.equal(readdirSync(f.src).length,27);
 const result=admission({inventory:s.inventory,readback:{schema:"artales-migration-readback/v1",source:"operator-attested-provider-readback",projectRef:f.args.projectRef,observedAt:"2026-11-26T12:00:00Z",migrations:f.args.applied},request:{schema:"artales-migration-request/v0",projectRef:f.args.projectRef,repository:f.args.repository,ref:"refs/heads/main",headSha:f.args.sourceSha,expectedPending:[{filename:first,sha256:digest(sql)}]},checkoutSha:f.args.sourceSha,nowISO:"2026-11-26T12:01:00Z"});
 assert.equal(result.historyDigest,s.receipt.historyDigest);assert.equal(result.mayApply,false);
}));
test("blocks missing, extra, altered, skipped history, source changes and wrong selections",()=>{
 for(const change of [
  f=>f.args.applied.pop(), f=>f.args.applied[3].ledgerSha256="0".repeat(64),
  f=>f.args.applied[3].statementCount++,f=>f.args.applied.reverse(),
  f=>f.args.applied.push({...nextRow(),version:second.slice(0,14),name:"fixture_second"}),
  f=>writeFileSync(join(f.src,"20261101000000_retro.sql"),"select 3;"),
  f=>writeFileSync(join(f.src,"20261023063248_prescreen_shadow_library_v1.sql"),"select 3;"),
  f=>{f.args.selectedFilename=second;f.args.selectedSha256=digest("select 2;\n");},
  f=>f.args.selectedSha256="0".repeat(64),f=>f.args.projectRef="other",
  f=>mkdirSync(f.out), f=>f.args.stageRoot=join(f.repo,"stage")
 ])withFixture(f=>{change(f);assert.throws(()=>run(f),/artales_stage_blocked/);});
});
test("previously applied new SQL is checked in full and cannot be selected again",()=>withFixture(f=>{
 f.args.applied.push(nextRow());
 f.args.selectedFilename=second;f.args.selectedSha256=digest("select 2;\n");
 const s=run(f);assert.equal(s.receipt.appliedCount,32);assert.equal(s.receipt.deferred.length,0);
 assert.match(readFileSync(join(f.out,"supabase","migrations",first),"utf8"),/RAISE EXCEPTION/);
}));
test("full statement content is not confused with first-statement checksum",()=>{
 assert.equal(assertLedgerSourceMatch(nextRow(),sql),true);
 for(const bad of [[fragments[0]],[fragments[0],"DO $$ BEGIN PERFORM 2; END $$"],fragments.slice().reverse()]){
  assert.throws(()=>assertLedgerSourceMatch(nextRow(bad),sql),/artales_stage_blocked/);
 }
 assert.throws(()=>assertLedgerSourceMatch(nextRow(),sql+"select 4;"),/artales_stage_blocked/);
});
test("actual checkpoint validates all frozen source identities",()=>{
 const source=inventoryFromDirectory(resolve("supabase/migrations"));
 const c=verifyCheckpoint(resolve("supabase/migrations"),source);
 assert.equal(c.rows.length,31);
});
