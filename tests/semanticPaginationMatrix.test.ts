import {test} from "node:test";
import {strict as assert} from "node:assert";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {composeSemanticRevision,recomposeSemanticBatch,verifySemanticRevision,walkSemanticAtoms} from "../lib/semantic/compose";
import {projectSemanticReader,getSemanticPageUnits,verifyReaderProjection,chooseSemanticParagraphBreak} from "../lib/semantic/readerProjection";
import {selectEditorialEdition} from "../lib/semantic/editionProjection";

const sha=(raw:string)=>createHash("sha256").update(raw).digest("hex");
const longParagraph=Array.from({length:35},(_,n)=>
  "A carefully selected paragraph remains unchanged while the display flows between pages; "
  +"every sentence retains the same punctuation and original byte address, section "+n+"."
).join(" ");
const original=[
 "CHAPTER I.",
 ...Array.from({length:12},(_,n)=>"This is an editorial layout passage "+(n+1)+". "+
  "Its text must remain unchanged when the browser measures different widths, "+
  "page heights and font sizes, without losing any literary sentence."),
 longParagraph,
 "CHAPTER II.",
 "A concluding scene remains anchored to the original bytes, with punctuation;",
 "The end."
].join("\n\n");
const revision=composeSemanticRevision({
 work_id:"qa-pagination-matrix",work_slug:"qa-pagination-matrix",
 snapshot_ref:"sha256:"+sha("fixture-epub"),source_bytes_sha256:sha(original),
 component_id:"epub:body",original_byte_start:0,original_raw:original
});
const baseAtoms=walkSemanticAtoms(revision.blocks);

test("publication-safe pagination preserves every semantic unit across realistic viewports",()=>{
 verifySemanticRevision(revision,original);
 for(const width of [320,360,420,768,900,1280]){
  for(const height of [430,620,850,1200]){
   for(const density of ["compact","comfortable"] as const){
    const pages=projectSemanticReader(revision,{
      mode:"paged",viewport_width:width,viewport_height:height,
      font_scale:1.1,density,
    });
    assert.equal(verifyReaderProjection(revision,pages).ok,true);
    assert(pages.length>0);
    const seen=pages.flatMap(p=>p.units);
    assert(seen.length>=getSemanticPageUnits(revision).length);
    for(const p of pages)assert(p.estimated_height>=0);
   }
  }
 }
});

test("browser-measured source blocks may reflow without changing their original anchors",()=>{
 const units=getSemanticPageUnits(revision);
 const heights=Object.fromEntries(units.map(u=>[u.id,
   u.kind==="paragraph"?Math.max(100,u.node.kind==="paragraph"?u.node.atom.raw.length*.75:180):90]));
 for(const width of [360,768,900]){
  const pages=projectSemanticReader(revision,{
   mode:"paged",viewport_width:width,viewport_height:640,
   font_scale:1,density:"comfortable",measured_unit_heights:heights
  });
  assert.equal(verifyReaderProjection(revision,pages).ok,true);
  const fragments=pages.flatMap(page=>page.units).filter(u=>u.fragment);
  for(const item of fragments){
   const f=item.fragment!;
   assert.equal(item.node.kind,"paragraph");
   assert.equal(f.normalized_end-f.normalized_start,f.end-f.start);
  }
 }
});

test("presentation-only batch can repaginate but never edits text or source hashes",()=>{
 const atom=baseAtoms.find(a=>a.raw.includes("editorial layout passage"))!;
 const result=recomposeSemanticBatch(revision,[{
  flagId:"presentation-1",atomId:atom.id,
  reason:"Editorial whitespace adjustment without text mutation",
  kind:"block_presentation",
  presentation:{align:"center",indent:"none",
    space_before:"normal",space_after:"generous"}
 }],original);
 verifySemanticRevision(result,original);
 assert.equal(result.source.normalized_text_sha256,revision.source.normalized_text_sha256);
 assert.deepEqual(result.gaps,revision.gaps);
 const newAtoms=walkSemanticAtoms(result.blocks);
 assert.deepEqual(newAtoms.map(a=>[a.id,a.raw,a.source_sha256,a.anchor]),
  baseAtoms.map(a=>[a.id,a.raw,a.source_sha256,a.anchor]));
 for(const width of [360,900]){
  const pages=projectSemanticReader(result,{
   mode:"paged",viewport_width:width,viewport_height:720,font_scale:1
  });
  assert.equal(verifyReaderProjection(result,pages).ok,true);
 }
});

test("semantic page split keeps punctuation and prevents text cutting",()=>{
 const raw="The narrative moves forward; and more clauses follow after a semicolon, "+
  "while the remainder stays connected to its original paragraph with no rewritten characters.";
 const boundary=chooseSemanticParagraphBreak(raw,0,raw.length-45,raw.length,true,28);
 assert(boundary!==null);
 assert.equal(raw.slice(0,boundary!)+raw.slice(boundary!),raw);
 assert(/\s/.test(raw[boundary!-1]));
});

test("the visible and offscreen measurement renderer apply identical work-level protected terms",()=>{
 const reader=readFileSync(new URL("../components/editor/SemanticReaderLab.tsx",import.meta.url),"utf8");
 const uses=reader.split("unitView(u,protectedTerms)").length-1;
 assert.equal(uses,2,"measurement and visible page must both use protectedTerms");
 assert.match(reader,/className="semantic-reader__measurement"/);
 assert.match(reader,/data-qa-projection="visible"/);
});
