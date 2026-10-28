#!/usr/bin/env node
// Offline-only plan inspection: never calls Supabase CLI, the network or a DB.
import {readFileSync} from "node:fs";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {admission,inventoryFromDirectory} from "./artales-migration-plan-core.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const args=process.argv.slice(2);
if(args.length!==2){
 console.error("Usage: node scripts/artales-migration-preflight.mjs <readback.json> <request.json>");
 process.exit(2);
}
try{
 const [readback,request]=args.map(f=>JSON.parse(readFileSync(resolve(f),"utf8")));
 const checkoutSha=execFileSync("git",["rev-parse","HEAD"],{
  cwd:root,encoding:"utf8",timeout:3000,stdio:["ignore","pipe","ignore"]}).trim();
 const plan=admission({inventory:inventoryFromDirectory(join(root,"supabase","migrations")),
  readback,request,checkoutSha,nowISO:new Date().toISOString()});
 process.stdout.write(JSON.stringify(plan,null,2)+"\n");
}catch(err){
 console.error(String(err?.message||err));
 process.exitCode=1;
}
