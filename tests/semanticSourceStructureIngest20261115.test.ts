import {test} from "node:test";
import {strict as assert} from "node:assert";
import {createHash} from "node:crypto";
import {assessSemanticSourceStructure} from "../lib/semantic/sourceStructure";
import {composeSemanticRevision,verifySemanticRevision,walkSemanticAtoms} from "../lib/semantic/compose";
import {xhtmlToSourceWithStructure} from "../lib/ingest/epubSemanticExtractor";
const sha=(v:string)=>createHash("sha256").update(v).digest("hex");
function compose(raw:string,hints:ReturnType<typeof assessSemanticSourceStructure>["hints"]){
 const result=composeSemanticRevision({work_id:"fixture",work_slug:"fixture",
  snapshot_ref:"sha256:"+sha("archive"),source_bytes_sha256:sha(raw),
  component_id:"epub:spine",original_byte_start:0,original_raw:raw,hints});
 verifySemanticRevision(result,raw);
 assert.equal(result.source.normalized_text,raw);
 return result;
}
test("plain Gutenberg Roman numeral, uppercase title and prose become anchored chapter + section",()=>{
 const source="I\n\nTHE EXPERIMENT\n\nAn opening paragraph sufficiently long to be prose.\n\n"+
 "II\n\nMR. CLARKE’S MEMOIRS\n\nA second long paragraph of literary prose follows.";
 const assessed=assessSemanticSourceStructure(source);
 assert.deepEqual(assessed.hints.map(h=>h.kind),["chapter","section","chapter","section"]);
 const revision=compose(source,assessed.hints);
 assert.equal(revision.blocks.filter(b=>b.kind==="chapter").length,2);
 assert.equal(revision.blocks[0].kind,"chapter");
 const first=revision.blocks[0];
 if(first.kind==="chapter"){
  assert.equal(first.heading.raw,"I");
  assert.equal(first.children[0].kind,"section");
 }
 assert.equal(walkSemanticAtoms(revision.blocks).map(a=>a.raw).join("\n\n"),source);
});
test("unnumbered uppercase literary chapter is recognized independently of Roman numerals",()=>{
 const source="A long introductory paragraph before the next section.\n\n"+
 "THE GARDEN OF FORGOTTEN NAMES\n\nA longer paragraph follows this heading, and forms the narrative.";
 const a=assessSemanticSourceStructure(source);
 assert.equal(a.hints.length,1);assert.equal(a.hints[0].kind,"chapter");
 assert.equal(a.hints[0].evidence?.confidence,"medium");
 const revision=compose(source,a.hints);
 assert.equal(revision.blocks.some(x=>x.kind==="chapter"),true);
});
test("first unnumbered Gutenberg literary title is a chapter with reviewable medium confidence",()=>{
 const text="THE GARDEN WITHOUT A NUMBER\n\nAn opening scene continues over several sentences in this ordinary paragraph.";
 const a=assessSemanticSourceStructure(text);
 assert.equal(a.hints.length,1);
 assert.equal(a.hints[0].kind,"chapter");
 assert.equal(a.hints[0].evidence?.confidence,"medium");
 assert.equal(compose(text,a.hints).blocks[0].kind,"chapter");
});

test("XHTML heading hierarchy and poetry markup survive extraction as original source anchors",()=>{
 const html='<html><body><h1>THE GARDEN OF NAMES</h1>'+
 '<p>Some introductory narrative of the story is here.</p>'+
 '<h3>THE SECRET DOOR</h3><p>A passage follows the subsection of the work.</p>'+
 '<div class="poetry"><p>First line of the poem<br/>Second line of the poem<br/>Third line of the poem<br/>Fourth line of the poem</p></div>'+
 '</body></html>';
 const parsed=xhtmlToSourceWithStructure(html);
 const a=assessSemanticSourceStructure(parsed.text,parsed.cues);
 assert.deepEqual(a.hints.map(h=>h.kind),["chapter","section","poem"]);
 assert(a.hints.every(h=>parsed.text.slice(h.start,h.end).length>0));
 const revision=compose(parsed.text,a.hints);
 const poem=revision.blocks.find(x=>x.kind==="chapter");
 assert(poem?.kind==="chapter");
 assert(walkSemanticAtoms(revision.blocks).some(x=>x.raw.includes("Fourth line")));
 assert(revision.blocks[0].kind==="chapter");
});
test("ambiguous unmarked verse is signaled for QA and never silently assigned poem kind",()=>{
 const poem="First verse grows in the shade\nSecond verse runs to the sea\nThird verse remembers the rain\nFourth verse returns to the hill";
 const source="A short literary paragraph above.\n\n"+poem+"\n\nA normal prose sentence follows this verse fragment.";
 const a=assessSemanticSourceStructure(source);
 assert(a.reviewSignals.some(s=>s.kind==="possible_poem"));
 assert(!a.hints.some(h=>h.kind==="poem"));
 const revision=compose(source,a.hints);
 assert(!revision.blocks.some(x=>x.kind==="poem"));
});
test("overlapping XHTML cues cannot alter sealed source or generate ambiguous nested roles",()=>{
 const source="THE LONG CHAPTER NAME\n\nA sufficiently detailed paragraph of a story goes here.";
 const a=assessSemanticSourceStructure(source,[
  {kind:"chapter",start:0,end:21,evidence:"xhtml-heading"},
  {kind:"poem",start:0,end:21,evidence:"xhtml-poetry"}
 ]);
 assert.equal(a.hints.length,1);
 assert(a.reviewSignals.some(r=>r.kind==="conflicting_markup"));
});
