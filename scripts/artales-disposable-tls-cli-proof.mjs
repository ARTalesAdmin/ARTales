// Disposable PG17 TLS verification of real pinned CLI --db-url support.
// Mutates only the isolated GitHub Actions PostgreSQL service, never Production.
import {spawnSync} from "node:child_process";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {CLI_PIN} from "./artales-migration-plan-v01-core.mjs";
import {buildRedactedDbUrlObservation} from "./artales-production-db-url-observation.mjs";
import {PROJECT,REPO} from "./artales-migration-plan-core.mjs";
const ROLE="artales_plan_probe_ro";
const MIGRATION="20261028190000_artales_disposable_tls_probe.sql";
let phase="preflight";
function fail(code){throw Error("artales_disposable_tls_blocked:"+code);}
function run(bin,args,{cwd,allowFailure=false,env={}}={}){
 const p=spawnSync(bin,args,{cwd,encoding:"utf8",timeout:150000,maxBuffer:131072,
  stdio:["ignore","pipe","pipe"],env:{PATH:process.env.PATH||"",
   HOME:process.env.HOME||"",CI:"true",NPM_CONFIG_FUND:"false",
   NPM_CONFIG_UPDATE_NOTIFIER:"false",...env}});
 if(p.error||(!allowFailure&&p.status!==0))
  fail("process_failed_"+bin);
 return {status:p.status,stdout:p.stdout||"",stderr:p.stderr||""};
}
function execPsql(url,sql,allowFailure=false){
 return run("psql",["-X","-v","ON_ERROR_STOP=1","--no-password",
  "-t","-A","--dbname",url,"-c",sql],{allowFailure});
}
function npmCli(url,cwd,cmd){
 const args=cmd==="list"?
  ["migration","list","--db-url",url,"--output-format","json"]:
  ["db","push","--db-url",url,"--dry-run","--skip-vault","--output-format","json"];
 const o=run("npm",["exec","--yes","--package=supabase@"+CLI_PIN,
  "--","supabase",...args],{cwd});
 let parsed;
 try{parsed=JSON.parse(o.stdout);}catch{fail("cli_invalid_json");}
 return {id:cmd==="list"?"migration-list":"db-push-dry-run",argv:args,
  exitCode:0,stdout:o.stdout,stderr:o.stderr,parsed};
}
function main(){
 if(process.env.GITHUB_ACTIONS!=="true"||
   process.env.ARTALES_LOCAL_PG17_ONLY!=="1"||
   process.env.SUPABASE_ACCESS_TOKEN||process.env.SUPABASE_DB_PASSWORD||
   process.env.DATABASE_URL||process.env.ARTALES_PROD_PLAN_DB_URL)
  fail("not_disposable_ci_environment");
 phase="scratch_workspace";
 const root=mkdtempSync(join(tmpdir(),"artales-disposable-tls-"));
 try{
  const caKey=join(root,"ca.key"),ca=join(root,"ca.crt");
  const serverKey=join(root,"server.key"),csr=join(root,"server.csr");
  const server=join(root,"server.crt"),ext=join(root,"server.ext");
  const wrongKey=join(root,"wrong.key"),wrongRoot=join(root,"wrong.crt");
  phase="generate_ca";
  run("openssl",["req","-x509","-new","-nodes","-newkey","rsa:2048",
   "-keyout",caKey,"-out",ca,"-days","2","-subj","/CN=ARTales disposable root",
   "-addext","basicConstraints=critical,CA:TRUE"]);
  run("openssl",["req","-new","-nodes","-newkey","rsa:2048",
   "-keyout",serverKey,"-out",csr,"-subj","/CN=127.0.0.1"]);
  writeFileSync(ext,"subjectAltName=IP:127.0.0.1\nextendedKeyUsage=serverAuth\n");
  run("openssl",["x509","-req","-in",csr,"-CA",ca,"-CAkey",caKey,
   "-CAcreateserial","-days","2","-out",server,"-extfile",ext]);
  run("openssl",["req","-x509","-new","-nodes","-newkey","rsa:2048",
   "-keyout",wrongKey,"-out",wrongRoot,"-days","2",
   "-subj","/CN=ARTales untrusted root",
   "-addext","basicConstraints=critical,CA:TRUE"]);
  phase="find_service_container";
  const containers=run("docker",["ps","--format","{{.ID}} {{.Image}}"]).stdout
   .trim().split("\n").map(x=>x.split(" ")).filter(x=>x[1]==="postgres:17");
  if(containers.length!==1)fail("not_unique_pg17_service");
  const cid=containers[0][0];
  phase="install_pg17_certificate";
  run("docker",["exec","-u","root",cid,"mkdir","-p","/tmp/artales-ci-tls"]);
  for(const path of [server,serverKey])
   run("docker",["cp",path,cid+":/tmp/artales-ci-tls/"+path.split("/").at(-1)]);
  run("docker",["exec","-u","root",cid,"chown","postgres:postgres",
   "/tmp/artales-ci-tls/server.key","/tmp/artales-ci-tls/server.crt"]);
  run("docker",["exec","-u","root",cid,"chmod","600",
   "/tmp/artales-ci-tls/server.key"]);
  phase="configure_postgres_ssl";
  const admin="postgresql://postgres:isolated-only@127.0.0.1:5432/cli_contract?sslmode=disable";
  for(const sql of [
   "ALTER SYSTEM SET ssl_cert_file = '/tmp/artales-ci-tls/server.crt'",
   "ALTER SYSTEM SET ssl_key_file = '/tmp/artales-ci-tls/server.key'",
   "ALTER SYSTEM SET ssl = 'on'",
   "SELECT pg_reload_conf()"
  ])execPsql(admin,sql);
  let ssl=execPsql(admin,"SHOW ssl",true);
  if(ssl.status!==0||ssl.stdout.trim()!=="on"){
   run("docker",["restart",cid]);
   let ready=false;
   for(let attempt=0;attempt<22;attempt++){
    run("sleep",["1"]);
    ssl=execPsql(admin,"SHOW ssl",true);
    if(ssl.status===0&&ssl.stdout.trim()==="on"){ready=true;break;}
   }
   if(!ready)fail("pg17_ssl_not_enabled");
  }
  phase="construct_verified_url";
  const plainUrl="postgresql://"+ROLE+":disposable-readonly-only@127.0.0.1:5432/cli_contract";
  const url=new URL(plainUrl);
  url.searchParams.set("sslmode","verify-full");
  url.searchParams.set("sslrootcert",ca);
  const dbUrl=url.toString();
  phase="verify_psql_tls";
  const good=execPsql(dbUrl,"SELECT current_user, current_setting('ssl')",true);
  if(good.status!==0||!good.stdout.includes(ROLE))
   fail("psql_verified_tls_handshake_failed");
  phase="reject_untrusted_ca";
  const untrusted=new URL(dbUrl);untrusted.searchParams.set("sslrootcert",wrongRoot);
  if(execPsql(untrusted.toString(),"SELECT 1",true).status===0)
   fail("untrusted_ca_was_accepted");
  const dir=join(root,"project");
  mkdirSync(join(dir,"supabase","migrations"),{recursive:true});
  writeFileSync(join(dir,"supabase","config.toml"),
   'project_id = "artales_disposable_tls_only"\n');
  writeFileSync(join(dir,"supabase","migrations",MIGRATION),"select 1;\n");
  phase="cli_verified_tls_list";
  const list=npmCli(dbUrl,dir,"list");
  phase="cli_verified_tls_dry_run";
  const dry=npmCli(dbUrl,dir,"dry");
  if(!Array.isArray(list.parsed?.migrations)||list.parsed.migrations.length!==1||
   list.parsed.migrations[0].local!=="20261028190000"||
   dry.parsed?.dryRun!==true||dry.parsed.upToDate!==false||
   JSON.stringify(dry.parsed.migrations)!==JSON.stringify([MIGRATION]))
   fail("verified_tls_cli_output_contract");
  phase="redact_cli_observation";
  const observation=buildRedactedDbUrlObservation({
   dbUrl,expectedRole:ROLE,projectRef:PROJECT,repository:REPO,
   mainSha:"a".repeat(40),cliVersion:CLI_PIN,
   completedAt:new Date().toISOString(),
   rawCommands:[list,dry].map(({id,argv,exitCode,stdout,stderr})=>({
    id,argv,exitCode,stdout,stderr
   }))
  });
  const serialized=JSON.stringify(observation);
  if(serialized.includes("disposable-readonly-only")||
   serialized.includes("127.0.0.1")||serialized.includes(ca))
   fail("credential_or_tls_path_leak");
  phase="verify_migration_ledger";
  const ledger=execPsql(dbUrl,"SELECT count(*) FROM supabase_migrations.schema_migrations");
  if(ledger.stdout.trim()!=="0")fail("unexpected_migration_write");
  console.log(JSON.stringify({schema:"artales-disposable-verified-tls-cli/v0",
   cliVersion:CLI_PIN,pg17:true,role:ROLE,serverCertVerified:true,
   untrustedCARejected:true,cliList:true,cliDryRun:true,
   observationRedacted:true,historyUnmodified:true,
   productionAccess:false,mayApply:false}));
 }finally{rmSync(root,{recursive:true,force:true});}
}
try{main();}catch(e){
 const s=String(e?.message||"");
 const match=/^artales_(?:disposable_tls|db_url_capture)_blocked:[a-z0-9_]+$/.test(s);
 console.error(match?s:"artales_disposable_tls_blocked:unexpected_at_"+phase);
 process.exitCode=1;
}
