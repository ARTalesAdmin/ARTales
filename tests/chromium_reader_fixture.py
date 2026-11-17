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
 const capacities=[180,225,270,315,360,400,445,480,510,540,570,600,630];
 const output=[];
 for(const height of capacities){
  const pages=[...engine.iterateSemanticPages([unit],{
   mode:"paged",viewport_width:470,viewport_height:Math.max(340,height+100),
   content_height:height,font_scale:1,density:"comfortable",
   measured_unit_heights:{[id]:2000},measure_fragment_geometry:geometry,
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
  output.push({height,pages:pages.length,coverage:coverage.ok,records});
 }
 return {output,sourceLength:raw.length};
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
for item in result["output"]:
 if not item["coverage"]:
  bad.append(f"Source coverage failed for {item['height']}px")
 for page in item["records"][:-1]:
  for fragment in page:
   if fragment["last"]=="nonsense;" and fragment["fill"] is not None and fragment["fill"]<.43:
    bad.append(f"Isolated nonsense at height {item['height']}px: {fragment}")
print("CHROMIUM_FIXTURE_RESULTS="+json.dumps({
 "sourceLength":result["sourceLength"],
 "pagesByHeight":[{"height":p["height"],"pageCount":p["pages"],"coverage":p["coverage"]}
                  for p in result["output"]],
 "bad":bad},ensure_ascii=False))
if bad:raise AssertionError(str(bad))
