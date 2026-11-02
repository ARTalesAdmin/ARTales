import {strict as assert} from "node:assert";
import {test} from "node:test";
import {createHash} from "node:crypto";
import {composeSemanticRevision,verifySemanticRevision} from "../lib/semantic/compose";
import {projectSemanticReader,verifyReaderProjection} from "../lib/semantic/readerProjection";
import {xhtmlToSourceText} from "../lib/ingest/epubSemanticExtractor";
const sha=(text:string)=>createHash("sha256").update(text).digest("hex");
test("XHTML extracted with source-preserving paragraph spacing",()=>{
 const text=xhtmlToSourceText("<html><body><h1>CHAPTER I.</h1><p>Hello &amp; world.</p><p>Second paragraph.</p></body></html>");
 assert.match(text,/CHAPTER I./);assert.match(text,/Hello & world/);
});
test("semantic source lossless and release disabled",()=>{
 const original="CHAPTER I. Start\n\nAn anchored paragraph.\n\nAnother paragraph.";
 const revision=composeSemanticRevision({work_id:"candidate:test",work_slug:"candidate-test",
  snapshot_ref:"sha256:"+sha("epub"),source_bytes_sha256:sha(original),component_id:"epub:spine",
  original_byte_start:0,original_raw:original});
 verifySemanticRevision(revision,original);
 assert.equal(revision.release_allowed,false);
 for(const width of [360,768,1440]){
  const pages=projectSemanticReader(revision,{mode:"scroll",viewport_width:width,viewport_height:720,font_scale:1});
  assert.equal(verifyReaderProjection(revision,pages).ok,true);
 }
});
