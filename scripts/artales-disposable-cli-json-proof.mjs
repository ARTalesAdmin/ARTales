// Supabase CLI real output-shape probe against disposable localhost PostgreSQL 17.
// No production project, credentials, logins, linking, APPLY or migration repair.
import {spawnSync} from "node:child_process";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {CLI_PIN} from "./artales-migration-plan-v01-core.mjs";

const DISPOSABLE_URL="postgresql://postgres:isolated-only@127.0.0.1:5432/cli_contract?sslmode=disable";
const FILENAME="20261028190000_artales_disposable_json_probe.sql";
export function disposableCommands(){
 return [
  ["migration","list","--db-url",DISPOSABLE_URL,"--output-format","json"],
  ["db","push","--db-url",DISPOSABLE_URL,"--dry-run","--skip-vault","--output-format","json"]
 ];
}
export function verifyDisposableCommands(commands){
 if(!Array.isArray(commands)||commands.length!==2)throw Error("missing_disposable_command");
 for(const [i,command] of commands.entries()){
  if(!Array.isArray(command)||command.length<5||
     command[0]!==["migration","db"][i]||
     command[1]!==["list","push"][i]||
     command[2]!=="--db-url"||command[3]!==DISPOSABLE_URL||
     !command.includes("--output-format")||
     command.at(-1)!=="json"||command.includes("--linked")||
     command.includes("--project-ref"))
   throw Error("disposable_command_identity");
 }
 if(commands[0].includes("--dry-run")||!commands[1].includes("--dry-run")||
    !commands[1].includes("--skip-vault"))
  throw Error("disposable_write_protection");
 return true;
}
function run(command,cwd){
 const p=spawnSync("npm",["exec","--yes","--package=supabase@"+CLI_PIN,
  "--","supabase",...command],{
  cwd,encoding:"utf8",timeout:135000,maxBuffer:262144,
  env:{PATH:process.env.PATH||"",HOME:process.env.HOME||"",
   CI:"true",NPM_CONFIG_FUND:"false",NPM_CONFIG_UPDATE_NOTIFIER:"false"}
 });
 const stdout=p.stdout||"",stderr=p.stderr||"";
 if(p.error||p.status!==0)throw Error("disposable_cli_error:"+
  (p.error?.message||p.status)+":"+stderr.replaceAll(DISPOSABLE_URL,"[DISPOSABLE_URL]").slice(0,850));
 try{return {parsed:JSON.parse(stdout),stdout,stderr};}
 catch{throw Error("disposable_cli_stdout_not_json:"+
  stdout.replaceAll(DISPOSABLE_URL,"[DISPOSABLE_URL]").slice(0,800)+
  ":stderr="+stderr.replaceAll(DISPOSABLE_URL,"[DISPOSABLE_URL]").slice(0,300));}
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
 const root=mkdtempSync(join(tmpdir(),"artales-cli-json-"));
 try{
  const commands=disposableCommands();
  verifyDisposableCommands(commands);
  const supa=join(root,"supabase");
  mkdirSync(join(supa,"migrations"),{recursive:true});
  writeFileSync(join(supa,"config.toml"),'project_id = "artales_disposable_contract"\n');
  writeFileSync(join(supa,"migrations",FILENAME),"select 1;\n");
  const list=run(commands[0],root),dry=run(commands[1],root);
  const output={schema:"artales-disposable-cli-json-observation/v0",
   cliPin:CLI_PIN,provider:"localhost-disposable-pg17-only",filename:FILENAME,
   listType:Array.isArray(list.parsed)?"array":typeof list.parsed,
   listJson:list.parsed,
   dryRunType:Array.isArray(dry.parsed)?"array":typeof dry.parsed,
   dryRunJson:dry.parsed,
   mayApply:false,productionReadback:false};
  const sanitized=JSON.stringify(output,null,2).replaceAll(DISPOSABLE_URL,"[DISPOSABLE_URL]");
  process.stdout.write(sanitized.slice(0,14000)+"\n");
 }catch(error){
  console.error("ARTales disposable CLI JSON proof blocked: "+String(error?.message||error));
  process.exitCode=1;
 }finally{
  rmSync(root,{recursive:true,force:true});
 }
}