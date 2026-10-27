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
 let result;
 try {
   result=captureRawSource(selection,input,new Date().toISOString());
 } catch (e) {
   const b=Buffer.from(input);
   const end=(()=>{for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50&&i+22+b.readUInt16LE(i+20)===b.length)return i;return -1})();
   const entries=[];
   if(end>=0){
     const start=b.readUInt32LE(end+16);
     let p=start;
     const count=b.readUInt16LE(end+10),size=b.readUInt32LE(end+12);
     for(let i=0;i<Math.min(count,400);i++){
       if(p+46>end||b.readUInt32LE(p)!==0x02014b50)break;
       const flags=b.readUInt16LE(p+8),method=b.readUInt16LE(p+10),packed=b.readUInt32LE(p+20),plain=b.readUInt32LE(p+24),
         nameLen=b.readUInt16LE(p+28),extra=b.readUInt16LE(p+30),comment=b.readUInt16LE(p+32),
         offset=b.readUInt32LE(p+42),next=p+46+nameLen+extra+comment;
       const issues=[];
       if(next>end)issues.push("next_gt_end");
       if(!nameLen)issues.push("missing_name");
       if(![0,8].includes(method))issues.push("method_unsupported");
       if(flags&0x0041)issues.push("encryption_flag");
       if(packed===0xffffffff||plain===0xffffffff||offset===0xffffffff)issues.push("zip64");
       if(packed>8*1024*1024||plain>48*1024*1024)issues.push("item_size");
       if(offset+30>start)issues.push("offset_overlap");
       if(offset+30<=start){
         if(b.readUInt32LE(offset)!==0x04034b50)issues.push("local_signature");
         if(b.readUInt16LE(offset+8)!==flags)issues.push("flags_mismatch");
         if(b.readUInt16LE(offset+10)!==method)issues.push("method_mismatch");
       }
       if(method===0&&packed!==plain)issues.push("stored_mismatch");
       if(issues.length) entries.push({i,name:b.subarray(p+46,p+46+nameLen).toString("utf8").slice(0,110),method,flags,packed,plain,offset,issues});
       p=next;
     }
     console.log("EPUB_FORENSIC",JSON.stringify({bytes:b.length,entries:count,cdStart:start,cdSize:size,bad:entries.slice(0,8)}));
   }
   throw e;
 }
 assert.equal(result.manifest.sha256.length,64);
 assert.equal(result.manifest.bytes,input.length);
 assert(result.manifest.parts.some(x=>x.kind==="literary_text_candidate"));
 assert.equal(result.manifest.selection.decision_no,9);
 console.log(JSON.stringify({mirror:SNAPSHOT_389_MIRROR_URL,bytes:input.length,sha256:result.manifest.sha256,embedded_images:result.manifest.embedded_images,archive_ready:result.manifest.archive_ready,parts:result.manifest.parts.length}));
});
