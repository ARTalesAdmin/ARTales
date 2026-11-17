import {strict as assert} from "node:assert";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {paginateSemanticUnits,semanticPageEndFillThreshold,verifySemanticPageCoverage,rebalanceShortSemanticPageTail,shouldJustifySemanticPageEnd,fittingSemanticPageRows,chooseSemanticFittingRowCut} from "../lib/semantic/readerProjection";
import {segmentSemanticProse,semanticWordRanges} from "../lib/semantic/protectedSpans";
import {projectSemanticProseText} from "../lib/semantic/displayText";
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

test("period and semicolon are the only 80 percent discretionary page endings",()=>{
 assert.equal(semanticPageEndFillThreshold("sentence"),.8);
 assert.equal(semanticPageEndFillThreshold("semicolon"),.8);
 assert.equal(semanticPageEndFillThreshold("comma"),Infinity);
 assert.equal(semanticPageEndFillThreshold("word"),Infinity);
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

test("every DOM-fitted paragraph cut becomes an actual physical page boundary",()=>{
 const raw=Array.from({length:95},(_,i)=>
  "Clarke observed an ordinary event "+i+"; yet the investigation continued. ").join("");
 const source=paragraph("boundary",raw,9000);
 const measure=(fragment:SemanticPageUnit)=>{
  if(!fragment.fragment)return null;
  const length=fragment.fragment.end-fragment.fragment.start;
  const lines=Math.max(1,Math.ceil(length/48));
  return {height:12+lines*27,last_line_top:(lines-1)*27,
   last_line_fill:Math.min(1,(length%48||48)/48)};
 };
 const layout={
  mode:"paged" as const,viewport_width:420,viewport_height:440,
  content_height:170,font_scale:1,density:"comfortable" as const,
  measured_unit_heights:{boundary:9000},
  // Match the public client: geometry AND fragment height are supplied.
  measure_fragment_geometry:measure,
  measure_fragment_height:(fragment:SemanticPageUnit)=>measure(fragment)?.height??null,
 };
 const pages=paginateSemanticUnits([source],layout);
 assert(pages.length>10);
 assert.equal(verifySemanticPageCoverage([source],pages).ok,true);
 // The paginator must NEVER cut the paragraph twice on the same page
 // and rejoin them during flush(), overriding the selected typography.
 for(const page of pages){
  assert.equal(page.units.length,1,
   "A measured page cut was followed by another same-page paragraph fragment");
  assert(page.estimated_height<=170,"Measured page overflow");
  const fragment=page.units[0];
  assert(fragment.fragment,"Expected a source-anchored page fragment");
  const sourceLength=fragment.fragment.end-fragment.fragment.start;
  const lineCount=Math.max(1,Math.ceil(sourceLength/48));
  const measuredFullHeight=12+lineCount*27;
  assert.equal(page.estimated_height,measuredFullHeight,
   "A physical page break was bypassed and multiple fragment heights were coalesced");
 }
});

test("natural row width controls page ending; visible Reader enforces bounded 83 percent justification",()=>{
 const projection=read("lib/semantic/readerProjection.ts");
 const client=read("components/reader/SemanticReaderClient.tsx");
 const css=read("components/reader/semantic-public-reader.css");
 assert.match(projection,/chooseSemanticFittingRowCut/);
 assert.match(projection,/shouldJustifySemanticPageEnd/);
 assert.match(client,/measureSemanticDomLastRow\(paragraph\)/);
 assert.match(client,/paragraph.classList.add\("semantic-reader__fragment--justify-last"\)/);
 assert.match(css,/text-align-last:start/);
 assert.equal(shouldJustifySemanticPageEnd(.95,7,470,true),true);
 assert.equal(shouldJustifySemanticPageEnd(.82,7,470,true),false);
 assert.equal(shouldJustifySemanticPageEnd(.95,3,470,true),false);
});

test("source-identical segments preserve length and protected phrases across fragment breaks",()=>{
 const raw="Dr. Raymond met Mr. Clarke; I had seen the valley.";
 for(const piece of [raw,raw.slice(0,20),raw.slice(20)]){
  const segments=segmentSemanticProse(piece,["Dr. Raymond"]);
  assert.equal(segments.map(part=>part.text).join(""),projectSemanticProseText(piece));
 }
 assert(segmentSemanticProse(raw,["Dr. Raymond"]).some(s=>s.protected&&s.text==="Dr. Raymond"));
});

test("continuation justification is gated by measured word spacing, never by punctuation",()=>{
 assert.equal(shouldJustifySemanticPageEnd(.95,7,470,true),true);
 assert.equal(shouldJustifySemanticPageEnd(.88,7,470,true),false);
 assert.equal(shouldJustifySemanticPageEnd(.24,3,470,true),false);
 assert.equal(shouldJustifySemanticPageEnd(.95,7,470,false),false);
 assert.equal(shouldJustifySemanticPageEnd(null,7,470,true),false);
});

test("real paginator retains all height-fitting text instead of discarding sparse last row",()=>{
 const raw="Look about you, Clarke. You see the mountain and the hill, and the woods. "+
  "I do know, Clarke, that you and I shall see it lifted this very night "+
  "from before another's eyes. You may think this all strange nonsense; "+
  "it may be strange, but it is true, and the ancients knew what lifting the veil means.";
 const wordStart=raw.indexOf("nonsense;");
 const afterWord=wordStart+"nonsense; ".length;
 assert(wordStart>0&&afterWord<raw.length);
 const source=paragraph("nonsense-case",raw,1000);
 const geometry=(unit:SemanticPageUnit)=>{
  if(!unit.fragment)return null;
  const {start,end}=unit.fragment;
  if(start>0)return {height:80,last_line_top:50,last_line_fill:.92,last_line_words:9};
  if(end<=wordStart)return {height:110,last_line_top:75,last_line_fill:.91,last_line_words:9};
  if(end<=afterWord)return {height:137,last_line_top:104,last_line_fill:.16,last_line_words:1};
  return {height:175,last_line_top:133,last_line_fill:.63,last_line_words:6};
 };
 const pages=paginateSemanticUnits([source],{
  mode:"paged",viewport_width:470,viewport_height:440,content_height:160,
  font_scale:1,density:"comfortable",
  measured_unit_heights:{"nonsense-case":1000},
  measure_fragment_geometry:geometry,
  measure_fragment_height:part=>geometry(part)?.height??null,
 });
 assert(pages.length>=2);
 assert.equal(verifySemanticPageCoverage([source],pages).ok,true);
 const first=pages[0].units.at(-1)?.fragment;
 assert(first,"First page must finish with a fragment");
 assert(first.end>=afterWord,"The last height-fitting word must not be discarded");
 assert(first.page_end_fill!==undefined&&first.page_end_fill<.8);
 assert.equal(first.justify_last_line,false);
});

test("actual DOM word-range detector counts the words on last rows",()=>{
 const line="You may think this all strange nonsense;";
 const ranges=semanticWordRanges(line);
 assert.equal(ranges.length,7);
 assert.deepEqual(ranges.map(x=>line.slice(x.start,x.end)),
  ["You","may","think","this","all","strange","nonsense;"]);
 assert.equal(semanticWordRanges("").length,0);
 assert.deepEqual(semanticWordRanges("  a\tword\nnext ").map(x=>
  "  a\tword\nnext ".slice(x.start,x.end)),["a","word","next"]);
});

test("short trailing row selects fullest legal candidate on the preceding physical line",()=>{
 const measured=[
  {lineTop:29,lineFill:.99},
  {lineTop:59,lineFill:.72},
  {lineTop:59,lineFill:.91},
  {lineTop:88,lineFill:.17},
 ];
 assert.equal(rebalanceShortSemanticPageTail(3,29,index=>measured[index]),2);
});

test("rows-first pagination cuts only after whole browser rows and preserves source",()=>{
 const raw=Array.from({length:100},(_,i)=>"Sentence "+i+" was read aloud; other words followed. ").join("");
 const source=paragraph("rows-first",raw,9000);
 let wholeRowMeasures=0;
 let candidates=0;
 const rows=(unit:SemanticPageUnit)=>{
  wholeRowMeasures++;
  const start=unit.fragment?.start??0;
  const stop=unit.fragment?.end??raw.length;
  const output:Array<{sourceEnd:number;top:number;bottom:number;fill:number;words:number}>=[];
  let top=0;
  // Model immutable source rows, never a guess based on split candidates.
  const text=raw.slice(start,stop);
  let lineLength=0,lastWordEnd=0;
  for(const match of text.matchAll(/\S+/g)){
   if(lineLength>0&&match.index!+match[0].length-lastWordEnd>70){
    top+=27;
    output.push({sourceEnd:start+lastWordEnd,
      top:top-24,bottom:top,fill:.9,words:8});
    lineLength=0;
   }
   lineLength+=match[0].length+1;
   lastWordEnd=match.index!+match[0].length;
   if(lineLength>=64){
    top+=27;
    output.push({sourceEnd:start+lastWordEnd,
      top:top-24,bottom:top,fill:.9,words:8});
    lineLength=0;
   }
  }
  if(lineLength){
   top+=27;output.push({sourceEnd:start+lastWordEnd,top:top-24,bottom:top,fill:.9,words:8});
  }
  return output;
 };
 const pageHeight=170;
 const measurement=(f:SemanticPageUnit)=>{
  if(!f.fragment)return null;
  candidates++;
  const length=f.fragment.end-f.fragment.start;
  const lines=Math.ceil(length/70);
  return {height:lines*27,last_line_top:(lines-1)*27,
   last_line_fill:.9,last_line_words:8};
 };
 const probeRows=rows(source);
 const boundarySet=new Set([...raw.matchAll(/\s+/g)].map(m=>m.index!+m[0].length));
 const probed=fittingSemanticPageRows(probeRows,raw,0,raw.length,pageHeight,boundarySet,8,8);
 assert(probed.length>0,JSON.stringify({probeRows:probeRows.slice(0,6),probed,
  legal:[...boundarySet].slice(0,25)}));
 const pages=paginateSemanticUnits([source],{
  mode:"paged",viewport_width:470,viewport_height:440,content_height:pageHeight,
  font_scale:1,density:"comfortable",measured_unit_heights:{"rows-first":9000},
  measure_paragraph_rows:rows,
  measure_fragment_geometry:measurement,
  measure_fragment_height:f=>measurement(f)?.height??null,
 });
 assert(pages.length>5,JSON.stringify({pages:pages.length,measures:wholeRowMeasures,candidates,indices:pages.map(p=>p.units.map(u=>u.fragment&&[u.fragment.start,u.fragment.end]))}));
 assert(wholeRowMeasures>=pages.length-1);
 assert(candidates<wholeRowMeasures*9,"Should verify row candidates, not bisect every word");
 assert.equal(verifySemanticPageCoverage([source],pages).ok,true);
 assert(pages.every(page=>page.estimated_height<=pageHeight));
});

test("physical row selector does not silently split within protected terms or leave tiny tails",()=>{
 const raw="The long opening continues along the road; and the final passage follows.";
 const white=[...raw.matchAll(/\s+/g)].map(m=>m.index!+m[0].length);
 const rows=[
  {sourceEnd:17,top:0,bottom:24,fill:.94,words:3},
  {sourceEnd:51,top:28,bottom:52,fill:.91,words:7},
  {sourceEnd:61,top:56,bottom:80,fill:.12,words:1},
 ];
 const actual=fittingSemanticPageRows(rows,raw,0,raw.length,100,new Set(white),8,7);
 assert(actual.every(row=>white.includes(row.end)));
 assert(actual.every(row=>row.bottom<=94));
 assert(actual.length>=1);
 const rejected=fittingSemanticPageRows(rows,raw,0,raw.length,25,new Set(white),8,7);
 assert.equal(rejected.length,0);
});

test("period or semicolon only cuts current last row at natural 80 percent fill",()=>{
 const raw="Reading is a pleasure; and another sentence continues across the rest of the line.";
 const afterSemicolon=raw.indexOf(";")+2;
 const atSemicolon=raw.indexOf(";")+1;
 const row={sourceEnd:raw.indexOf(" line.")+6,end:raw.indexOf(" line.")+6,
  top:22,bottom:48,fill:.99,words:11,
  punctuationCuts:[{sourceEnd:atSemicolon,fill:.81}]};
 const chosen=chooseSemanticFittingRowCut(row,raw,0,raw.length,new Set([afterSemicolon]),[]);
 assert.equal(chosen.end,afterSemicolon);
 assert.equal(chosen.reason,"punctuation_80");
 assert.equal(chooseSemanticFittingRowCut({...row,punctuationCuts:[{sourceEnd:atSemicolon,fill:.79}]},
  raw,0,raw.length,new Set([afterSemicolon]),[]).reason,"latest_row");
 const comma=raw.replace("; ",", ");
 const afterComma=comma.indexOf(",")+2;
 assert.equal(chooseSemanticFittingRowCut({...row,punctuationCuts:[{sourceEnd:comma.indexOf(",")+1,fill:.95}]},
  comma,0,comma.length,new Set([afterComma]),[]).reason,"latest_row");
});

test("public Reader never shrinks every sheet for one overflow",()=>{
 const reader=read("components/reader/SemanticReaderClient.tsx");
 assert.doesNotMatch(reader,/capacityPenalty|setCapacityPenalty/);
 assert.match(reader,/measuredCapacity:pageContentHeight/);
 assert.match(reader,/setScrollFallbackPages\(old=>/);
 assert.match(reader,/semanticInkOverflowPx/);
});
