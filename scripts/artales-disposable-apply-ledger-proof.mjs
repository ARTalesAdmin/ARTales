// Test-only proof of the real pinned CLI's ledger representation.
// This code cannot use a remote database or production credentials.
import {spawnSync} from "node:child_process";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import {CLI_PIN} from "./artales-migration-plan-v01-core.mjs";
const url="postgresql://postgres:isolated-only@127.0.0.1:5432/artales_identity_fixture?sslmode=disable";
const migration="20261126150000_disposable_ledger_probe.sql";
const sql="-- multi-statement migration probe\ncreate table public.cli_ledger_probe (id int primary key);\ninsert into public.cli_ledger_probe values (1);\n";
const root=mkdtempSync(join(tmpdir(),"artales-ledger-probe-"));
function run(bin,args,cwd=root){
 const r=spawnSync(bin,args,{cwd,encoding:"utf8",timeout:150000,maxBuffer:262144,
 env:{PATH:process.env.PATH||"",HOME:process.env.HOME||"",CI:"true",NPM_CONFIG_FUND:"false",NPM_CONFIG_UPDATE_NOTIFIER:"false"}});
 if(r.error||r.status!==0)throw Error("isolated_"+bin+"_failed:"+(r.stderr||"").replaceAll(url,"[LOCAL_URL]").slice(0,700));
 return (r.stdout||"").trim();
}
try{
 assert.equal(process.env.GITHUB_ACTIONS,"true");
 assert.equal(process.env.ARTALES_LOCAL_PG17_ONLY,"1");
 assert.equal(process.env.PGHOST,"127.0.0.1");
 assert.equal(process.env.PGDATABASE,"artales_identity_fixture");
 const schema=join(root,"supabase");mkdirSync(join(schema,"migrations"),{recursive:true});
 writeFileSync(join(schema,"config.toml"),'project_id = "artales_disposable_ledger_probe"\n');
 writeFileSync(join(schema,"migrations",migration),sql);
 const cli=(...args)=>run("npm",["exec","--yes","--package=supabase@"+CLI_PIN,"--","supabase",...args]);
 const dry=JSON.parse(cli("db","push","--db-url",url,"--dry-run","--skip-vault","--output-format","json"));
 assert.equal(dry.dryRun,true);assert.deepEqual(dry.migrations,[migration]);
 const result=JSON.parse(cli("db","push","--db-url",url,"--skip-vault","--output-format","json"));
 assert.equal(result.dryRun,false);assert.deepEqual(result.migrations,[migration]);
 const ledger=JSON.parse(run("psql",["-X","-v","ON_ERROR_STOP=1","-At","--dbname",url,"-c","select json_build_object('version',version,'name',name,'statements',statements) from supabase_migrations.schema_migrations where version='20261126150000'"]));
 assert.equal(ledger.name,"disposable_ledger_probe");assert.equal(ledger.version,"20261126150000");
 assert.equal(run("psql",["-X","-At","--dbname",url,"-c","select count(*) from public.cli_ledger_probe"]),"1");
 const md5=s=>createHash("md5").update(s).digest("hex");
 console.log(JSON.stringify({provider:"disposable-pg17-only",cli:CLI_PIN,ledger,sourceMd5:md5(sql),firstStatementMd5:md5(ledger.statements[0]),firstEqualsFile:ledger.statements[0]===sql,statementCount:ledger.statements.length}));
}finally{rmSync(root,{recursive:true,force:true});}
