import {strict as assert} from "node:assert";
import {test} from "node:test";
import {iterateSemanticPages,paginateSemanticUnits} from "../lib/semantic/readerProjection";
import type {SemanticPageUnit} from "../lib/semantic/model";

function prose(id:string,raw:string,height:number,kind:"paragraph"|"quote"|"footnote"|"epigraph"="paragraph"):SemanticPageUnit {
 return {id,kind,chapter_id:null,source_atom_ids:[id],estimated_height:height,
  node:{id,kind,atom:{id,raw,
   marks:[],source_sha256:"synthetic",
   anchor:{normalized_start:0,normalized_end:raw.length}}}} as SemanticPageUnit;
}
const options={mode:"paged" as const,viewport_width:360,viewport_height:460,
 font_scale:1,density:"comfortable" as const,content_height:360};
function measure(unit:SemanticPageUnit){
 if(!unit.fragment||!("atom" in unit.node))return null;
 // A synthetic deterministic stand-in for varied browser line counts.
 return Math.ceil((unit.fragment.end-unit.fragment.start)/40)*28;
}
function assertContinuity(pages:ReturnType<typeof paginateSemanticUnits>,raw:string,id:string){
 const fragments=pages.flatMap(page=>page.units)
  .filter(unit=>(unit.fragment?.original_unit_id??unit.id)===id);
 let offset=0;
 for(const fragment of fragments){
  if(fragment.fragment){
   assert.equal(fragment.fragment.start,offset,"fragment gap or overlap");
   offset=fragment.fragment.end;
   assert(offset<=raw.length);
   assert(!(/^[\\uDC00-\\uDFFF]/u.test(raw.slice(offset))),"surrogate pair split");
  }else{
   assert.equal(offset,0);
   offset=raw.length;
  }
 }
 assert.equal(offset,raw.length,"source tail lost");
}
test("resumable canonical iterator yields the same leaf sequence as eager QA",()=>{
 const raw=Array.from({length:125},(_,i)=>`The sentence ${i} waits for the next phrase; `).join("");
 const units=[prose("synthetic-long",raw,4500),prose("following","An ending follows.",60)];
 const layout={...options,measure_fragment_height:measure};
 const eager=paginateSemanticUnits(units,layout);
 const streamed=[...iterateSemanticPages(units,layout)];
 assert.deepEqual(streamed,eager);
 assertContinuity(eager,raw,"synthetic-long");
 for(const page of eager)assert(page.estimated_height<=options.content_height);
});
test("continuations never force an unnecessary mostly empty page",()=>{
 const raw=Array.from({length:115},(_,i)=>`word${i} follows another, and continues; `).join("");
 const pages=paginateSemanticUnits([
  prose("any-work",raw,3300),
  prose("following","A final block joins the preceding continuation.",70),
 ],{...options,measure_fragment_height:measure});
 assert(pages.length>3);
 assertContinuity(pages,raw,"any-work");
 assert(pages.some(page=>page.units.some(unit=>unit.id==="following")&&page.units.some(unit=>
  unit.fragment?.original_unit_id==="any-work")),
  "tail fragment should be allowed to share its leaf with the next paragraph");
 assert(pages.slice(0,-1).every(page=>page.estimated_height>=options.content_height*0.5),
  "no two-line nonterminal pages");
});
test("prose fragments support quotation, epigraph and footnote without data mutation",()=>{
 for(const kind of ["quote","epigraph","footnote"] as const){
  const raw=Array.from({length:90},(_,i)=>`Evidence ${i} is retained in the source. `).join("");
  const unit=prose(kind,raw,3500,kind);
  const pages=paginateSemanticUnits([unit],{...options,measure_fragment_height:measure});
  assert(pages.length>2,kind);
  assertContinuity(pages,raw,kind);
  assert.equal(unit.fragment,undefined);
  assert.equal((unit.node as {atom:{raw:string}}).atom.raw,raw);
 }
});
test("per-work protected phrases, UTF-16 text and multiple sizing profiles",()=>{
 const raw="👩‍🚀 Úvod Arthur Machen pokračuje; "+
  Array.from({length:95},(_,i)=>`Záznam ${i} testuje přestávku, and pokračování; `).join("");
 for(const width of [320,360,390,768,1280,1920])
 for(const scale of [0.85,1,1.3]){
  const pages=paginateSemanticUnits([prose("unicode",raw,6000)],{
   ...options,viewport_width:Math.max(200,width-36),font_scale:scale,
   measure_fragment_height:measure,protected_terms:["Arthur Machen"],
  });
  assertContinuity(pages,raw,"unicode");
  const mid=raw.indexOf("Arthur")+"Arthur ".length;
  assert(!pages.flatMap(p=>p.units).some(u=>u.fragment?.end===mid),
   "editorial protected phrase split");
 }
});
