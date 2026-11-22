"""Chromium: actual semantic last-line rule applied to visible old Reader DOM.
No source edits, no extra visual row, no changed page content height, no
stretched short endings or non-justified editorial blocks.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
bundle=ROOT/"reader-chromium-artifacts/paginator-bundle.js"
styles=[ROOT/"components/work/work-content-renderer.css",
 ROOT/"components/reader/reader.css",
 ROOT/"components/work/legacy-block-typography.css"]

html="""<main class="artales-reader artales-reader--theme-light artales-reader--layout-spread">
<section class="artales-reader__stage">
<div class="artales-reader__spread">
<article class="artales-reader__paper artales-reader__paper--paged" id="visible-paper">
 <div class="artales-reader__page-content"><article class="artales-work-content">
  <div data-legacy-block-style="paragraph" id="prose-wrap"
   style="--artales-block-font:Georgia,serif;--artales-block-weight:400;--artales-block-style:normal;
   --artales-block-size:19px;--artales-block-leading:1.62;--artales-block-align:justify;
   --artales-block-indent:0em;--artales-block-before:0em;--artales-block-after:1em;
   --artales-block-hyphens:none">
   <section class="artales-block artales-paragraph">
    <p id="normal"></p><p id="short">The night grew cold.</p>
   </section>
  </div>
  <div data-legacy-block-style="poem" style="--artales-block-font:Georgia,serif;
   --artales-block-weight:400;--artales-block-style:italic;--artales-block-size:19px;
   --artales-block-leading:1.62;--artales-block-align:left;--artales-block-indent:0em;
   --artales-block-before:0em;--artales-block-after:1em;--artales-block-hyphens:none">
   <section class="artales-block artales-poem"><p id="verse">This is a free line of poetry.</p></section>
  </div>
 </article></div>
</article>
</div>
<div class="artales-reader__measurement-stage" id="hidden-stage">
 <article class="artales-reader__paper artales-reader__paper--paged">
  <div class="artales-reader__page-content"><article class="artales-work-content">
   <div data-legacy-block-style="paragraph" style="--artales-block-font:Georgia,serif;
    --artales-block-weight:400;--artales-block-style:normal;--artales-block-size:19px;
    --artales-block-leading:1.62;--artales-block-align:justify;--artales-block-indent:0em;
    --artales-block-before:0em;--artales-block-after:1em;--artales-block-hyphens:none">
    <section class="artales-block artales-paragraph"><p id="hidden-text">Hidden text must not change.</p></section>
   </div>
  </article></div>
 </article>
</div>
</section></main>"""

with sync_playwright() as browser_api:
 browser=browser_api.chromium.launch()
 page=browser.new_page(viewport={"width":1366,"height":800})
 page.set_content(html)
 for sheet in styles: page.add_style_tag(content=sheet.read_text(encoding="utf-8"))
 page.add_script_tag(content=bundle.read_text(encoding="utf-8"))
 result=page.evaluate("""() => {
 const api=window.ARTalesPageEngine;
 if(!api?.applySemanticProseLastRowJustification) throw Error("Missing canonical helper");
 const normal=document.querySelector("#normal");
 const short=document.querySelector("#short");
 const verse=document.querySelector("#verse");
 const hidden=document.querySelector("#hidden-text");
 const all=document.querySelector("#visible-paper");
 const pan="Look about you, Clarke. You see the mountain and hill following "+
  "after hill, as wave on wave, you see the woods and orchard, the fields "+
  "of ripe corn, and the meadows reaching to the reed-beds by the river. "+
  "You see me standing here beside you, and hear my voice; but I tell you "+
  "that all these things are but dreams and shadows that hide the real world.";
 let candidate=null,natural=null;
 const words=pan.split(/\\s+/);
 for(let i=18;i<=words.length;i++){
  normal.textContent=words.slice(0,i).join(" ");
  const last=api.measureSemanticDomLastRow(normal);
  if(last && api.shouldJustifySemanticPageEnd(last.fill,last.words,
      normal.getBoundingClientRect().width,true)){
   candidate=normal.textContent;natural=last;break;
  }
 }
 if(!candidate)throw Error("No eligible measured paragraph in legacy page");
 const textBefore=all.textContent,hiddenBefore=hidden.textContent;
 const beforeRows=api.measureSemanticDomRows(normal);
 const beforeHeight=normal.getBoundingClientRect().height;
 const normalChanged=api.applySemanticProseLastRowJustification(normal);
 const shortChanged=api.applySemanticProseLastRowJustification(short);
 const editorialChanged=api.applySemanticProseLastRowJustification(verse);
 const afterRows=api.measureSemanticDomRows(normal);
 const afterHeight=normal.getBoundingClientRect().height;
 return {
  changed:normalChanged,shortChanged,editorialChanged,
  align:getComputedStyle(normal).textAlignLast,
  shortAlign:getComputedStyle(short).textAlignLast,
  verseAlign:getComputedStyle(verse).textAlign,
  hasClass:normal.classList.contains("semantic-reader__prose--justify-last"),
  sourceSame:all.textContent===textBefore,
  hiddenSame:hidden.textContent===hiddenBefore,
  hiddenClass: hidden.classList.contains("semantic-reader__prose--justify-last"),
  rowsSame: beforeRows.length===afterRows.length &&
    beforeRows.every((r,i)=>r.sourceEnd===afterRows[i].sourceEnd),
  heightDelta:afterHeight-beforeHeight,
  naturalFill:natural.fill,
  afterFill:afterRows.at(-1).fill,
  checkedSelector:Array.from(all.querySelectorAll(
    '.artales-reader__page-content .artales-work-content '+
    '[data-legacy-block-style="paragraph"] > .artales-paragraph p')).length
 };
 }""")
 assert result["checkedSelector"]==2,result
 assert result["changed"] and result["hasClass"],result
 assert not result["shortChanged"] and not result["editorialChanged"],result
 assert result["align"]=="justify" and result["shortAlign"]!="justify",result
 assert result["verseAlign"]=="left",result
 assert result["sourceSame"] and result["hiddenSame"] and not result["hiddenClass"],result
 assert result["rowsSame"] and abs(result["heightDelta"])<.5,result
 assert result["afterFill"]>=.975,result
 print("CHROMIUM_LEGACY_LAST_ROW: PASS",result)
 browser.close()
