// Shared historical source / full provider ledger contract for the existing runner.
// No network, SQL execution, or credential handling.
import {createHash} from "node:crypto";
import {readFileSync,lstatSync} from "node:fs";
import {join,resolve} from "node:path";
export const CHECKPOINT_CUTOFF="20261122085733";
export const CHECKPOINT_PATH="supabase/history/production-checkpoint-20261126.json";
const PROJECT="nmhdwmszbwgrgfbmlguu", REPO="ARTalesAdmin/ARTales";
const fail=s=>{throw Error("artales_stage_blocked:"+s);};
const hex=(s,n)=>typeof s==="string"&&new RegExp("^[a-f0-9]{"+n+"}$").test(s);
const digest=s=>createHash("sha256").update(s).digest("hex");
const metadata=r=>({version:r.version,name:r.name,statementCount:r.statementCount,ledgerSha256:r.ledgerSha256});
export const LEDGER_ROW_SQL="json_build_object('version',version,'name',name,'statementCount',cardinality(statements),'ledgerSha256',encode(sha256(convert_to(to_json(statements)::text,'UTF8')),'hex'),'statements',case when version > '"+CHECKPOINT_CUTOFF+"' then to_json(statements) else null end)";
export function verifyLedgerRows(rows){
 if(!Array.isArray(rows)||rows.length<5||rows.length>200)fail("invalid_provider_history");
 let previous="";const names=new Set();
 return rows.map(r=>{
  if(!r||!/^[0-9]{14}$/.test(r.version||"")||r.version<=previous||
     !/^[a-z0-9_]+$/.test(r.name||"")||names.has(r.name)||
     !Number.isSafeInteger(r.statementCount)||r.statementCount<1||
     !hex(r.ledgerSha256,64))fail("ledger_identity_or_fingerprint");
  previous=r.version;names.add(r.name);
  if(r.version<=CHECKPOINT_CUTOFF){
   if(r.statements!==null&&r.statements!==undefined)fail("unexpected_historical_sql_export");
   return {...metadata(r),statements:null};
  }
  if(!Array.isArray(r.statements)||r.statements.length!==r.statementCount||
     r.statements.some(s=>typeof s!=="string"||!s.length)||
     digest(JSON.stringify(r.statements))!==r.ledgerSha256)
   fail("full_statement_digest_mismatch");
  return {...metadata(r),statements:[...r.statements]};
 });
}
export function ledgerFingerprint(rows){return digest(JSON.stringify(rows.map(metadata)));}
// The pinned native CLI stores ordered source fragments with only boundary
// whitespace and statement separators removed. Require complete source coverage,
// without splitting SQL ourselves or normalizing text inside any fragment.
// This is a content check, not a SQL parser or a semantic-equivalence claim.
export function assertLedgerSourceMatch(row,body){
 if(typeof body!=="string"||!row||!Array.isArray(row.statements)||
    row.statements.length!==row.statementCount||!row.statementCount||
    row.statements.some(s=>typeof s!=="string"||!s.length)||
    digest(JSON.stringify(row.statements))!==row.ledgerSha256)
  fail("full_statement_digest_mismatch");
 const whitespace=/[ \t\r\n\v\f]/;
 let i=0;
 const space=()=>{while(i<body.length&&whitespace.test(body[i]))i++;};
 space();
 for(let j=0;j<row.statements.length;j++){
  while(body[i]===";"){i++;space();}
  const part=row.statements[j];
  if(!body.startsWith(part,i))fail("source_statement_content_mismatch");
  i+=part.length;space();
  if(j<row.statements.length-1&&body[i]!==";")fail("source_statement_boundary_mismatch");
  if(body[i]===";"){i++;space();}
 }
 while(body[i]===";"){i++;space();}
 if(i!==body.length)fail("source_statement_coverage_incomplete");
 return true;
}
function checkedBlob(root,path,sha){
 if(typeof path!=="string"||! /^(supabase\/migrations|ops\/sql)\/[a-zA-Z0-9_.-]+\.sql$/.test(path)||!hex(sha,40))
  fail("invalid_checkpoint_source");
 const full=join(root,path);
 if(!lstatSync(full).isFile())fail("checkpoint_source_not_regular");
 const body=readFileSync(full);
 const actual=createHash("sha1").update("blob "+body.length+"\0").update(body).digest("hex");
 if(actual!==sha)fail("historical_source_drift");
 return body;
}
export function verifyCheckpoint(sourceDir,source){
 const root=resolve(sourceDir,"../..");
 const path=join(root,CHECKPOINT_PATH);
 if(!lstatSync(path).isFile())fail("checkpoint_not_regular_file");
 const raw=readFileSync(path);
 let c;try{c=JSON.parse(raw.toString("utf8"));}catch{fail("invalid_checkpoint_json");}
 if(!c||c.schema!=="artales-production-history-checkpoint/v1"||c.projectRef!==PROJECT||
    c.repository!==REPO||c.cutoff!==CHECKPOINT_CUTOFF||!hex(c.sourceMainSha,40)||
    c.ledgerDigestAlgorithm!=="sha256(UTF8(PostgreSQL to_json(statements)::text))"||
    !Array.isArray(c.ledger)||!Array.isArray(c.legacyInventory))fail("checkpoint_identity");
 const rows=verifyLedgerRows(c.ledger);
 if(rows.length!==31||rows[0].version!=="20260926142755"||rows[0].name!=="remote_schema"||
    rows.at(-1).version!==CHECKPOINT_CUTOFF)fail("checkpoint_extent");
 const legacy=source.filter(r=>r.version<=CHECKPOINT_CUTOFF).map(r=>"supabase/migrations/"+r.filename).sort();
 const frozen=c.legacyInventory.map(x=>x.path).sort();
 if(legacy.length!==25||JSON.stringify(legacy)!==JSON.stringify(frozen))fail("historical_inventory_drift");
 for(const f of c.legacyInventory)checkedBlob(root,f.path,f.blobSha);
 for(const r of c.ledger){
  if(r.source===null)continue;
  if(!r.source||!["baseline_dump_not_byte_equivalent","byte_exact_single_statement"].includes(r.source.relation))
   fail("checkpoint_source_relation");
  const body=checkedBlob(root,r.source.path,r.source.blobSha);
  if(r.source.relation==="byte_exact_single_statement"&&
     (r.statementCount!==1||createHash("md5").update(body).digest("hex")!==r.firstMd5||
      digest(JSON.stringify([body.toString("utf8")]))!==r.ledgerSha256))
   fail("checkpoint_matched_source_fingerprint");
 }
 return {rows,digest:digest(raw)};
}
