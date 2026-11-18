"""Render actual Reader CSS and invoke the production last-line helper in Chromium."""
import json
from pathlib import Path
from playwright.sync_playwright import sync_playwright

JS=r"""() => {
 const impl=window.ARTalesPageEngine;
 if(!impl?.applySemanticProseLastRowJustification)throw Error("Alignment helper absent");
 const root=document.querySelector("#root");
 root.className="artales-reader--semantic";
 const paper=document.createElement("article");
 paper.className="semantic-public-reader__paper";
 paper.style.width="690px";
 paper.style.setProperty("--reader-page-height","900px");
 paper.style.setProperty("--reader-font-scale","1");
 const header=document.createElement("div");header.className="semantic-public-reader__paper-top";
 const area=document.createElement("div");area.className="semantic-public-reader__page-content";
 const footer=document.createElement("div");footer.className="semantic-public-reader__paper-footer";
 paper.append(header,area,footer);root.append(paper);
 const add=(text,classes="",alignment=null)=>{
  const wrap=document.createElement("div");wrap.className="semantic-reader__unit";
  const p=document.createElement("p");p.className=classes;
  if(alignment)p.style.textAlign=alignment;
  p.textContent=text;wrap.append(p);area.append(wrap);return p;
 };
 const pan="Look about you, Clarke. You see the mountain, and hill following "+
  "after hill, as wave on wave, you see the woods and orchard, the fields "+
  "of ripe corn, and the meadows reaching to the reed-beds by the river. "+
  "You see me standing here beside you, and hear my voice; but I tell you "+
  "that all these things are but dreams and shadows; the shadows that hide "+
  "the real world from our eyes. There is a real world, but it is beyond "+
  "this glamour and this vision, beyond these chases in Arras, dreams in a career.";
 const words=pan.split(/\s+/);
 const ordinary=add("");
 let chosen=null, measured=null;
 for(let i=18;i<words.length;i++){
  ordinary.textContent=words.slice(0,i).join(" ");
  const row=impl.measureSemanticDomLastRow(ordinary);
  if(row&&impl.shouldJustifySemanticPageEnd(row.fill,row.words,ordinary.getBoundingClientRect().width,true)){
   chosen=ordinary.textContent;measured=row;break;
  }
 }
 if(!chosen)throw Error("No qualifying Pan prose ending");
 const rows=impl.measureSemanticDomRows(ordinary),original=ordinary.textContent;
 if(getComputedStyle(ordinary).textAlignLast!=="start")throw Error("Bad baseline style");
 if(!impl.applySemanticProseLastRowJustification(ordinary))throw Error("Whole paragraph skipped");
 const after=impl.measureSemanticDomRows(ordinary);
 if(!ordinary.classList.contains("semantic-reader__prose--justify-last")||
    getComputedStyle(ordinary).textAlignLast!=="justify"||
    after.at(-1).fill<.975)throw Error("Final row not visibly justified");
 if(after.length!==rows.length||rows.some((r,i)=>r.sourceEnd!==after[i].sourceEnd)||
    ordinary.textContent!==original)throw Error("Line positions or source changed");
 const continuation=add(chosen,"semantic-reader__fragment");
 if(!impl.applySemanticProseLastRowJustification(continuation)||
    getComputedStyle(continuation).textAlignLast!=="justify")throw Error("Continuation lost alignment");
 const final=add(chosen,"semantic-reader__fragment semantic-reader__fragment--final");
 if(!impl.applySemanticProseLastRowJustification(final)||
    getComputedStyle(final).textAlignLast!=="justify")throw Error("Final fragment skipped");
 const short=add("The night grew cold.");
 if(impl.applySemanticProseLastRowJustification(short)||
    getComputedStyle(short).textAlignLast!=="start")throw Error("Short final row stretched");
 const editorial=add(chosen,"","center");
 if(impl.applySemanticProseLastRowJustification(editorial)||
    getComputedStyle(editorial).textAlign!=="center")throw Error("Editorial centering changed");
 return {naturalFill:measured.fill,afterFill:after.at(-1).fill,
  lineCount:after.length,ordinary:true,continuation:true,finalFragment:true,short:false,editorial:"center"};
}"""
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=["--no-sandbox"])
 page=browser.new_page(viewport={"width":1366,"height":768})
 page.set_content('<div id="root"></div>')
 for p in ("components/reader/reader.css","components/editor/semantic-reader.css",
           "components/editor/semantic-reader-theme.css","components/reader/semantic-public-reader.css"):
  page.add_style_tag(content=Path(p).read_text())
 page.add_script_tag(path="reader-chromium-artifacts/paginator-bundle.js")
 result=page.evaluate(JS)
 browser.close()
print("CHROMIUM_LAST_ROW="+json.dumps(result,ensure_ascii=False))
