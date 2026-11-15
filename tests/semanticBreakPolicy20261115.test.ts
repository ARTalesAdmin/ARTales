import {test} from "node:test";
import {strict as assert} from "node:assert";
import {assessSemanticPageBreak,paginateSemanticUnits,verifySemanticPageCoverage} from "../lib/semantic/readerProjection";
import {getProtectedTextSpans} from "../lib/semantic/protectedSpans";
import type {SemanticPageUnit} from "../lib/semantic/model";

test("semantic break policy blocks protected spans and mid-word cuts",()=>{
 const raw="Dr. Raymond went to the garden; then he returned.";
 const spans=getProtectedTextSpans(raw,["Dr. Raymond"]);
 const inside=raw.indexOf("Raymond");
 assert.equal(assessSemanticPageBreak(raw,0,inside,raw.length,spans).allowed,false);
 assert.equal(assessSemanticPageBreak(raw,0,raw.indexOf("gard")+2,raw.length,spans).allowed,false);
 const after=raw.indexOf("garden;")+"garden; ".length;
 assert.equal(assessSemanticPageBreak(raw,0,after,raw.length,spans).reason,"semicolon");
});
test("soft preferences and safe fallback",()=>{
 const raw="A tale was told; this continued into another sentence, and then ended.";
 const semi=raw.indexOf(";")+2;
 const clause=raw.indexOf(",")+2;
 const word=raw.indexOf("another")+"another ".length;
 const scores=[semi,clause,word].map(end=>assessSemanticPageBreak(raw,0,end,raw.length));
 assert(scores.every(x=>x.allowed));
 assert(scores[0].preference>scores[1].preference);
 assert(scores[1].preference>scores[2].preference);
 const hanging="The man and the stranger";
 const end=hanging.indexOf("stranger");
 const assessment=assessSemanticPageBreak(hanging,0,end,hanging.length);
 assert.equal(assessment.allowed,true);
 assert(assessment.preference<0);
});
function paragraph(id:string,raw:string):SemanticPageUnit{
 return {id,kind:"paragraph",chapter_id:null,source_atom_ids:[id],estimated_height:6000,
 node:{id,kind:"paragraph",atom:{id,raw,marks:[],source_sha256:"test",anchor:{
 snapshot_ref:"fixture",component_id:"fixture",normalized_start:0,
 normalized_end:raw.length,original_byte_start:0,original_byte_end:Buffer.byteLength(raw)}}}};
}
test("generic fragments preserve source and editorial protected terms",()=>{
 const raw=Array.from({length:70},(_,i)=>"Dr. Raymond documented event "+i+"; the garden was quiet, and the wind persisted. ").join("");
 const units=[paragraph("long",raw)];
 const pages=paginateSemanticUnits(units,{mode:"paged",viewport_width:360,viewport_height:520,
   content_height:390,font_scale:1,density:"comfortable",
   protected_terms:["Dr. Raymond"],
   measure_fragment_height:u=>u.fragment?Math.ceil((u.fragment.end-u.fragment.start)/42)*27:null});
 assert(pages.length>2);
 assert.equal(verifySemanticPageCoverage(units,pages).ok,true);
 assert(pages.flatMap(p=>p.units).every(u=>!u.fragment||!getProtectedTextSpans(raw,["Dr. Raymond"])
   .some(span=>span.start<u.fragment!.end&&u.fragment!.end<span.end)));
});
