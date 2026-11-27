// Real native CLI + shared PLAN/APPLY contract on disposable PostgreSQL only.
// The historic source inventory is copied, never executed. No live credentials
// or live history statements are downloaded. Missing historical bodies are synthetic.
import {spawnSync} from "node:child_process";
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,cpSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import {CLI_PIN,REDACTED_DB_URL,planCommands,verifyPlanV01} from "./artales-migration-plan-v01-core.mjs";
import {PROJECT,REPO,inventoryFromDirectory} from "./artales-migration-plan-core.mjs";
import {CHECKPOINT_PATH,LEDGER_ROW_SQL,verifyCheckpoint,verifyLedgerRows,assertLedgerSourceMatch} from "./artales-migration-history.mjs";
import {prepareOneMigrationStage} from "./artales-production-one-migration-stage.mjs";
import {buildRedactedDbUrlObservation,safeStderr} from "./artales-production-db-url-observation.mjs";
import {verifyPlanForHumanReview} from "./artales-production-plan-review.mjs";
import {assertPostApply,assertPlanHistory} from "./artales-production-apply-operator.mjs";

const url="postgresql://postgres:isolated-only@127.0.0.1:5432/artales_identity_fixture?sslmode=disable";
const roUrl="postgresql://artales_plan_probe_ro:disposable-readonly-only@127.0.0.1:5432/artales_identity_fixture?sslmode=disable";
const hash=s=>createHash("sha256").update(s).digest("hex");
const first="20261126150000_disposable_ledger_probe.sql";
const second="20261126150100_disposable_ledger_followup.sql";
const sql1="-- multi-statement migration probe\ncreate table public.cli_ledger_probe (id int primary key, title text not null);\ninsert into public.cli_ledger_probe values (1,'Příběh; one');\nalter table public.cli_ledger_probe enable row level security;\ngrant select on public.cli_ledger_probe to ci_reader;\ncreate policy ci_reader_visible on public.cli_ledger_probe for select to ci_reader using (id=1);\n";
const sql2="-- follow-up on the already committed first migration\ncreate function public.ci_ledger_title() returns text language plpgsql security invoker set search_path=pg_catalog as $body$\nbegin\n  return (select title from public.cli_ledger_probe where id=1);\nend;\n$body$;\nrevoke execute on function public.ci_ledger_title() from public;\ngrant execute on function public.ci_ledger_title() to ci_reader;\ninsert into public.cli_ledger_probe values (2,'Hidden');\nDO $$ BEGIN IF (select count(*) from public.cli_ledger_probe) <> 2 THEN RAISE EXCEPTION 'fixture mismatch'; END IF; END $$;\n";
const sourceSha="a".repeat(40);
const root=mkdtempSync(join(tmpdir(),"artales-ledger-probe-"));
function run(bin,args,cwd=root,input){
 const r=spawnSync(bin,args,{cwd,input,encoding:"utf8",timeout:150000,maxBuffer:16777216,
 env:{PATH:process.env.PATH||"",HOME:process.env.HOME||"",CI:"true",NPM_CONFIG_FUND:"false",NPM_CONFIG_UPDATE_NOTIFIER:"false"}});
 if(r.error||r.status!==0)throw Error("isolated_"+bin+"_failed:"+(r.stderr||"").replaceAll(url,"[LOCAL_URL]").replaceAll(roUrl,"[LOCAL_RO_URL]").slice(0,700));
 return {stdout:r.stdout||"",stderr:r.stderr||""};
}
function psql(sql,db=url){
 return run("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","--dbname",db,"-f","-"],root,sql).stdout.trim();
}
function cli(args,cwd){
 return run("npm",["exec","--yes","--package=supabase@"+CLI_PIN,"--","supabase",...args],cwd);
}
function ledger(db=roUrl){
 return verifyLedgerRows(JSON.parse(psql("select json_agg("+LEDGER_ROW_SQL+" order by version) from supabase_migrations.schema_migrations;",db)));
}
const literal=s=>"convert_from(decode('"+Buffer.from(s,"utf8").toString("hex")+"','hex'),'UTF8')";
function prepareFixture(){
 // Unit-test the unchanged real checkpoint against the actual repository first.
 const actual=resolve("supabase/migrations");
 verifyCheckpoint(actual,inventoryFromDirectory(actual));
 const repo=join(root,"repo"),dir=join(repo,"supabase","migrations");
 mkdirSync(dir,{recursive:true});
 mkdirSync(join(repo,"supabase","history"),{recursive:true});
 cpSync("supabase/migrations",dir,{recursive:true});
 cpSync("ops/sql",join(repo,"ops","sql"),{recursive:true});
 const checkpoint=JSON.parse(readFileSync(CHECKPOINT_PATH,"utf8"));
 // This file and all test ledger entries exist only inside the scratch fixture.
 const inserts=[];
 for(const row of checkpoint.ledger){
  const statements=row.source?.relation==="byte_exact_single_statement"?
   [readFileSync(row.source.path,"utf8")]:
   Array.from({length:row.statementCount},(_,i)=>"select "+(i+1)+" /* disposable historical "+row.version+" */");
  const fp=hash(JSON.stringify(statements));
  if(row.source?.relation==="byte_exact_single_statement")assert.equal(fp,row.ledgerSha256);
  row.ledgerSha256=fp;
  row.firstMd5=createHash("md5").update(statements[0]).digest("hex");
  inserts.push("insert into supabase_migrations.schema_migrations(version,name,statements) values ('"+row.version+"','"+row.name+"',array["+statements.map(literal).join(",")+"]);");
 }
 writeFileSync(join(repo,CHECKPOINT_PATH),JSON.stringify(checkpoint));
 writeFileSync(join(dir,first),sql1);
 writeFileSync(join(dir,second),sql2);
 psql([
  "create schema supabase_migrations;",
  "create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);",
  ...inserts,
  "create role ci_reader nologin;",
  "create role artales_plan_probe_ro login password 'disposable-readonly-only' nosuperuser nocreatedb nocreaterole noinherit noreplication;",
  "alter role artales_plan_probe_ro set default_transaction_read_only=on;",
  "revoke all on schema supabase_migrations from public;",
  "grant usage on schema supabase_migrations to artales_plan_probe_ro;",
  "grant select on supabase_migrations.schema_migrations to artales_plan_probe_ro;"
 ].join("\n"));
 assert.equal(psql("show transaction_read_only;",roUrl),"on");
 assert.equal(psql("select has_table_privilege(current_user,'supabase_migrations.schema_migrations','INSERT');",roUrl),"f");
 return dir;
}
function stage(dir,applied,filename,body,label){
 return prepareOneMigrationStage({sourceMigrationsDir:dir,stageRoot:join(root,label),sourceSha,
  projectRef:PROJECT,repository:REPO,applied,selectedFilename:filename,selectedSha256:hash(body)});
}
function plan(s,applied,filename,body,db=roUrl){
 const observedAt=new Date().toISOString();
 const rawCommands=planCommands("db-url-redacted").map(spec=>{
  const argv=spec.argv.map(a=>a===REDACTED_DB_URL?db:a);
  const c=cli(argv,s.stageRoot);
  return {id:spec.id,argv,exitCode:0,stdout:c.stdout,stderr:c.stderr};
 });
 // This is the real read-only observation helper on a fixture role.
 // The local writable dry-run uses the same verifier with redacted commands.
 let observation;
 if(db===roUrl)observation=buildRedactedDbUrlObservation({
  dbUrl:db,expectedRole:"artales_plan_probe_ro",projectRef:PROJECT,repository:REPO,
  mainSha:sourceSha,cliVersion:CLI_PIN,completedAt:new Date().toISOString(),rawCommands
 });
 else{
  // Exercise the same APPLY-side observation formatting, not the read-only
  // role-specific URL validator.
  observation={schema:"artales-cli-plan-observation/v0.2",source:"operator-attested-cli-json",
   transport:"db-url-redacted",projectRef:PROJECT,repository:REPO,mainSha:sourceSha,
   cliVersion:CLI_PIN,completedAt:new Date().toISOString(),
   commands:rawCommands.map((c,i)=>({...c,argv:planCommands("db-url-redacted")[i].argv,
     stderr:safeStderr(c.id,c.stderr,c.stdout)}))};
 }
 const verification={inventory:s.inventory,
  readback:{schema:"artales-migration-readback/v1",source:"operator-attested-provider-readback",
   projectRef:PROJECT,observedAt,migrations:applied},
  request:{schema:"artales-migration-request/v0",projectRef:PROJECT,repository:REPO,
   ref:"refs/heads/main",headSha:sourceSha,expectedPending:[{filename,sha256:hash(body)}]},
  checkoutSha:sourceSha,observation,nowISO:new Date().toISOString()};
 const proof=verifyPlanV01(verification);
 assert.deepEqual(proof.pending,[filename]);assert.equal(proof.mayApply,false);
 const review=verifyPlanForHumanReview({...verification,envelope:{schema:"artales-migration-envelope/v0",
  projectRef:PROJECT,repository:REPO,sourceRef:"refs/heads/main",sourceSha,
  migrations:[{filename,sha256:hash(body)}]}});
 assert.equal(review.planProofDigest,proof.proofDigest);
 assert.deepEqual(ledger(),applied);
 return s.receipt;
}
function cycle(dir,before,filename,body,label){
 const p=stage(dir,before,filename,body,label+"-plan");
 const receipt=plan(p,before,filename,body);
 const a=stage(dir,ledger(url),filename,body,label+"-apply");
 assertPlanHistory(receipt,a.receipt);
 plan(a,before,filename,body,url);
 const output=JSON.parse(cli(["db","push","--db-url",url,"--skip-vault","--output-format","json"],a.stageRoot).stdout);
 assert.equal(output.dryRun,false);assert.equal(output.upToDate,false);
 assert.deepEqual(output.migrations,[filename]);assert.deepEqual(output.seeds,[]);assert.deepEqual(output.roles,[]);
 const after=ledger();
 assertPostApply(before,after,a.inventory.at(-1),body);
 assertLedgerSourceMatch(after.at(-1),body);
 console.log("PASS: "+label+" exact PLAN, owner dry-run, APPLY and full ledger readback ("+before.length+" -> "+after.length+")");
 return {receipt,after};
}
try{
 assert.equal(process.env.GITHUB_ACTIONS,"true");
 assert.equal(process.env.ARTALES_LOCAL_PG17_ONLY,"1");
 assert.equal(process.env.PGHOST,"127.0.0.1");
 assert.equal(process.env.PGDATABASE,"artales_identity_fixture");
 assert.ok(!process.env.ARTALES_PROD_MIGRATION_DB_URL&&!process.env.SUPABASE_ACCESS_TOKEN);
 const dir=prepareFixture();
 const before=ledger();
 assert.equal(before.length,31);
 const one=cycle(dir,before,first,sql1,"first");
 assert.equal(one.receipt.deferred.length,1);
 assert.equal(one.receipt.deferred[0].filename,second);
 assert.equal(psql("select to_regprocedure('public.ci_ledger_title()') is null;"),"t");
 assert.equal(psql("select count(*) from public.cli_ledger_probe;"),"1");
 assert.throws(()=>stage(dir,one.after,first,sql1,"repeat"),/not_exact_first_pending_migration/);
 const secondStage=stage(dir,one.after,second,sql2,"stale-proof");
 assert.throws(()=>assertPlanHistory(one.receipt,secondStage.receipt),/pending_or_history_changed_since_plan/);
 const two=cycle(dir,one.after,second,sql2,"second");
 assert.equal(two.receipt.deferred.length,0);
 assert.equal(psql("select count(*) from public.cli_ledger_probe;"),"2");
 assert.equal(psql("set role ci_reader; select public.ci_ledger_title();"),"Příběh; one");
 assert.equal(psql("set role ci_reader; select count(*) from public.cli_ledger_probe;"),"1");
 const baseline=prepareOneMigrationStage({sourceMigrationsDir:dir,stageRoot:join(root,"final-baseline"),
  sourceSha,projectRef:PROJECT,repository:REPO,applied:two.after,mode:"baseline"});
 assert.equal(baseline.receipt.selected,null);
 assert.equal(baseline.receipt.appliedCount,33);
 const final=JSON.parse(cli(["db","push","--db-url",roUrl,"--dry-run","--skip-vault","--output-format","json"],baseline.stageRoot).stdout);
 assert.equal(final.upToDate,true);assert.deepEqual(final.migrations,[]);
 assert.deepEqual(ledger(),two.after);
 console.log("PASS: no historical replay, no skipped migration, no stale PLAN, second migration independent of name, final no-pending PLAN, real RLS and function grants");
}finally{rmSync(root,{recursive:true,force:true});}
