"""Run the repository's actual TS paginator inside Chromium on real Pan prose.
This is NOT a production E2E test; it measures browser DOM without credentials.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT=Path("reader-chromium-artifacts")
OUT.mkdir(exist_ok=True)
JS=r"""() => {
 const engine=window.ARTalesPageEngine;
 if(!engine?.iterateSemanticPages)throw Error("Bundled paginator unavailable");
 // Regression: two-column CSS grid can compress a nominal 470px paper to 455px.
 // Offscreen measurements MUST use the rendered grid track and wrap identically.
 const parityHost=document.createElement("div");
 parityHost.style.cssText="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:910px;";
 const parityPaper=document.createElement("div");
 parityPaper.style.cssText="width:470px;max-width:100%;box-sizing:border-box;";
 parityHost.append(parityPaper);document.body.append(parityHost);
 const parityMeasure=document.createElement("div");
 parityMeasure.style.cssText="position:absolute;left:-10000px;width:470px;";
 document.body.append(parityMeasure);
 const width=engine.syncSemanticMeasurementPaperWidth(parityMeasure,parityPaper);
 if(width===null||Math.abs(width-455)>.5||
   Math.abs(parityMeasure.getBoundingClientRect().width-width)>.5)
  throw Error("Offscreen paper does not match the physical grid track: "+width);
 const sentence="A long opening paragraph continues through the town, speaking of stories, "+
  "winds, names, people, places and the long journey across the world. ".repeat(6);
 const visibleText=document.createElement("p");
 visibleText.className="fixture-prose";
 visibleText.style.width="100%";
 visibleText.textContent=sentence;
 const hiddenText=visibleText.cloneNode(true);
 parityPaper.append(visibleText);parityMeasure.append(hiddenText);
 const actual=engine.measureSemanticDomRows(visibleText,0,visibleText);
 const predicted=engine.measureSemanticDomRows(hiddenText,0,hiddenText);
 if(actual.length!==predicted.length||
   actual.some((row,i)=>row.sourceEnd!==predicted[i].sourceEnd||
    Math.abs(row.bottom-predicted[i].bottom)>.5))
  throw Error("Measured line breaks disagree with the visible two-column paper");
 parityHost.remove();parityMeasure.remove();
 const raw="“Look about you, Clarke. You see the mountain, and hill following after\n"
 +"hill, as wave on wave, you see the woods and orchard, the fields of ripe corn,\n"
 +"and the meadows reaching to the reed-beds by the river. You see me standing\n"
 +"here beside you, and hear my voice; but I tell you that all these\n"
 +"things—yes, from that star that has just shone out in the sky to the\n"
 +"solid ground beneath our feet—I say that all these are but dreams and\n"
 +"shadows; the shadows that hide the real world from our eyes. There is a\n"
 +"real world, but it is beyond this glamour and this vision, beyond these\n"
 +"‘chases in Arras, dreams in a career,’ beyond them all as beyond a\n"
 +"veil. I do not know whether any human being has ever lifted that veil; but I do\n"
 +"know, Clarke, that you and I shall see it lifted this very night from before\n"
 +"another’s eyes. You may think this all strange nonsense; it may be\n"
 +"strange, but it is true, and the ancients knew what lifting the veil means.\n"
 +"They called it seeing the god Pan.”";
 const id="pan-paragraph-32";
 const unit={id,kind:"paragraph",chapter_id:null,source_atom_ids:[id],
  estimated_height:2000,
  node:{id,kind:"paragraph",atom:{id,raw,marks:[],
  anchor:{normalized_start:0,normalized_end:raw.length}}}};
 const measureRoot=document.querySelector("#fixture-measure");
 function geometry(frag){
  if(!frag.fragment)return null;
  const p=document.createElement("p");p.className="fixture-prose";
  const text=raw.slice(frag.fragment.start,frag.fragment.end);
  for(const s of engine.segmentSemanticProse(text,[])){
   if(s.protected){
    const span=document.createElement("span");
    span.style.whiteSpace="nowrap";span.textContent=s.text;p.append(span);
   }else p.append(document.createTextNode(s.text));
  }
  measureRoot.append(p);
  const rect=p.getBoundingClientRect();
  const nodeWalk=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);
  let lastTop=-Infinity,lastRight=rect.left,words=0,wordRects=[];
  while(nodeWalk.nextNode()){
   const node=nodeWalk.currentNode,text=node.textContent;
   for(const m of text.matchAll(/\S+/gu)){
    const range=document.createRange();
    range.setStart(node,m.index);range.setEnd(node,m.index+m[0].length);
    for(const b of range.getClientRects()){
     if(b.width<.2)continue;
     wordRects.push({top:b.top,right:b.right});
     if(b.top>lastTop+1.5){lastTop=b.top;lastRight=b.right;}
     else if(Math.abs(b.top-lastTop)<1.5)lastRight=Math.max(lastRight,b.right);
    }
   }
  }
  words=wordRects.filter(v=>Math.abs(v.top-lastTop)<1.5).length;
  const value={height:rect.height,last_line_top:lastTop-rect.top,
    last_line_fill:Math.max(0,Math.min(1,(lastRight-rect.left)/rect.width)),
    last_line_words:words};
  p.remove();return value;
 }
 // Verify the EXACT DOM measurement helper returns natural word fill.
 // The test intentionally includes multiple physical rows and inline spans.
 const verify=document.createElement("p");
 verify.className="fixture-prose";
 verify.textContent="A long demonstration paragraph that consumes enough horizontal space to wrap across lines naturally. "+
  "This passage then continues with more words to reach the next rendered physical row; "+
  "world of matter";
 measureRoot.append(verify);
 const actualRow=engine.measureSemanticDomLastRow(verify);
 const actualWords=verify.textContent.trim().match(/\S+/gu)?.length??0;
 if(!actualRow||actualRow.words<1||actualRow.words>=actualWords||
    actualRow.fill<=0||actualRow.fill>1){
  throw Error("Measured last DOM row is not a valid physical line: "+JSON.stringify(actualRow));
 }
 // A last row with too few words must never receive forced justification,
 // regardless of page or chapter; this specifically guards 'world of matter'.
 if(engine.shouldJustifySemanticPageEnd(.93,3,470,true)||
    engine.shouldJustifySemanticPageEnd(.32,7,470,true)){
  throw Error("Unsafe continuation line was allowed to stretch");
 }
 verify.remove();
 // Assert the actual Chromium line detector exposes the semicolon position
 // as a source offset; a synthetic fill score would not test this contract.
 const punctuationSource="The story continues along the old village road; and then turns.";
 const punctParagraph=document.createElement("p");
 punctParagraph.className="fixture-prose";
 punctParagraph.textContent=punctuationSource;
 measureRoot.append(punctParagraph);
 const measuredPunct=engine.measureSemanticDomRows(punctParagraph,0,punctParagraph);
 punctParagraph.remove();
 const semicolonEnd=punctuationSource.indexOf(";")+1;
 if(!measuredPunct.some(row=>row.punctuationCuts?.some(mark=>mark.sourceEnd===semicolonEnd&&
      mark.fill>0&&mark.fill<=1))){
  throw Error("Chromium punctuation position missing from physical row geometry");
 }
 // Same paragraph is laid out once as an uncut remainder before
 // choosing any page fragment. This is the production rows-first path.
 function measureRows(unit){
  const from=unit.fragment?.start??0;
  const until=unit.fragment?.end??raw.length;
  const p=document.createElement("p");p.className="fixture-prose";
  p.style.textAlign="start";p.style.textAlignLast="start";
  const content=document.createElement("span");
  content.className="semantic-reader__atom";
  for(const part of engine.segmentSemanticProse(raw.slice(from,until),[])){
   if(!part.protected){content.append(document.createTextNode(part.text));continue;}
   const span=document.createElement("span");
   span.style.whiteSpace="nowrap";span.textContent=part.text;content.append(span);
  }
  p.append(content);measureRoot.append(p);
  const result=engine.measureSemanticDomRows(p,from,content);
  p.remove();
  return result;
 }
 const sample=measureRows(unit).slice(0,12);
 const legalEnds=new Set([...raw.matchAll(/\s+/g)].map(m=>m.index+m[0].length));
 const rowDebug=sample.map(row=>{
  let end=row.sourceEnd;
  while(end<raw.length&&/\s/u.test(raw[end]))end++;
  return {sourceEnd:row.sourceEnd,end,legal:legalEnds.has(end),
   decision:engine.assessSemanticPageBreak(raw,0,end,raw.length,[]).reason,
   at:JSON.stringify(raw.slice(end-8,end+12)),
   bottom:row.bottom,fill:row.fill};
 });
 const testFit=engine.fittingSemanticPageRows(measureRows(unit),raw,0,raw.length,180,
  new Set([...raw.matchAll(/\s+/g)].map(m=>m.index+m[0].length)),8,8);
 const fitDebug={validRows:testFit.length,first:testFit.slice(0,3)};
 const fullRows=measureRows(unit);
 const naturalHeight=(fullRows.at(-1)?.bottom??0)+10;
 const capacities=[180,225,270,315,360,400,445,480,510,540,570,600,630];
 const output=[];
 for(const height of capacities){
  const pages=[...engine.iterateSemanticPages([unit],{
   mode:"paged",viewport_width:470,viewport_height:Math.max(340,height+100),
   content_height:height,font_scale:1,density:"comfortable",
   measured_unit_heights:{[id]:naturalHeight},measure_fragment_geometry:geometry,
   measure_fragment_height:f=>geometry(f)?.height??null,
   measure_paragraph_rows:measureRows,protected_terms:[]
  })];
  const coverage=engine.verifySemanticPageCoverage([unit],pages);
  const records=pages.map(page=>page.units.map(u=>{
   const g=geometry(u);
   const text=raw.slice(u.fragment?.start??0,u.fragment?.end??raw.length);
   const last=text.trim().split(/\s+/).at(-1);
   return {start:u.fragment?.start??0,end:u.fragment?.end??raw.length,
    fill:g?.last_line_fill??null,wordCount:g?.last_line_words??null,last,
    reason:u.fragment?.page_end_reason??null};
  }));
  output.push({height,pages:pages.length,coverage:coverage.ok,
   overflow:pages.some(p=>p.overflow!=="none"||p.estimated_height>height+1),records});
 }
 // Whole-leaf regression: different paragraphs share a page. Their margins
 // must be measured together, not summed from isolated fragment heights.
 const prefixText="An old book opens with a description of the evening sky and a long walk. "+
  "The characters arrive at a house beyond the river.";
 const prefixId="fixture-prefix";
 const prefix={id:prefixId,kind:"paragraph",chapter_id:null,source_atom_ids:[prefixId],
  estimated_height:110,node:{id:prefixId,kind:"paragraph",atom:{id:prefixId,raw:prefixText,
   marks:[],anchor:{normalized_start:0,normalized_end:prefixText.length}}}};
 let aggregateMeasurements=0;
 function combinedHeight(units){
  aggregateMeasurements++;
  const probe=document.createElement("div");
  probe.style.cssText="position:absolute;left:-10000px;top:0;width:470px;";
  for(const unit of units){
   const block=document.createElement("div");
   block.style.display="flow-root";
   const p=document.createElement("p");
   p.className="fixture-prose";
   p.style.width="100%";
   p.style.marginBottom="24px";
   const src=unit.node.atom.raw;
   const from=unit.fragment?.start??0,end=unit.fragment?.end??src.length;
   for(const part of engine.segmentSemanticProse(src.slice(from,end),[])){
    if(part.protected){
     const span=document.createElement("span");
     span.style.whiteSpace="nowrap";span.textContent=part.text;p.append(span);
    }else p.append(document.createTextNode(part.text));
   }
   block.append(p);probe.append(block);
  }
  document.body.append(probe);
  const last=probe.querySelector("div:last-child p");
  if(last)last.style.marginBottom="0px";
  const height=Math.ceil(probe.getBoundingClientRect().height*2)/2;
  probe.remove();return height;
 }
 const aggregate=[];
 for(const height of [220,315,420,520]){
  const composed=[...engine.iterateSemanticPages([prefix,unit],{
   mode:"paged",viewport_width:470,viewport_height:Math.max(340,height+100),
   content_height:height,font_scale:1,density:"comfortable",
   measured_unit_heights:{[prefixId]:110,[id]:naturalHeight},
   measure_fragment_geometry:geometry,
   measure_fragment_height:f=>geometry(f)?.height??null,
   measure_paragraph_rows:u=>u.id===prefixId?null:measureRows(u),
   measure_page_height:combinedHeight,protected_terms:[]
  })];
  const verified=engine.verifySemanticPageCoverage([prefix,unit],composed).ok;
  const heights=composed.map(page=>combinedHeight(page.units));
  aggregate.push({height,pages:composed.length,verified,
   maxMeasured:Math.max(...heights),noScroll:composed.every(page=>page.overflow==="none"),
   physicallyFits:heights.every(h=>h<=height-2)});
 }
 if(aggregateMeasurements<8)throw Error("Whole-page DOM measurement callback unused");
 return {output,aggregate,sourceLength:raw.length,naturalHeight,rowDebug,fitDebug};
}""";

with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=["--no-sandbox"])
 page=browser.new_page(viewport={"width":1366,"height":768})
 page.set_content("""<style>
 #fixture-measure{position:absolute;left:-10000px;width:470px;}
 .fixture-prose{box-sizing:border-box;width:470px;margin:0;font:18px/1.62 Georgia,serif;
 text-align:justify;text-align-last:start;text-wrap:wrap;word-spacing:normal;
 hyphens:manual;word-break:normal;overflow-wrap:normal;white-space:normal;}
 </style><div id="fixture-measure"></div>""")
 page.add_script_tag(path="reader-chromium-artifacts/paginator-bundle.js")
 result=page.evaluate(JS)
 browser.close()
(OUT/"fixture-results.json").write_text(json.dumps(result,indent=2,ensure_ascii=False))
bad=[]
for item in result["aggregate"]:
 if not item["verified"] or not item["noScroll"] or not item["physicallyFits"]:
  bad.append(f"Whole-leaf fit failed: {item}")
for item in result["output"]:
 if not item["coverage"]:
  bad.append(f"Source coverage failed for {item['height']}px")
 if item["overflow"]:
  bad.append(f"Physical page overflow at {item['height']}px")
 for page in item["records"][:-1]:
  for fragment in page:
   if fragment["last"]=="nonsense;" and fragment["fill"] is not None and fragment["fill"]<.43:
    bad.append(f"Isolated nonsense at height {item['height']}px: {fragment}")
print("CHROMIUM_FIXTURE_RESULTS="+json.dumps({
 "sourceLength":result["sourceLength"],"naturalHeight":result["naturalHeight"],
 "aggregate":result["aggregate"],
 "rows":result["rowDebug"],"fit":result["fitDebug"],
 "pagesByHeight":[{"height":p["height"],"pageCount":p["pages"],"coverage":p["coverage"],"overflow":p["overflow"]}
                  for p in result["output"]],
 "bad":bad},ensure_ascii=False))
if all(item["pages"]<=1 for item in result["output"][:5]):
 bad.append("Chromium rendered a long paragraph as one unsplit page at every short content height")
if bad:raise AssertionError(str(bad))
