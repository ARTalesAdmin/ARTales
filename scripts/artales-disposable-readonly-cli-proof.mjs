// Real Supabase CLI --db-url dry-run against disposable PG17 with a SQL read-only login.
// Production credentials, linked project, APPLY and provider login are not supported.
import {spawnSync} from "node:child_process";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {CLI_PIN} from "./artales-migration-plan-v01-core.mjs";
const ADMIN_URL="postgresql://postgres@127.0.0.1:5432/cli_contract?sslmode=disable";
const ROLE="artales_plan_probe_ro";
const USER_URL="postgresql://"+ROLE+":disposable-readonly-only@127.0.0.1:5432/cli_contract?sslmode=disable";
const MIGRATION="20261028190000_artales_disposable_ro_probe.sql";
const fail=s=>{throw Error("disposable_readonly_proof_blocked:"+s);};
const scrub=s=>String(s||"").replaceAll(USER_URL,"[LOCAL_RO_URI]")
 .replaceAll(ADMIN_URL,"[LOCAL_ADMIN_URI]").replaceAll("disposable-readonly-only","[LOCAL_PASS]")
 .replaceAll("isolated-only","[LOCAL_PASS]");
export function readonlyProbeCommands(){
 return [
  ["migration","list","--db-url",USER_URL,"--output-format","json"],
  ["db","push","--db-url",USER_URL,"--dry-run","--skip-vault","--output-format","json"]
 ];
}
export function assertReadonlyProbeCommands(commands){
 if(JSON.stringify(commands)!==JSON.stringify(readonlyProbeCommands())||
    !Array.isArray(commands)||commands.some(c=>c.includes("--linked")||c.includes("--include-all")))
  fail("command_not_exact_local_readonly_dryrun");
 return true;
}
export function validateReadonlyRoleProof(proof){
 if(!proof||proof.user!==ROLE||proof.readOnlySession!=="on"||
  proof.migrationCount!==0||proof.canInsert!==false||proof.canUpdate!==false||
  proof.canDelete!==false||proof.canTruncate!==false||
  proof.canCreateSchema!==false||proof.canCreateMigrationObjects!==false||
  proof.isSuperuser!==false||proof.canCreateRole!==false)
  fail("role_write_privilege_or_identity_drift");
 return true;
}
function execute(binary,args,{cwd,env={},allowFailure=false}={}){
 const p=spawnSync(binary,args,{cwd,encoding:"utf8",timeout:150000,maxBuffer:131072,
  env:{PATH:process.env.PATH||"",HOME:process.env.HOME||"",CI:"true",
   NPM_CONFIG_FUND:"false",NPM_CONFIG_UPDATE_NOTIFIER:"false",...env}});
 if(p.error)fail("command_error:"+binary+":"+scrub(p.error.message));
 if(!allowFailure&&p.status!==0)
  fail("command_failed:"+binary+":"+p.status+":"+scrub(p.stderr).slice(0,400));
 return {status:p.status,stdout:p.stdout||"",stderr:p.stderr||""};
}
function psql(sql,{readonly=false,allowFailure=false}={}){
 return execute("psql",["-X","-v","ON_ERROR_STOP=1","-t","-A","--dbname",
  readonly?USER_URL:ADMIN_URL,"-c",sql],
  {env:{PGPASSWORD:readonly?"disposable-readonly-only":"isolated-only"},allowFailure});
}
function cli(args,cwd){
 return execute("npm",["exec","--yes","--package=supabase@"+CLI_PIN,
  "--","supabase",...args],{cwd});
}
function main(){
 if(process.env.GITHUB_ACTIONS!=="true"||process.env.ARTALES_LOCAL_PG17_ONLY!=="1"||
    process.env.ARTALES_PRODUCTION_PLAN_OPERATOR||process.env.SUPABASE_ACCESS_TOKEN||
    process.env.SUPABASE_DB_PASSWORD||process.env.DATABASE_URL)
  fail("missing_explicit_disposable_ci_boundary");
 const root=mkdtempSync(join(tmpdir(),"artales-pg17-ro-proof-"));
 try{
  const commands=readonlyProbeCommands();assertReadonlyProbeCommands(commands);
  psql([
   "CREATE SCHEMA IF NOT EXISTS supabase_migrations;",
   "CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (",
   " version text PRIMARY KEY, statements text[], name text);",
   "CREATE ROLE "+ROLE+" LOGIN PASSWORD 'disposable-readonly-only'",
   " NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;",
   "ALTER ROLE "+ROLE+" SET default_transaction_read_only = on;",
   "REVOKE ALL ON SCHEMA supabase_migrations FROM PUBLIC;",
   "GRANT USAGE ON SCHEMA supabase_migrations TO "+ROLE+";",
   "GRANT SELECT ON supabase_migrations.schema_migrations TO "+ROLE+";"
  ].join("\n"));
  const roleSQL=[
   "SELECT json_build_object(",
   " 'user',current_user,",
   " 'readOnlySession',current_setting('default_transaction_read_only'),",
   " 'migrationCount',(SELECT count(*) FROM supabase_migrations.schema_migrations),",
   " 'canInsert',has_table_privilege(current_user,'supabase_migrations.schema_migrations','INSERT'),",
   " 'canUpdate',has_table_privilege(current_user,'supabase_migrations.schema_migrations','UPDATE'),",
   " 'canDelete',has_table_privilege(current_user,'supabase_migrations.schema_migrations','DELETE'),",
   " 'canTruncate',has_table_privilege(current_user,'supabase_migrations.schema_migrations','TRUNCATE'),",
   " 'canCreateSchema',has_database_privilege(current_user,current_database(),'CREATE'),",
   " 'canCreateMigrationObjects',has_schema_privilege(current_user,'supabase_migrations','CREATE'),",
   " 'isSuperuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),",
   " 'canCreateRole',(SELECT rolcreaterole FROM pg_roles WHERE rolname=current_user))"
  ].join("\n");
  const before=JSON.parse(psql(roleSQL,{readonly:true}).stdout.trim());
  validateReadonlyRoleProof(before);
  const denied=psql("INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('20990101000000','forbidden')",
   {readonly:true,allowFailure:true});
  if(denied.status===0)fail("readonly_role_performed_write");
  const supa=join(root,"supabase");mkdirSync(join(supa,"migrations"),{recursive:true});
  writeFileSync(join(supa,"config.toml"),'project_id = "artales_disposable_ro_contract"\n');
  writeFileSync(join(supa,"migrations",MIGRATION),"select 1;\n");
  const list=cli(commands[0],root),dry=cli(commands[1],root);
  const listJson=JSON.parse(list.stdout),dryJson=JSON.parse(dry.stdout);
  if(dryJson.dryRun!==true||dryJson.upToDate!==false||
    JSON.stringify(dryJson.migrations)!==JSON.stringify([MIGRATION])||
    !Array.isArray(listJson.migrations)||listJson.migrations.length!==1)
    fail("cli_json_contract_drift");
  const after=JSON.parse(psql(roleSQL,{readonly:true}).stdout.trim());
  validateReadonlyRoleProof(after);
  const final=psql("SELECT count(*) FROM supabase_migrations.schema_migrations",{readonly:true}).stdout.trim();
  if(final!=="0")fail("migration_history_was_mutated");
  console.log(JSON.stringify({
   schema:"artales-disposable-readonly-cli-proof/v0",
   provider:"localhost-disposable-pg17-only",cliVersion:CLI_PIN,
   role:ROLE,grantReadOnlyVerified:true,negativeInsertDenied:true,
   listJson,dryRunJson:dryJson,historyCountBefore:0,historyCountAfter:0,
   mayApply:false,productionReadback:false
  },null,2));
 }finally{rmSync(root,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
 try{main();}catch(e){console.error(scrub(e?.message||e));process.exitCode=1;}
}
