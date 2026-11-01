import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {prepareOneMigrationStage} from "../scripts/artales-production-one-migration-stage.mjs";
const digest=s=>createHash("sha256").update(s).digest("hex");
function fixture(){
 const root=mkdtempSync(join(tmpdir(),"artales-stage-test-"));
 const src=join(root,"source"),out=join(root,"output");
 mkdirSync(src,{recursive:true});
 const history=[
  ["20260926142755","remote_schema"],["20261023063248","prescreen_shadow_library_v1"],
  ["20261024073928","candidate_intake_ab"],["20261025095658","legal_screen_v1"],
  ["20261027081945","snapshot389_storage_admin_rls"]
 ];
 const future=[["20261028091029","artales_identity_role_authority_v1"],
  ["20261028110000","artales_snapshot_general_v1"],
  ["20261028111000","artales_snapshot389_register"]];
 for(const [v,n] of [...history,...future])writeFileSync(join(src,v+"_"+n+".sql"),"select '"+v+"';\n");
 const selected=future[0].join("_")+".sql";
 const args={sourceMigrationsDir:src,stageRoot:out,sourceSha:"a".repeat(40),
  projectRef:"nmhdwmszbwgrgfbmlguu",repository:"ARTalesAdmin/ARTales",
  applied:history.map(([version,name])=>({version,name})),
  selectedFilename:selected,selectedSha256:digest(readFileSync(join(src,selected)))};
 return {root,src,out,args,selected};
}
function run(f){return prepareOneMigrationStage(f.args);}
test("stages applied history and only first pending, leaving source untouched",()=>{
 const f=fixture();try{
 const x=run(f);
 assert.equal(x.receipt.deferred.length,2);
 assert.equal(x.receipt.stagedFilenames.length,6);
 assert.equal(x.receipt.mayApply,false);
 assert.equal(readdirSync(join(f.out,"supabase","migrations")).length,6);
 assert.equal(readdirSync(f.src).length,8);
 assert.equal(digest(readFileSync(join(f.out,"supabase","migrations",f.selected))),f.args.selectedSha256);
 }finally{rmSync(f.root,{recursive:true,force:true});}
});
test("blocks skipping pending migration, digest mismatch and alternate project",()=>{
 for(const update of [
  a=>{a.selectedFilename="20261028110000_artales_snapshot_general_v1.sql";a.selectedSha256="f".repeat(64);},
  a=>{a.selectedSha256="0".repeat(64);},
  a=>{a.projectRef="other";},
  a=>{a.applied.reverse();},
  a=>{a.applied[0].version="20261028091029";}
 ]){
  const f=fixture();try{update(f.args);assert.throws(()=>run(f),/artales_stage_blocked/);}
  finally{rmSync(f.root,{recursive:true,force:true});}
 }
});
test("does not overwrite pre-existing stage",()=>{
 const f=fixture();try{mkdirSync(f.out);assert.throws(()=>run(f),/stage_destination/);}
 finally{rmSync(f.root,{recursive:true,force:true});}
});
