import {strict as assert} from "node:assert";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {paginateSemanticUnits,semanticPageEndFillThreshold,verifySemanticPageCoverage,rebalanceShortSemanticPageTail} from "../lib/semantic/readerProjection";
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
 assert.match(client,/complete:false/);
 assert.match(client,/paginationSettled/);
 assert.match(client,/document\.createRange\(\)/);
 assert.match(client,/getBoundingClientRect\(\)\.height/);
 assert.match(client,/semantic-public-reader__side-navigation/);
 assert.match(client,/artales-reader-side-nav--previous/);
 assert.match(client,/artales-reader-side-nav--next/);
 assert.match(client,/onGoToPage=\{n=>goToIndex\(n-1\)\}/);
 assert.match(css,/height:var\(--reader-page-height\)/);
 assert.match(css,/overflow:hidden!important/);
 assert.match(css,/content-visibility:auto/);
 assert.match(css,/semantic-public-reader__paper--scroll-unit/);
 assert.match(projection,/unit\.layout_role==="chapter_number"/);
 assert.match(projection,/fitParagraph/);
 assert.doesNotMatch(projection,/if\(unit\.fragment\?\.continuation_after\s*&&/);
 assert.match(projection,/measureFragment\(first\)/);
 assert.match(projection,/protected_terms\?\?\[\]/);
 assert.doesNotMatch(projection,/const maxChars=Math\.max\(35/);
});

test("page-end punctuation requires 60 percent for semicolon, 80 percent for comma",()=>{
 assert.equal(semanticPageEndFillThreshold("sentence"),.6);
 assert.equal(semanticPageEndFillThreshold("semicolon"),.6);
 assert.equal(semanticPageEndFillThreshold("comma"),.8);
 assert.equal(semanticPageEndFillThreshold("word"),.85);
});

test("page-end changes preserve all source ranges across long multi-page prose",()=>{
 const raw=Array.from({length:100},(_,i)=>
  "At the river, sentence "+i+" ended; another thought continued. ").join("");
 const source=paragraph("preserved",raw,6000);
 const pages=paginateSemanticUnits([source],{
  mode:"paged",viewport_width:420,viewport_height:440,content_height:300,
  font_scale:1,density:"comfortable",
  measure_fragment_geometry:unit=>{
   if(!unit.fragment)return null;
   const length=unit.fragment.end-unit.fragment.start;
   const lines=Math.max(1,Math.ceil(length/48));
   return {height:10+lines*26,last_line_top:(lines-1)*26,
    last_line_fill:((length-1)%48+1)/48};
  },
 });
 assert(pages.length>5);
 assert.equal(verifySemanticPageCoverage([source],pages).ok,true);
 assert(pages.every(p=>p.overflow==="none"));
 assert(pages.flatMap(p=>p.units).filter(u=>u.fragment).every(u=>
  typeof u.fragment?.justify_last_line==="boolean"||
  u.fragment?.justify_last_line===undefined));
});

test("short punctuation-selected bottom line moves to the preceding full line",()=>{
 // Selected index 3 models a semicolon chosen after punctuation scoring,
 // not the longest candidate. The old bestIndex-only guard missed this case.
 const measurements=[
  {lineTop:52,lineFill:.96},
  {lineTop:78,lineFill:.72},
  {lineTop:78,lineFill:.88},
  {lineTop:104,lineFill:.21},
  {lineTop:104,lineFill:.25},
 ];
 assert.equal(rebalanceShortSemanticPageTail(3,26,i=>measurements[i]),2);
 // The same rule must not remove a genuine well-filled final line.
 assert.equal(rebalanceShortSemanticPageTail(2,26,i=>measurements[i]),2);
});
test("short trailing word moves back when previous line is sufficiently full",()=>{
 const items=[
  {lineTop:50,lineFill:.90},
  {lineTop:76,lineFill:.67},
  {lineTop:102,lineFill:.18},
 ];
 assert.equal(rebalanceShortSemanticPageTail(2,26,i=>items[i]),1);
});
test("no guessed rebalancing without DOM geometry or a full preceding line",()=>{
 const missing=[{lineTop:null,lineFill:null},{lineTop:null,lineFill:null}];
 assert.equal(rebalanceShortSemanticPageTail(1,26,i=>missing[i]),1);
 const sparse=[{lineTop:60,lineFill:.48},{lineTop:86,lineFill:.2}];
 assert.equal(rebalanceShortSemanticPageTail(1,26,i=>sparse[i]),1);
});
