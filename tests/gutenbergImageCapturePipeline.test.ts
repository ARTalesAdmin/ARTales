import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {captureAndArchiveGutenbergImage} from "../lib/ingest/gutenbergImageCapturePipeline";
import type {ServerStorageClient} from "../lib/ingest/illustrationStorageAdapter";
const gif=Buffer.from("47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b","hex");
const digest=createHash("sha256").update(gif).digest("hex");
const at="2026-10-12T08:00:00.000Z";
const base={candidate_id:"alice",text_snapshot_ref:"sha256:"+"1".repeat(64),
 captured_at:at,checked_at:at,artist:{name:"John Tenniel",living:false,death_year:1914,evidence_url:"https://www.gutenberg.org/ebooks/114"},
 artist_provenance:"original_artist" as const,us_catalog_status:"public_domain" as const,express_no_reuse:false,
 grant:{authenticated:true as const,role:"admin" as const,assigned_candidate_id:"alice",approved_gutenberg_catalog:"https://www.gutenberg.org/ebooks/114"},
 reference:{component_id:"gutenberg:114:image:001",ordinal:1,catalog_url:"https://www.gutenberg.org/ebooks/114",
 source_url:"https://www.gutenberg.org/files/114/114-h/images/alice01.gif",caption:"Tenniel",
 index_sha256:"a".repeat(64),archive_status:"not_captured" as const}
};
function storage(){
 const saved=new Map<string,Uint8Array>();
 const client:ServerStorageClient={storage:{from(bucket){
  assert.equal(bucket,"artales-source-archive");
  return {async upload(path,bytes){if(saved.has(path))return {error:"duplicate"};saved.set(path,Uint8Array.from(bytes));return {error:null}},
   async download(path){const bytes=saved.get(path);return {error:bytes?null:"missing",
    data:bytes?{async arrayBuffer(){return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}}:null}};
 }}}};
 return {saved,client};
}
test("authorized original source is downloaded, SHA-pinned and read back from private Storage",async()=>{
 const s=storage();
 const result=await captureAndArchiveGutenbergImage({...base,
  fetchSource:async()=>({status:200,contentType:"image/gif",bytes:gif}),storage:s.client});
 assert.equal(result.snapshot.sha256,digest);
 assert.equal(result.snapshot.decision,"eligible_for_editorial_draft");
 assert.equal(result.archive.storage_verified,true);
 assert.equal(s.saved.size,1);
});
test("bad grant, foreign URL, protected artist and content-type mismatch never write",async()=>{
 for(const patch of [
  {grant:{...base.grant,assigned_candidate_id:"other"}},
  {reference:{...base.reference,source_url:"https://attacker.invalid/image.gif"}},
  {artist:{...base.artist,living:true,death_year:null}},
 ]){
  const s=storage();
  await assert.rejects(()=>captureAndArchiveGutenbergImage({...base,...patch,
   fetchSource:async()=>({status:200,contentType:"image/gif",bytes:gif}),storage:s.client}));
  assert.equal(s.saved.size,0);
 }
 const s=storage();
 await assert.rejects(()=>captureAndArchiveGutenbergImage({...base,
  fetchSource:async()=>({status:200,contentType:"image/png",bytes:gif}),storage:s.client}),/signature/);
 assert.equal(s.saved.size,0);
});
