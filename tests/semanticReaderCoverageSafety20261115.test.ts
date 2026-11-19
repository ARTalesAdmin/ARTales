import {test} from "node:test";
import {strict as assert} from "node:assert";
import {paginateSemanticUnits,verifySemanticPageCoverage} from "../lib/semantic/readerProjection";
import type {SemanticPageUnit} from "../lib/semantic/model";

function paragraph(id:string,raw:string,height:number):SemanticPageUnit {
 return {id,kind:"paragraph",chapter_id:null,source_atom_ids:[id],estimated_height:height,
  node:{id,kind:"paragraph",atom:{id,raw,marks:[],source_sha256:"fixture",
  anchor:{snapshot_ref:"fixture",component_id:"fixture",normalized_start:0,normalized_end:raw.length,
    original_byte_start:0,original_byte_end:Buffer.byteLength(raw)}}}};
}
const layout={mode:"paged" as const,viewport_width:400,viewport_height:600,content_height:450,
 font_scale:1,density:"comfortable" as const,
 measure_fragment_height:(p:SemanticPageUnit)=>p.fragment?Math.ceil((p.fragment.end-p.fragment.start)/43)*30:null};
test("complete source coverage is independently verified across multiple leaves",()=>{
 const units=[
  paragraph("a",("Before the summer ended; another sentence followed. ").repeat(75),6000),
  paragraph("b","The final paragraph closes the volume.",48),
 ];
 const pages=paginateSemanticUnits(units,layout);
 assert(pages.length>3);
 assert.equal(verifySemanticPageCoverage(units,pages).ok,true);
 const fragments=pages.flatMap(page=>page.units);
 const source=fragments.filter(x=>x.fragment?.original_unit_id==="a")
  .map(x=>units[0].node.kind==="paragraph"?units[0].node.atom.raw.slice(x.fragment!.start,x.fragment!.end):"").join("");
 assert.equal(source,(units[0].node as {atom:{raw:string}}).atom.raw);
});
test("coverage guard rejects missing, duplicated and overlapping page fragments",()=>{
 const units=[paragraph("a",("A complete sentence, followed by another; ").repeat(80),6000)];
 const pages=paginateSemanticUnits(units,layout);
 assert(pages.length>2);
 assert.doesNotThrow(()=>verifySemanticPageCoverage(units,pages));
 const clone=()=>pages.map(p=>({...p,units:p.units.map(u=>({...u,fragment:u.fragment?{...u.fragment}:undefined}))}));
 const missing=clone();missing[1].units.shift();
 assert.throws(()=>verifySemanticPageCoverage(units,missing),/gap|tail|lost|duplicated/);
 const duplicate=clone();duplicate[1].units.unshift(duplicate[0].units.at(-1)!);
 assert.throws(()=>verifySemanticPageCoverage(units,duplicate),/gap|tail|lost|duplicated/);
 const overlap=clone();const u=overlap[1].units[0];assert(u.fragment);
 u.fragment.start-=1;
 assert.throws(()=>verifySemanticPageCoverage(units,overlap),/gap|tail|lost|duplicated/);
});
test("fullscreen styling cannot change page dimensions, paper grid or line clipping policy",()=>{
 const fs=require("node:fs") as typeof import("node:fs");
 const css=fs.readFileSync(new URL("../components/reader/semantic-public-reader.css",import.meta.url),"utf8");
 const fullscreen=css.slice(css.indexOf("/* Browser fullscreen is orthogonal"));
 assert(fullscreen.includes(":fullscreen"));
 assert(!fullscreen.includes("grid-template-rows"));
 assert(!fullscreen.includes("height:var(--reader-page-height)"));
 assert(!fullscreen.includes("overflow:hidden!important"));
});
