#!/usr/bin/env node
// Offline PLAN receipt formatter; accepts sanitized JSON files only.
// It NEVER invokes Supabase CLI, psql, any provider connector or network.
import {readFileSync} from "node:fs";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {inventoryFromDirectory} from "./artales-migration-plan-core.mjs";
import {verifyPlanForHumanReview} from "./artales-production-plan-review.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const files=process.argv.slice(2);
if(files.length!==4){
 console.error("Usage: node scripts/artales-production-plan-review-cli.mjs readback.json request.json cli-observation.json envelope.json");
 process.exit(2);
}
try{
 const branch=execFileSync("git",["branch","--show-current"],{
  cwd:root,encoding:"utf8",timeout:3000,stdio:["ignore","pipe","ignore"]}).trim();
 const checkoutSha=execFileSync("git",["rev-parse","HEAD"],{
  cwd:root,encoding:"utf8",timeout:3000,stdio:["ignore","pipe","ignore"]}).trim();
 const dirty=execFileSync("git",["status","--porcelain"],{
  cwd:root,encoding:"utf8",timeout:3000,stdio:["ignore","pipe","ignore"]}).trim();
 if(branch!=="main"||dirty)throw Error("main_clean_checkout_required");
 const [readback,request,observation,envelope]=files.map(f=>
  JSON.parse(readFileSync(resolve(f),"utf8")));
 const receipt=verifyPlanForHumanReview({
  inventory:inventoryFromDirectory(join(root,"supabase","migrations")),
  readback,request,observation,envelope,checkoutSha,nowISO:new Date().toISOString()
 });
 process.stdout.write(JSON.stringify(receipt,null,2)+"\n");
}catch(error){
 console.error("ARTales PLAN review blocked: "+String(error?.message||error));
 process.exitCode=1;
}
