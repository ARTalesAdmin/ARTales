import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {captureIllustration} from "../lib/ingest/illustrationSnapshot";
import {archiveAndVerifyIllustration,type ServerStorageClient} from "../lib/ingest/illustrationStorageAdapter";
import {PRIVATE_ILLUSTRATION_ARCHIVE_BUCKET} from "../lib/ingest/illustrationArchiveChoice";
const raw=Buffer.from("47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b","hex");
const sha=createHash("sha256").update(raw).digest("hex");
const at="2026-10-12T08:00:00.000Z";
const snapshot=captureIllustration({
 candidate_id:"alice",text_snapshot_ref:"sha256:"+"1".repeat(64),component_id:"alice:img1",
 role:"interior_illustration",
 source:{asset_url:"https://www.gutenberg.org/files/114/114-h/images/alice02a.gif",
  catalog_url:"https://www.gutenberg.org/ebooks/114",archive_ref:"fixture:binary",
  captured_at:at,sha256:sha,bytes:raw},
 author:{name:"John Tenniel",living:false,death_year:1914,evidence_url:"https://www.gutenberg.org/ebooks/114"},
 provenance:"original_artist",us_catalog_status:"public_domain",express_no_reuse:false
},at);
function fakeStore(opts:{corrupt?:boolean;refuse?:boolean}={}){
 const store=new Map<string,Uint8Array>();
 const client:ServerStorageClient={storage:{from(bucket){
  assert.equal(bucket,PRIVATE_ILLUSTRATION_ARCHIVE_BUCKET);
  return {
   async upload(path,bytes,config){
    assert.equal(config.upsert,false);
    if(opts.refuse||store.has(path))return {error:"blocked"};
    store.set(path,Uint8Array.from(bytes));return {error:null};
   },
   async download(path){
    const v=store.get(path);
    const copy=v?Uint8Array.from(v):null;
    if(copy&&opts.corrupt)copy[0]^=1;
    return {error:copy?null:"missing",data:copy?{async arrayBuffer(){
     return copy.buffer.slice(copy.byteOffset,copy.byteOffset+copy.byteLength);
    }}:null};
   }
  };
 }}};
 return {client,store};
}
test("private GIF original persists and byte digest verified by readback",async()=>{
 const {client,store}=fakeStore();
 const receipt=await archiveAndVerifyIllustration(client,snapshot,raw);
 assert.equal(receipt.source_sha256,sha);
 assert.equal(receipt.source_bucket,PRIVATE_ILLUSTRATION_ARCHIVE_BUCKET);
 assert.equal(receipt.storage_verified,true);
 assert.equal(store.size,1);
 await assert.rejects(()=>archiveAndVerifyIllustration(client,snapshot,raw),/upload refused/);
});
test("corrupt readback and storage errors never mark original verified",async()=>{
 await assert.rejects(()=>archiveAndVerifyIllustration(fakeStore({corrupt:true}).client,snapshot,raw),/archived bytes changed/);
 await assert.rejects(()=>archiveAndVerifyIllustration(fakeStore({refuse:true}).client,snapshot,raw),/upload refused/);
});
