import {test} from "node:test";
import {strict as assert} from "node:assert";
import {assessSemanticPageBreak,chooseSemanticFittingRowCut,semanticPageEndFillThreshold,paginateSemanticUnits,verifySemanticPageCoverage} from "../lib/semantic/readerProjection";
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


test("one shared measured rule prefers a 76%-filled sentence over hanging 'But the'",()=>{
 const raw="The people carefully considered the long explanation. But the extraordinarily detailed continuation is still here.";
 const period=raw.indexOf(".")+1;
 const lineEnd=raw.indexOf("But the")+"But the".length;
 const legalEnds=new Set([...raw.matchAll(/\s+/g)].map(m=>m.index!+m[0].length));
 const spans=getProtectedTextSpans(raw);
 const row={sourceEnd:lineEnd,end:lineEnd,top:0,bottom:26,fill:.98,words:12,
  punctuationCuts:[{sourceEnd:period,fill:.76}]};
 const fallback=assessSemanticPageBreak(raw,0,lineEnd+1,raw.length,spans);
 assert.equal(fallback.allowed,true);
 assert.ok(fallback.preference<0,"hanging article must carry a penalty");
 const chosen=chooseSemanticFittingRowCut(row,raw,0,raw.length,legalEnds,spans);
 assert.equal(chosen.reason,"punctuation_80"); // existing stable reason identifier
 assert.equal(chosen.end,raw.indexOf(" But the")+1);
 assert.equal(chosen.fill,.76);
 assert.equal(semanticPageEndFillThreshold("sentence"),.8);
 assert.equal(semanticPageEndFillThreshold("sentence",true),.72);
});
test("do not make a 72%-80% punctuation cut unless the alternative hangs",()=>{
 const long="The people carefully considered the long explanation. But there was more to discuss much later.";
 const mark=long.indexOf(".")+1;
 const rowEnd=long.indexOf("But there")+"But there".length;
 const legal=new Set([...long.matchAll(/\s+/g)].map(m=>m.index!+m[0].length));
 const row={sourceEnd:rowEnd,end:rowEnd,top:0,bottom:28,fill:.96,words:11,
  punctuationCuts:[{sourceEnd:mark,fill:.76}]};
 const selected=chooseSemanticFittingRowCut(row,long,0,long.length,legal,getProtectedTextSpans(long));
 assert.equal(selected.reason,"latest_row");
 assert.equal(selected.end,rowEnd);
 const hanging="The people carefully considered the long explanation. But the extraordinarily detailed continuation is still here.";
 const end=hanging.indexOf("But the")+"But the".length;
 const legal2=new Set([...hanging.matchAll(/\s+/g)].map(m=>m.index!+m[0].length));
 const punctuation=hanging.indexOf(".")+1;
 const under=chooseSemanticFittingRowCut({...row,end,sourceEnd:end,
  punctuationCuts:[{sourceEnd:punctuation,fill:.71}]},
 hanging,0,hanging.length,legal2,getProtectedTextSpans(hanging));
 assert.equal(under.reason,"latest_row","never sacrifice almost a third of a line");
 assert.equal(semanticPageEndFillThreshold("word",true),Infinity);
});
test("protected spans and earlier rows cannot become an exception to the 80% rule",()=>{
 const raw="Dr. Raymond described a complex situation. But the unusually long follow-up remained.";
 const period=raw.indexOf(".")+1;
 const last=raw.indexOf("But the")+"But the".length;
 const allowed=new Set([...raw.matchAll(/\s+/g)].map(m=>m.index!+m[0].length));
 const spans=getProtectedTextSpans(raw,["Dr. Raymond"]);
 const chosen=chooseSemanticFittingRowCut({
  sourceEnd:last,end:last,top:0,bottom:30,fill:.98,words:12,
  punctuationCuts:[{sourceEnd:period,fill:.76}],
 },raw,0,raw.length,allowed,spans);
 assert.equal(chosen.reason,"latest_row","abbreviation inside protected name is not a sentence end");
});
