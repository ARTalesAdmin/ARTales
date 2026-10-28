#!/usr/bin/env node
// Read local files + local Git only. This NEVER runs Supabase CLI.
import {readFileSync} from "node:fs";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {inventoryFromDirectory} from "./artales-migration-plan-core.mjs";
import {planCommands,verifyPlanV01} from "./artales-migration-plan-v01-core.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const files=process.argv.slice(2);
if(files.length===1&&files[0]==="--print-readonly-commands"){
 console.log(JSON.stringify({schema:"artales-plan-commands/v0.1",
  approvedForExecution:false,requiresIndependentOperatorApproval:true,
  cliPin:"2.122.0",commands:planCommands()},null,2));
 process.exit(0);
}
if(files.length!==3){
 console.error("Usage: node scripts/artales-migration-plan-v01.mjs ledger.json request.json cli-observation.json");
 process.exit(2);
}
try{
 const [readback,request,observation]=files.map(f=>JSON.parse(readFileSync(resolve(f),"utf8")));
 const mainSha=execFileSync("git",["rev-parse","HEAD"],{
  cwd:root,encoding:"utf8",timeout:3000,stdio:["ignore","pipe","ignore"]}).trim();
 const branch=execFileSync("git",["branch","--show-current"],{
  cwd:root,encoding:"utf8",timeout:3000,stdio:["ignore","pipe","ignore"]}).trim();
 if(branch!=="main")throw Error("not_main_checkout");
 const status=execFileSync("git",["status","--porcelain"],{
  cwd:root,encoding:"utf8",timeout:3000,stdio:["ignore","pipe","ignore"]}).trim();
 if(status)throw Error("dirty_checkout");
 const result=verifyPlanV01({inventory:inventoryFromDirectory(join(root,"supabase","migrations")),
  readback,request,checkoutSha:mainSha,observation,nowISO:new Date().toISOString()});
 process.stdout.write(JSON.stringify(result,null,2)+"\n");
}catch(e){
 console.error("ARTales PLAN v0.1 blocked: "+String(e?.message||e));
 process.exitCode=1;
}
