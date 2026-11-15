import {strict as assert} from "node:assert";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {paginateSemanticUnits} from "../lib/semantic/readerProjection";
import type {SemanticPageUnit} from "../lib/semantic/model";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

function paragraph(id:string,raw:string,height:number):SemanticPageUnit{
 return {id,kind:"paragraph",chapter_id:null,source_atom_ids:[id],estimated_height:height,
  node:{id,kind:"paragraph",atom:{id,raw,
   anchor:{normalized_start:0,normalized_end:raw.length}}}} as unknown as SemanticPageUnit;
}
function heading(id:string):SemanticPageUnit{
 return {id,kind:"chapter_heading",chapter_id:id,source_atom_ids:[id],estimated_height:66,
  node:{id,kind:"chapter",heading:{id,raw:"THE EXPERIMENT"},children:[]}} as unknown as SemanticPageUnit;
}
const layout={mode:"paged" as const,viewport_width:420,viewport_height:440,
 font_scale:1,density:"comfortable" as const};

test("each chapter heading begins on its own page, never at the bottom of previous prose",()=>{
 const pages=paginateSemanticUnits([
  paragraph("a","An earlier paragraph with real content.",95),
  heading("heading"),paragraph("b","The chapter begins with its own opening.",130),
 ],layout);
 assert.equal(pages.length,2);
 assert.deepEqual(pages[0].units.map(u=>u.id),["a"]);
 assert.deepEqual(pages[1].units.map(u=>u.id),["heading","b"]);
});
test("browser-measured fragment heights prevent proportional-character page overflow",()=>{
 const raw=Array.from({length:100},(_,i)=>"Sentence "+i+" is here, with some longer words and a pause; ").join("");
 const pageCapacity=layout.viewport_height-100;
 const pages=paginateSemanticUnits([paragraph("long",raw,2400)],{
  ...layout,protected_terms:["Sentence 10"],
  measure_fragment_height:unit=>{
   if(!unit.fragment)return null;
   return Math.ceil((unit.fragment.end-unit.fragment.start)/35)*29+15;
  }
 });
 assert(pages.length>3);
 for(const page of pages){
  assert(page.estimated_height<=pageCapacity,
   "Page "+page.index+" exceeds paper's measured content capacity: "+page.estimated_height);
  assert.equal(page.overflow,"none");
 }
 const chunks=pages.flatMap(p=>p.units);
 assert(chunks.every(x=>x.fragment));
 assert.equal(chunks[0].fragment!.start,0);
 assert.equal(chunks.at(-1)!.fragment!.end,raw.length);
 for(let i=1;i<chunks.length;i++)
  assert.equal(chunks[i].fragment!.start,chunks[i-1].fragment!.end);
});
test("published semantic Reader measures real fragment DOM, keeps paper bounds, old nav and original content",()=>{
 const client=read("components/reader/SemanticReaderClient.tsx");
 const css=read("components/reader/semantic-public-reader.css");
 const projection=read("lib/semantic/readerProjection.ts");
 assert.match(client,/measure_fragment_height:fragmentHeight/);
 assert.match(client,/iterateSemanticPages/);
 assert.match(client,/requestAnimationFrame\(step\)/);
 assert.match(client,/document\.createRange\(\)/);
 assert.match(client,/getBoundingClientRect\(\)\.height/);
 assert.match(client,/semantic-public-reader__side-navigation/);
 assert.match(client,/artales-reader-side-nav--previous/);
 assert.match(client,/artales-reader-side-nav--next/);
 assert.match(client,/onGoToPage=\{n=>goToIndex\(n-1\)\}/);
 assert.match(css,/height:var\(--reader-page-height\)/);
 assert.match(css,/overflow:hidden!important/);
 assert.match(css,/semantic-public-reader__paper--scroll-unit/);
 assert.match(projection,/if\(unit\.kind==="chapter_heading"&&pending\.length\)/);
 assert.match(projection,/fitParagraph/);
 assert.doesNotMatch(projection,/if\(unit\.fragment\?\.continuation_after\s*&&/);
 assert.match(projection,/measureFragment\(cut\[0\]\)/);
 assert.match(projection,/protected_terms\?\?\[\]/);
 assert.doesNotMatch(projection,/const maxChars=Math\.max\(35/);
});
