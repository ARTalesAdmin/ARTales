import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import type {SemanticPageUnit} from "../lib/semantic/model";
import {paginateSemanticUnits,projectFlatChapterHeadings} from "../lib/semantic/readerProjection";

function paragraph(id:string,raw:string,height:number):SemanticPageUnit{
 return {id,kind:"paragraph",estimated_height:height,chapter_id:null,source_atom_ids:[id],
  node:{id,kind:"paragraph",atom:{id,raw,marks:[],source_sha256:"fixture",
   anchor:{snapshot_ref:"fixture",component_id:"fixture",
   normalized_start:0,normalized_end:raw.length,
   original_byte_start:0,original_byte_end:Buffer.byteLength(raw)}}}};
}
const body=(id:string)=>paragraph(id,("An actual literary paragraph continues naturally; ").repeat(12),165);
const layout={mode:"paged" as const,viewport_width:550,viewport_height:630,
 content_height:510,font_scale:1,density:"comfortable" as const};
test("flat published chapters I, II, III become source-preserving starts of new pages",()=>{
 const units=[body("before"),paragraph("n1","I",35),paragraph("t1","THE EXPERIMENT",45),body("first"),
  body("middle"),paragraph("n2","II",35),paragraph("t2","MR. CLARKE’S MEMOIRS",45),body("second"),
  body("later"),paragraph("n3","III",35),paragraph("t3","THE CITY OF RESURRECTIONS",45),body("third")];
 const snapshot=JSON.stringify(units);
 const projected=projectFlatChapterHeadings(units);
 assert.equal(projected.filter(x=>x.layout_role==="chapter_number").length,3);
 assert.equal(projected.filter(x=>x.layout_role==="chapter_title").length,3);
 assert.equal(JSON.stringify(units),snapshot,"do not modify source units");
 const pages=paginateSemanticUnits(units,layout);
 for(const id of ["n1","n2","n3"]){
  const page=pages.find(p=>p.units.some(u=>u.id===id));
  assert(page, "missing "+id);
  assert.equal(page.units[0].id,id,"chapter starts at top of page");
  const idx=pages.indexOf(page);
  assert(pages[idx].units.some(x=>x.layout_role==="chapter_title"),"chapter title grouped with numeral");
  assert(pages[idx].units.some(x=>x.kind==="paragraph"&&!x.layout_role),"opening body stays with chapter title");
 }
 assert.deepEqual(pages.flatMap(p=>p.units).map(u=>u.fragment?.original_unit_id??u.id)
  .filter((x,i,a)=>i===0||x!==a[i-1]).filter(x=>!x.startsWith("body")),[]);
});
test("no chapter inference for Roman numeral without following uppercase heading or TOC entry",()=>{
 const units=[paragraph("roman","I",25),body("after"),paragraph("toc","CHAPTER II. SOMETHING",28),body("body")];
 assert(projectFlatChapterHeadings(units).every(x=>!x.layout_role));
});
test("cover has zero viewport-driven minimum and no nested scrollbar",()=>{
 const css=readFileSync(new URL("../components/reader/semantic-public-reader.css",import.meta.url),"utf8");
 assert.match(css,/semantic-reader__front-page.*semantic-reader__title-page\{/);
 assert.match(css,/min-height:0!important/);
 assert.match(css,/semantic-reader__chapter-number/);
 assert.match(css,/semantic-reader__chapter-title/);
});
