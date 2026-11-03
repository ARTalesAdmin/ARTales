import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import * as mirrorModule from "../lib/ingest/snapshot389Mirror.ts";
import * as parserModule from "../lib/ingest/epubSemanticExtractor.ts";
import * as composeModule from "../lib/semantic/compose.ts";
import * as editionModule from "../lib/semantic/editionProjection.ts";
import * as projectionModule from "../lib/semantic/readerProjection.ts";
const {fetchSnapshot389FromMirror}=mirrorModule.default??mirrorModule;
const {extractEpub}=parserModule.default??parserModule;
const {composeSemanticRevision,verifySemanticRevision}=composeModule.default??composeModule;
const {selectEditorialEdition}=editionModule.default??editionModule;
const {getSemanticPageUnits,projectSemanticReader,verifyReaderProjection}=projectionModule.default??projectionModule;
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
 const edition=selectEditorialEdition(extract.text);
 const literary=extract.text.slice(edition.range.start,edition.range.end);
 assert.equal(edition.method,"gutenberg-markers-with-contents");
 assert.match(literary,/^I\n\nTHE EXPERIMENT/);
 assert.match(literary,/NOTE.—Helen Vaughan/);
 assert.doesNotMatch(literary,/PROJECT GUTENBERG EBOOK|Project Gutenberg License|Donations/);
 const units=getSemanticPageUnits(revision,edition.range);
 assert(units.length>0&&units.length<revision.blocks.length);
 const pages=projectSemanticReader(revision,{
  mode:"paged",viewport_width:420,viewport_height:700,font_scale:1,
  editionRange:edition.range
 });
 assert.equal(verifyReaderProjection(revision,pages,edition.range).ok,true);
 assert(pages.length>1);
 console.log("REAL_EPUB_SEMANTIC_QA",JSON.stringify({
  sha256:actual,documents:extract.documents.length,sourceLength:extract.text.length,
  blocks:revision.blocks.length,editionUnits:units.length,editionPages:pages.length,
  omittedFrontMatter:edition.range.start,omittedBackMatter:extract.text.length-edition.range.end,
  privateAssets:extract.assets.length
 }));
});