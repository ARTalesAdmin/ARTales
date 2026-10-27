import test from "node:test";
import assert from "node:assert/strict";
import * as mirror from "../lib/ingest/snapshot389Mirror.ts";
import * as capture from "../lib/ingest/rawSourceSnapshot.ts";
const {fetchSnapshot389FromMirror,SNAPSHOT_389_MIRROR_URL}=mirror.default??mirror;
const {captureRawSource}=capture.default??capture;
const selection={schema:"artales.snapshot-selection.v1",candidate_id:"98508359-bce1-4e73-b842-b69a9d1112d0",
source_id:"2fbd2f26-89e6-464e-b048-001a8e533cc0",decision_no:9,
catalog_url:"https://www.gutenberg.org/ebooks/389",
original_locked_url:"https://www.gutenberg.org/ebooks/389.epub.noimages",
chosen_url:"https://www.gutenberg.org/ebooks/389.epub.noimages",
format:"epub",selection:"locked",correspondence:"locked_file",
source_archive_status:"not_captured",semantic_ready:false,publication_authorized:false};
test("mirror URL fixed to officially listed host and one Gutenberg ID",()=>{
 const u=new URL(SNAPSHOT_389_MIRROR_URL);assert.equal(u.hostname,"gutenberg.pglaf.org");
 assert.equal(u.pathname,"/cache/epub/389/pg389.epub");
});
test("rejects non-200 mirror response, does not redirect",async()=>{
 await assert.rejects(()=>fetchSnapshot389FromMirror(async (_u,opt)=>{
 assert.equal(opt.redirect,"error");return new Response(null,{status:404})}),/mirror_unavailable/);
});
test("rejects oversized binary before any capture",async()=>{
 await assert.rejects(()=>fetchSnapshot389FromMirror(async()=>new Response(new Uint8Array(64),{status:200,headers:{"content-length":String(9*1024*1024)}})),/declared_size_invalid/);
});
test("real mirror #389 source can be captured byte-for-byte (not Storage)",{skip:process.env.ARTALES_SNAPSHOT_389_LIVE_MIRROR!=="1"},async()=>{
 const input=await fetchSnapshot389FromMirror();
 const result=captureRawSource(selection,input,new Date().toISOString());
 assert.equal(result.manifest.sha256.length,64);
 assert.equal(result.manifest.bytes,input.length);
 assert(result.manifest.parts.some(x=>x.kind==="literary_text_candidate"));
 assert.equal(result.manifest.selection.decision_no,9);
 console.log(JSON.stringify({mirror:SNAPSHOT_389_MIRROR_URL,bytes:input.length,sha256:result.manifest.sha256,embedded_images:result.manifest.embedded_images,archive_ready:result.manifest.archive_ready,parts:result.manifest.parts.length}));
});
