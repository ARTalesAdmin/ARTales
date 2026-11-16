import {test} from "node:test";
import {strict as assert} from "node:assert";
import {paginateSemanticUnits,verifySemanticPageCoverage,type SemanticFragmentGeometry} from "../lib/semantic/readerProjection";
import type {SemanticPageUnit} from "../lib/semantic/model";

function paragraph(id:string,raw:string):SemanticPageUnit{
 return {id,kind:"paragraph",chapter_id:null,source_atom_ids:[id],estimated_height:2000,
  node:{id,kind:"paragraph",atom:{id,raw,marks:[],source_sha256:"synthetic",
   anchor:{snapshot_ref:"synthetic",component_id:"synthetic",normalized_start:0,
    normalized_end:raw.length,original_byte_start:0,original_byte_end:Buffer.byteLength(raw)}}}};
}
function chosenFirstCut(raw:string,lastLineStart:number,fillScale:number){
 const original=paragraph("source",raw);
 const measure=(fragment:SemanticPageUnit):SemanticFragmentGeometry|null=>{
  if(!fragment.fragment)return null;
  const end=fragment.fragment.end;
  // The geometry (not character count) tells the paginator how much the
  // LAST rendered line is occupied. Supply the same height for every split.
  return {height:end<=140?180:360,last_line_top:118,
   last_line_fill:Math.min(1,Math.max(0,(end-lastLineStart)/fillScale))};
 };
 const pages=paginateSemanticUnits([original],{
  mode:"paged",viewport_width:430,viewport_height:500,font_scale:1,
  content_height:280,density:"comfortable",measured_unit_heights:{source:2000},
  measure_fragment_geometry:measure,
  measure_fragment_height:f=>measure(f)?.height??null});
 assert.equal(verifySemanticPageCoverage([original],pages).ok,true);
 const first=pages[0].units[0].fragment;
 assert(first);
 return first.end;
}
test("natural break inside second half of physically measured last line wins",()=>{
 const words="we observe that another person arrived, and took a quiet walk through the garden; after which the whole story continued with many more words ";
 const raw=words+words+words;
 const position=raw.indexOf("garden;")+"garden; ".length;
 const cut=chosenFirstCut(raw,20,100);
 assert.equal(cut,position,"semicolon is preferable when measured in second half of visible line");
});
test("punctuation in first half cannot sacrifice rest of actual last line",()=>{
 const first="A careful sentence; ";
 const after="then the witnesses observed several separate incidents before night fell slowly ";
 const raw=first+after+after;
 const cut=chosenFirstCut(raw,0,140);
 assert(cut>first.length,"early semicolon must not shorten last line");
});
