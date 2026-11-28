// Prepare one exact pending migration for the existing native CLI. No DB access.
// Applied history is represented by non-executable guards, never replayed.
import {createHash} from "node:crypto";
import {mkdirSync,readFileSync,writeFileSync,existsSync} from "node:fs";
import {join,resolve,sep} from "node:path";
import {inventoryFromDirectory,PROJECT,REPO} from "./artales-migration-plan-core.mjs";
import {LEGACY_SOURCE_CUTOFF,verifyCheckpoint,verifyLedgerRows,ledgerFingerprint,assertLedgerSourceMatch} from "./artales-migration-history.mjs";
const fail=reason=>{throw Error("artales_stage_blocked:"+reason);};
const hex=(s,n)=>typeof s==="string"&&new RegExp("^[a-f0-9]{"+n+"}$").test(s);
const hash=b=>createHash("sha256").update(b).digest("hex");
export function prepareOneMigrationStage({
 sourceMigrationsDir,stageRoot,sourceSha,sourceRef="refs/heads/main",
 projectRef,repository,applied,selectedFilename="",selectedSha256="",mode="one-migration"
}={}){
 if(projectRef!==PROJECT||repository!==REPO||sourceRef!=="refs/heads/main"||
    !hex(sourceSha,40)||!["baseline","one-migration"].includes(mode)||
    (mode==="baseline"&&(selectedFilename||selectedSha256))||
    (mode==="one-migration"&&(!hex(selectedSha256,64)||! /^[0-9]{14}_[a-z0-9_]+\.sql$/.test(selectedFilename))))
  fail("invalid_source_or_selected_identity");
 if(typeof sourceMigrationsDir!=="string"||!sourceMigrationsDir||
    typeof stageRoot!=="string"||!stageRoot)fail("missing_directories");
 const sourceDir=resolve(sourceMigrationsDir),destination=resolve(stageRoot);
 const root=resolve(sourceDir,"../..");
 if(destination===root||destination.startsWith(root+sep)||existsSync(destination))
  fail("stage_destination_not_isolated_and_empty");
 const source=inventoryFromDirectory(sourceDir);
 const checkpoint=verifyCheckpoint(sourceDir,source);
 const ledger=verifyLedgerRows(applied);
 if(ledger.length<checkpoint.rows.length||
    ledgerFingerprint(ledger.slice(0,checkpoint.rows.length))!==ledgerFingerprint(checkpoint.rows))
  fail("historical_provider_checkpoint_drift");
 const future=source.filter(r=>r.version>LEGACY_SOURCE_CUTOFF);
 const seenNames=new Set(checkpoint.rows.map(r=>r.name));
 for(const r of future){
  if(seenNames.has(r.name))fail("duplicate_historical_migration_name");
  seenNames.add(r.name);
 }
 const later=ledger.slice(checkpoint.rows.length);
 if(later.length>future.length)fail("unknown_provider_history");
 for(const [i,row] of later.entries()){
  const file=future[i];
  if(row.version!==file.version||row.name!==file.name)fail("unknown_provider_or_skipped_history");
  const body=readFileSync(join(sourceDir,file.filename));
  if(hash(body)!==file.sha256)fail("source_changed_while_staging");
  assertLedgerSourceMatch(row,body.toString("utf8"));
 }
 const pending=future.slice(later.length);
 if(mode==="baseline"&&pending.length)fail("baseline_has_pending");
 const selected=mode==="baseline"?null:pending[0];
 if(mode==="one-migration"&&(!selected||selected.filename!==selectedFilename||selected.sha256!==selectedSha256))
  fail("not_exact_first_pending_migration");
 const deferred=pending.slice(selected?1:0).map(({version,filename,sha256})=>({version,filename,sha256}));
 const staged=join(destination,"supabase","migrations");
 mkdirSync(staged,{recursive:true,mode:0o700});
 writeFileSync(join(destination,"supabase","config.toml"),
  'project_id = "artales_one_migration_stage"\n',{flag:"wx",mode:0o400});
 // If a concurrent actor removes a history record, this file MUST fail rather
 // than replaying old SQL or silently re-registering an applied version.
 const guard="DO $$ BEGIN RAISE EXCEPTION 'ARTales historical migration must never be replayed'; END $$;\n";
 for(const row of ledger)writeFileSync(join(staged,row.version+"_"+row.name+".sql"),guard,{flag:"wx",mode:0o400});
 if(selected){
  const body=readFileSync(join(sourceDir,selected.filename));
  if(hash(body)!==selected.sha256)fail("source_changed_while_staging");
  const dest=join(staged,selected.filename);
  writeFileSync(dest,body,{flag:"wx",mode:0o400});
  if(hash(readFileSync(dest))!==selected.sha256)fail("staged_copy_sha256_mismatch");
 }
 const inventory=inventoryFromDirectory(staged).map((r,i)=>i<ledger.length?
  {...r,verifiedLedger:{statementCount:ledger[i].statementCount,ledgerSha256:ledger[i].ledgerSha256}}:r);
 if(inventory.length!==ledger.length+(selected?1:0))fail("stage_history_count_mismatch");
 return Object.freeze({stageRoot:destination,inventory,receipt:Object.freeze({
  schema:"artales-one-migration-stage/v1",projectRef:PROJECT,repository:REPO,sourceRef,sourceSha,
  sourceIdentityClass:"caller-attested-must-verify-pinned-main",sourceMigrationCount:source.length,
  appliedCount:ledger.length,historyDigest:ledgerFingerprint(ledger),checkpointDigest:checkpoint.digest,
  selected:selected?{version:selected.version,filename:selected.filename,sha256:selected.sha256}:null,
  deferred,stagedFilenames:inventory.map(r=>r.filename),productionPlanVerified:false,
  protectedOperatorVerified:false,productionApplyAuthorized:false,mayApply:false
 })});
}
