import {test} from "node:test";
import {strict as assert} from "node:assert";
import {createHash} from "node:crypto";
import {selectEditorialEdition} from "../lib/semantic/editionProjection";
import {composeSemanticRevision} from "../lib/semantic/compose";
import {getSemanticPageUnits,projectSemanticReader,verifyReaderProjection,chooseSemanticParagraphBreak} from "../lib/semantic/readerProjection";
import {buildSemanticSourceRegions} from "../lib/semantic/qaReaderModes";
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
const source=[
 "The Project Gutenberg eBook of The Great God Pan",
 "This eBook is for use under the terms of the Project Gutenberg License.",
 "*** START OF THE PROJECT GUTENBERG EBOOK THE GREAT GOD PAN ***",
 "The Great God Pan","by Arthur Machen","Contents",
 " CHAPTER I. THE EXPERIMENT"," CHAPTER II. MR. CLARKE’S MEMOIRS",
 "I","THE EXPERIMENT",
 "The first important literary paragraph follows here with enough words to demonstrate real typographic pagination and its relationship to the original source anchors, while preserving every single letter and space.",
 "THE END.","NOTE.—Helen Vaughan was born on August 5th, 1865.",
 "*** END OF THE PROJECT GUTENBERG EBOOK THE GREAT GOD PAN ***",
 "Project Gutenberg license information and donations."
].join("\n\n").replace("I\n\nTHE EXPERIMENT","I\n\nTHE EXPERIMENT");
test("edition omits bounded Gutenberg apparatus but preserves literary and ambiguous note",()=>{
 const selected=selectEditorialEdition(source);
 assert.equal(selected.method,"gutenberg-markers-with-contents");
 const text=source.slice(selected.range.start,selected.range.end);
 assert.match(text,/^I\n\nTHE EXPERIMENT/);
 assert.match(text,/NOTE.—Helen Vaughan/);
 assert.doesNotMatch(text,/License|donations|START OF|Contents/);
 assert.equal(selected.warnings.length,1);
});
test("unresolved Gutenberg wrapper stops rather than deleting literary text",()=>{
 assert.throws(()=>selectEditorialEdition("Project Gutenberg license without end markers"));
 assert.throws(()=>selectEditorialEdition("*** START OF THE PROJECT GUTENBERG EBOOK X ***\nText without end"));
});
test("clean edition projection retains source anchors and no Gutenberg units",()=>{
 const rev=composeSemanticRevision({work_id:"test-id",work_slug:"test-work",
 snapshot_ref:"sha256:"+sha("epub"),source_bytes_sha256:sha(source),component_id:"epub:spine",
 original_byte_start:0,original_raw:source});
 const range=selectEditorialEdition(source).range;
 const units=getSemanticPageUnits(rev,range);
 assert(units.length>1);
 const origin=buildSemanticSourceRegions(source,units,range).map(x=>x.text).join("");
 assert.equal(origin,source.slice(range.start,range.end));
 const pages=projectSemanticReader(rev,{mode:"paged",viewport_width:420,
   viewport_height:580,font_scale:1,editionRange:range});
 assert.equal(verifyReaderProjection(rev,pages,range).ok,true);
 assert(pages.length>=1);
});
test("pagination may split prose on whitespace but not leave a dangling one-word tail",()=>{
 const raw="The words keep coming and coming with more clauses, because a final word should never remain by itself. A second sentence follows with enough material to occupy more than two full lines in a narrow column.";
 const point=chooseSemanticParagraphBreak(raw,0,raw.length-47,raw.length,true,32);
 assert(point!==null);
 assert(raw.slice(point!).trim().split(/\s+/).length>=5);
 assert(/\s/.test(raw[point!-1]));
});
