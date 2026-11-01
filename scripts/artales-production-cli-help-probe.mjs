// Only runs pinned Supabase CLI --version / --help. No auth or provider operations.
// This checks observed flags against existing ARTales PLAN v0.1 contract.
import {spawnSync} from "node:child_process";
import {CLI_PIN,planCommands} from "./artales-migration-plan-v01-core.mjs";

export function compareHelpToPlan({version,migrationListHelp,dbPushHelp}) {
 const expected=planCommands();
 const actualVersion=String(version).trim();
 const results=expected.map((command,index)=>{
  const help=String(index===0?migrationListHelp:dbPushHelp);
  const requested=[...new Set(command.argv.filter(arg=>arg.startsWith("--")))];
  return {command:command.id,expectedFlags:requested,
   missingFlags:requested.filter(flag=>!help.includes(flag)),
   helpAvailable:help.trim().length>150};
 });
 return {cliPin:CLI_PIN,actualVersion,commandChecks:results,
  compatible:actualVersion===CLI_PIN&&results.every(r=>r.helpAvailable&&r.missingFlags.length===0)};
}
function probe(args) {
 // Only the explicit fixed list below is ever passed to npm.
 const result=spawnSync("npm",["exec","--yes","--package=supabase@"+CLI_PIN,
  "--","supabase",...args],{
  encoding:"utf8",timeout:135000,maxBuffer:262144,
  env:{PATH:process.env.PATH||"",HOME:process.env.HOME||"",
   CI:"true",NPM_CONFIG_FUND:"false",NPM_CONFIG_UPDATE_NOTIFIER:"false"}
 });
 if(result.error||result.status!==0)throw Error("pinned_cli_help_failed:"+
  args.join("_")+":"+(result.error?.message||result.status)+
  ":"+String(result.stderr||"").slice(0,350));
 return result.stdout;
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
 try{
  const version=probe(["--version"]);
  const migrationListHelp=probe(["migration","list","--help"]);
  const dbPushHelp=probe(["db","push","--help"]);
  const report=compareHelpToPlan({version,migrationListHelp,dbPushHelp});
  process.stdout.write(JSON.stringify(report,null,2)+"\n");
  if(!report.compatible){
   process.stdout.write("=== migration list --help ===\n"+migrationListHelp.slice(0,11000)+"\n");
   process.stdout.write("=== db push --help ===\n"+dbPushHelp.slice(0,11000)+"\n");
   process.exitCode=1;
  }
 }catch(err){
  console.error("ARTales CLI HELP blocked: "+String(err?.message||err));
  process.exitCode=1;
 }
}