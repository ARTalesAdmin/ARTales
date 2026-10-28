// ARTales migration admission: source-only and strictly offline.
import {createHash} from "node:crypto";
import {readFileSync,readdirSync,lstatSync} from "node:fs";
import {join} from "node:path";
export const PROJECT="nmhdwmszbwgrgfbmlguu", REPO="ARTalesAdmin/ARTales";
const BASE="20260926142755";
const filenameRe=/^([0-9]{14})_([a-z0-9][a-z0-9_]*)\.sql$/;
const hash=(kind,data)=>createHash(kind).update(data,"utf8").digest("hex");
const fail=s=>{throw new Error("artales_admission_blocked:"+s);};
const isHex=(v,n)=>typeof v==="string"&&new RegExp("^[a-f0-9]{"+n+"}$").test(v);
export function inventoryFromDirectory(dir){
 const names=readdirSync(dir).filter(f=>f.endsWith(".sql")).sort();
 if(names.length<5||names.length>200)fail("invalid_inventory");
 const usedVersions=new Set(),usedNames=new Set();
 return names.map(filename=>{
  const m=filenameRe.exec(filename);if(!m)fail("invalid_filename");
  const [,version,name]=m;
  if(usedVersions.has(version)||usedNames.has(name))fail("duplicate_local");
  usedVersions.add(version);usedNames.add(name);
  const file=join(dir,filename);
  if(!lstatSync(file).isFile())fail("not_regular_file");
  const body=readFileSync(file,"utf8");
  if(!body.trim())fail("empty_sql");
  return {version,name,filename,sha256:hash("sha256",body),md5:hash("md5",body)};
 });
}
export function admission({inventory,readback,request,checkoutSha,nowISO}){
 if(!Array.isArray(inventory)||inventory.length<5||inventory.length>200)fail("inventory_count");
 if(!request||request.schema!=="artales-migration-request/v0"||request.projectRef!==PROJECT||
  request.repository!==REPO||request.ref!=="refs/heads/main"||
  !isHex(request.headSha,40)||checkoutSha!==request.headSha)fail("source_identity");
 if(!readback||readback.schema!=="artales-migration-readback/v0"||
  readback.source!=="operator-attested-provider-readback"||
  readback.projectRef!==PROJECT||!Array.isArray(readback.migrations)||
  readback.migrations.length<5||readback.migrations.length>200)fail("readback_identity");
 const observed=Date.parse(readback.observedAt),now=Date.parse(nowISO);
 if(!Number.isFinite(observed)||!Number.isFinite(now)||
   !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(readback.observedAt)||
   observed>now+30000||now-observed>900000)fail("stale_provider_evidence");
 const local=new Map(),names=new Set();
 for(const r of inventory){
  if(!r||!filenameRe.test(r.filename)||r.filename!==r.version+"_"+r.name+".sql"||
   !isHex(r.sha256,64)||!isHex(r.md5,32)||local.has(r.version)||names.has(r.name))
   fail("local_drift");
  local.set(r.version,r);names.add(r.name);
 }
 const applied=new Set();let previous="";
 for(const r of readback.migrations){
  if(!r||!/^\d{14}$/.test(r.version)||r.version<=previous)fail("remote_order_or_duplicate");
  previous=r.version;
  const matching=local.get(r.version);
  if(!matching||matching.name!==r.name)fail("unknown_remote_migration");
  if(r.version===BASE){
   if(r.name!=="remote_schema")fail("baseline_drift");
  }else if(r.statementMd5!==matching.md5){
   fail("remote_sql_fingerprint_mismatch:"+r.version);
  }
  applied.add(r.version);
 }
 if(!applied.has(BASE))fail("missing_baseline");
 const pending=inventory.filter(r=>!applied.has(r.version));
 if(pending.some(r=>r.version<=previous))fail("retroactive_pending");
 if(pending.length>1)fail("multiple_pending");
 if(!Array.isArray(request.expectedPending)||request.expectedPending.length!==pending.length)
  fail("pending_set_drift");
 pending.forEach((r,i)=>{
  if(!request.expectedPending[i]||request.expectedPending[i].filename!==r.filename||
   request.expectedPending[i].sha256!==r.sha256)fail("pending_digest_or_name_drift");
 });
 const safePending=pending.map(r=>({version:r.version,name:r.name,filename:r.filename,sha256:r.sha256}));
 const artifact={schema:"artales-migration-plan/v0",projectRef:PROJECT,repository:REPO,
  ref:request.ref,headSha:request.headSha,
  providerReadbackObservedAt:readback.observedAt,appliedCount:applied.size,pending:safePending};
 return {...artifact,planDigest:hash("sha256",JSON.stringify(artifact)),
  evidenceClass:"offline-source-plus-operator-attested-readback",
  liveCliDryRunVerified:false,productionApplyAuthorized:false,mayApply:false};
}
