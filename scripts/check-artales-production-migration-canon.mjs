// ARTales canonical migration inventory guard. Source-only; NO provider calls.
import {readFileSync,readdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {join,basename} from "node:path";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const dir=join(root,"supabase","migrations");
const migrations=readdirSync(dir).filter(x=>x.endsWith(".sql")).sort();
const committed=[
  ["20260926142755","remote_schema",null],
  ["20261023063248","prescreen_shadow_library_v1","119028282d844acb3192f88a64cfd3ac"],
  ["20261024073928","candidate_intake_ab","9c286d05ce350a15a3b939e233424d6c"],
  ["20261025095658","legal_screen_v1","1ae567c85655900e53d4ec70ae7b4a07"],
  ["20261027081945","snapshot389_storage_admin_rls","490d1bfebad3de5a10e6634d953db379"]
];
function fail(message){throw new Error("ARTales migration-canon: "+message);}
const byVersion=new Map(),byName=new Map();
for(const file of migrations){
 const m=file.match(/^([0-9]{14})_([a-z0-9_]+)\.sql$/);
 if(!m)fail("invalid migration filename: "+file);
 const [_,version,name]=m;
 if(byVersion.has(version))fail("duplicate migration version: "+version);
 if(byName.has(name))fail("duplicate migration name: "+name);
 byVersion.set(version,file);byName.set(name,file);
}
for(const [version,name,expectedMd5] of committed){
 const expected=version+"_"+name+".sql";
 if(!migrations.includes(expected))fail("missing exact Production-ledger identity: "+expected);
 const fileContent=readFileSync(join(dir,expected),"utf8");
 if(!fileContent.trim())fail("empty migration: "+expected);
 if(expectedMd5){
  // Provider-sourced digest of schema_migrations.statements[1], observed
  // read-only on 2026-10-28. MD5 is a source fingerprint, not an auth token.
  const actual=createHash("md5").update(fileContent,"utf8").digest("hex");
  if(actual!==expectedMd5)fail("provider SQL fingerprint mismatch: "+expected+
   " expected="+expectedMd5+" got="+actual);
 }
}
const historyVersions=new Set(committed.map(x=>x[0]));
const pending=migrations.filter(f=>!historyVersions.has(f.slice(0,14)));
console.log("ARTales production ledger mirror: PASS ("+committed.length+
 " canonical identities; 4 byte-equal SQL fingerprints).");
console.log("Repo-only migration files (NOT permission to APPLY): "+
 (pending.length?pending.join(", "):"none"));
