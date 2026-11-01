// Offline, credential-safe serialization of actual CLI --db-url observations.
// This module DOES NOT connect to a provider, invoke CLI or grant authorization.
// The caller's URL/project assertions are not provider identity evidence.
import {PROJECT,REPO} from "./artales-migration-plan-core.mjs";
import {CLI_PIN,REDACTED_DB_URL,planCommands} from "./artales-migration-plan-v01-core.mjs";
const fail=reason=>{throw Error("artales_db_url_capture_blocked:"+reason);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(x,keys)=>x&&typeof x==="object"&&!Array.isArray(x)&&
  same(Object.keys(x).sort(),keys.slice().sort());
const ts=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const version=/^\d{14}$/;
const filename=/^\d{14}_[a-z0-9_]+\.sql$/;
function safeStdout(id,stdout){
 if(typeof stdout!=="string"||!stdout.length||stdout.length>65536)
  fail("invalid_stdout");
 let parsed;
 try{parsed=JSON.parse(stdout);}catch{fail("invalid_cli_json");}
 if(id==="migration-list"){
  if(!exact(parsed,["migrations","message"])||
     parsed.message!=="Migrations listed"||
     !Array.isArray(parsed.migrations)||parsed.migrations.length>200)
    fail("list_shape");
  for(const row of parsed.migrations){
   if(!exact(row,["local","remote","time"])||
      typeof row.local!=="string"||!version.test(row.local)||
      typeof row.remote!=="string"||
      (row.remote!==""&&!version.test(row.remote))||
      typeof row.time!=="string"||
      !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.time))
     fail("list_row_shape");
  }
 }else if(id==="db-push-dry-run"){
  if(!exact(parsed,["upToDate","dryRun","migrations","seeds","roles","message"])||
      typeof parsed.upToDate!=="boolean"||parsed.dryRun!==true||
      !Array.isArray(parsed.migrations)||parsed.migrations.length>1||
      !parsed.migrations.every(x=>typeof x==="string"&&filename.test(x))||
      !same(parsed.seeds,[])||!same(parsed.roles,[])||
      !["Finished supabase db push.","Remote database is up to date."].includes(parsed.message))
   fail("push_shape_or_write_capability");
 }else fail("invalid_command_id");
 return JSON.stringify(parsed);
}
// Only specifically observed, non-secret CLI 2.122.0 diagnostics are admissible.
// The "Would push" filename must match the already validated JSON payload.
function safeStderr(id,stderr,sanitizedStdout){
 if(typeof stderr!=="string"||stderr.length>1024)
  fail("stderr_invalid_type_or_length");
 const value=stderr.replace(/\r\n/g,"\n");
 const connecting="Connecting to remote database...";
 if(value===""||value===connecting||value===connecting+"\n")
  return value;
 if(id!=="db-push-dry-run")fail("unexpected_cli_stderr");
 const payload=JSON.parse(sanitizedStdout);
 const prefix="DRY RUN: migrations will *not* be pushed to the database.\n"+
  "Connecting to remote database...\n";
 if(payload.migrations.length===0&&value===prefix)return value;
 if(payload.migrations.length===1&&
    value===prefix+"Would push these migrations:\n • "+payload.migrations[0]+"\n")
  return value;
 fail("unexpected_dry_run_stderr");
}
export function buildRedactedDbUrlObservation({
  dbUrl,expectedRole,projectRef,repository,mainSha,cliVersion,
  completedAt,rawCommands
}={}){
 if(projectRef!==PROJECT||repository!==REPO||
   !/^[a-f0-9]{40}$/.test(mainSha||"")||
   cliVersion!==CLI_PIN||typeof completedAt!=="string"||
   !ts.test(completedAt)||!Number.isFinite(Date.parse(completedAt))||
   !["artales_prod_plan_ro","artales_plan_probe_ro"].includes(expectedRole)||
   typeof dbUrl!=="string"||dbUrl.length>2048||
   !Array.isArray(rawCommands)||rawCommands.length!==2)
  fail("invalid_capture_identity_or_arguments");
 let parsedUrl;
 try{parsedUrl=new URL(dbUrl);}catch{fail("invalid_db_url");}
 if(parsedUrl.protocol!=="postgresql:"||!parsedUrl.password||
   !parsedUrl.hostname||parsedUrl.hash||
   ![expectedRole,expectedRole+"."+PROJECT].includes(decodeURIComponent(parsedUrl.username)))
  fail("invalid_db_url_or_role");
 const expected=planCommands("db-url-redacted");
 const sanitized=expected.map((cmd,i)=>{
  const raw=rawCommands[i];
  const actualArgs=cmd.argv.map(a=>a===REDACTED_DB_URL?dbUrl:a);
  if(!exact(raw,["id","argv","exitCode","stdout","stderr"])||
    raw.id!==cmd.id||!same(raw.argv,actualArgs)||raw.exitCode!==0)
   fail("raw_command_or_status_mismatch:"+cmd.id);
  const stdout=safeStdout(raw.id,raw.stdout);
  const stderr=safeStderr(raw.id,raw.stderr,stdout);
  return {id:cmd.id,argv:[...cmd.argv],exitCode:0,stdout,stderr};
 });
 return Object.freeze({
  schema:"artales-cli-plan-observation/v0.2",
  source:"operator-attested-cli-json",
  transport:"db-url-redacted",projectRef:PROJECT,repository:REPO,
  mainSha,cliVersion:CLI_PIN,completedAt,commands:sanitized
 });
}
