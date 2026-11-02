import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import * as mirrorModule from "../lib/ingest/snapshot389Mirror.ts";
import * as parserModule from "../lib/ingest/epubSemanticExtractor.ts";
import * as composeModule from "../lib/semantic/compose.ts";
const {fetchSnapshot389FromMirror}=mirrorModule.default??mirrorModule;
const {extractEpub}=parserModule.default??parserModule;
const {composeSemanticRevision,verifySemanticRevision}=composeModule.default??composeModule;
test("real archived Gutenberg #389 EPUB parses to complete semantic text and private visual manifest",
 {skip:process.env.ARTALES_SNAPSHOT_389_LIVE_MIRROR!=="1"},async()=>{
 const raw=await fetchSnapshot389FromMirror();
 const actual=createHash("sha256").update(raw).digest("hex");
 assert.equal(actual,"2e12d981f9c916e5c6264e284f97b03c8dda52f6de720451d32967d0be8736df");
 const extract=extractEpub(raw);
 assert.equal(extract.epub_sha256,actual);
 assert(extract.documents.length>=1);
 assert(extract.text.length>10000);
 assert.match(extract.text,/Great God Pan|CHAPTER/i);
 assert.equal(extract.assets.length,1);
 assert(extract.assets.every(x=>x.publication_clearance==="excluded"));
 const revision=composeSemanticRevision({
  work_id:"98508359-bce1-4e73-b842-b69a9d1112d0",
  work_slug:"candidate-98508359-bce1-4e73-b842-b69a9d1112d0",
  snapshot_ref:"sha256:"+actual,
  source_bytes_sha256:extract.text_sha256,
  component_id:extract.component_id,original_byte_start:0,original_raw:extract.text
 });
 verifySemanticRevision(revision,extract.text);
 assert(revision.blocks.length>0);
 assert.equal(revision.release_allowed,false);
 console.log("REAL_EPUB_SEMANTIC_QA",JSON.stringify({
  sha256:actual,documents:extract.documents.length,sourceLength:extract.text.length,
  blocks:revision.blocks.length,privateAssets:extract.assets.length
 }));
});