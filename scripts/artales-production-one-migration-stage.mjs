// Prepare a ONE-migration CLI source view without changing Git, provider state or credentials.
// This is only a file-staging helper. It grants neither PLAN operator access nor APPLY.
import {createHash} from "node:crypto";
import {mkdirSync,readFileSync,writeFileSync,existsSync} from "node:fs";
import {join,resolve,sep} from "node:path";
import {inventoryFromDirectory,PROJECT,REPO} from "./artales-migration-plan-core.mjs";

const fail=reason=>{throw Error("artales_stage_blocked:"+reason);};
const hex=(value,length)=>typeof value==="string"&&
 new RegExp("^[a-f0-9]{"+length+"}$").test(value);
const hash=buffer=>createHash("sha256").update(buffer).digest("hex");

export function prepareOneMigrationStage({
 sourceMigrationsDir,stageRoot,sourceSha,sourceRef="refs/heads/main",
 projectRef,repository,applied,selectedFilename,selectedSha256
}={}){
 if(projectRef!==PROJECT||repository!==REPO||sourceRef!=="refs/heads/main"||
    !hex(sourceSha,40)||!hex(selectedSha256,64)||
    typeof selectedFilename!=="string"||
    !/^[0-9]{14}_[a-z0-9_]+\.sql$/.test(selectedFilename))
  fail("invalid_source_or_selected_identity");
 if(typeof sourceMigrationsDir!=="string"||!sourceMigrationsDir||
    typeof stageRoot!=="string"||!stageRoot)
  fail("missing_directories");
 const sourceDir=resolve(sourceMigrationsDir),destination=resolve(stageRoot);
 if(destination===sourceDir||destination.startsWith(sourceDir+sep)||
    existsSync(destination))
  fail("stage_destination_not_isolated_and_empty");
 // Reuse canonical migration inventory/hash validation. No parallel validator.
 const source=inventoryFromDirectory(sourceDir);
 const lookup=new Map(source.map(item=>[item.version,item]));
 if(!Array.isArray(applied)||applied.length<5||applied.length>source.length)
  fail("invalid_provider_history");
 const seen=new Set();let previous="";
 for(const row of applied){
  if(!row||typeof row.version!=="string"||!/^([0-9]{14})$/.test(row.version)||
     typeof row.name!=="string"||row.version<=previous||seen.has(row.version))
   fail("provider_order_or_duplicate");
  previous=row.version;seen.add(row.version);
  const local=lookup.get(row.version);
  if(!local||local.name!==row.name)fail("unknown_provider_history");
 }
 if(!seen.has("20260926142755"))fail("baseline_not_applied");
 const pending=source.filter(row=>!seen.has(row.version));
 if(!pending.length)fail("no_pending_migration");
 if(pending.some(row=>row.version<=previous))fail("retroactive_pending");
 const selected=pending[0];
 if(selected.filename!==selectedFilename||selected.sha256!==selectedSha256)
  fail("not_exact_first_pending_migration");
 const staged=source.filter(row=>seen.has(row.version)||row.version===selected.version);
 if(staged.length!==applied.length+1)fail("stage_history_count_mismatch");
 const deferred=pending.slice(1).map(row=>({
  version:row.version,filename:row.filename,sha256:row.sha256
 }));
 // Stage is a NEW temporary directory; no mutation of the checkout or SQL source.
 mkdirSync(join(destination,"supabase","migrations"),{recursive:true,mode:0o700});
 writeFileSync(join(destination,"supabase","config.toml"),
  'project_id = "artales_one_migration_stage"\n',{flag:"wx",mode:0o400});
 for(const item of staged){
  const body=readFileSync(join(sourceDir,item.filename));
  if(hash(body)!==item.sha256)fail("source_changed_while_staging");
  const target=join(destination,"supabase","migrations",item.filename);
  writeFileSync(target,body,{flag:"wx",mode:0o400});
  if(hash(readFileSync(target))!==item.sha256)
   fail("staged_copy_sha256_mismatch");
 }
 return Object.freeze({
  stageRoot:destination,
  receipt:Object.freeze({
   schema:"artales-one-migration-stage/v0",
   projectRef:PROJECT,repository:REPO,sourceRef,sourceSha,
   sourceIdentityClass:"caller-attested-must-verify-pinned-main",
   sourceMigrationCount:source.length,
   appliedCount:applied.length,
   selected:{version:selected.version,filename:selected.filename,sha256:selected.sha256},
   deferred,
   stagedFilenames:staged.map(row=>row.filename),
   productionPlanVerified:false,
   protectedOperatorVerified:false,
   productionApplyAuthorized:false,
   mayApply:false
  })
 });
}
