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
<article class="artales-reader__paper artales-reader__paper--paged artales-reader__paper--spread-left" id="visible-paper">
 <div class="artales-reader__page-content"><article class="artales-work-content">
  <div data-legacy-block-style="paragraph" data-legacy-page-split-after="true" id="prose-wrap"
   style="--artales-block-font:Georgia,serif;--artales-block-weight:400;--artales-block-style:normal;
   --artales-block-size:19px;--artales-block-leading:1.62;--artales-block-align:justify;
   --artales-block-indent:0em;--artales-block-before:0em;--artales-block-after:1em;
   --artales-block-hyphens:none">
   <section class="artales-block artales-paragraph">
    <p id="normal"></p>
   </section>
  </div>
  <div data-legacy-block-style="paragraph"
   style="--artales-block-font:Georgia,serif;--artales-block-weight:400;--artales-block-style:normal;
   --artales-block-size:19px;--artales-block-leading:1.62;--artales-block-align:justify;
   --artales-block-indent:0em;--artales-block-before:0em;--artales-block-after:1em;
   --artales-block-hyphens:none">
   <section class="artales-block artales-paragraph">
    <p id="short">The night grew cold.</p>
   </section>
  </div>
  <div data-legacy-block-style="quote" data-legacy-page-split-after="true" style="--artales-block-font:Georgia,serif;
   --artales-block-weight:400;--artales-block-style:italic;--artales-block-size:19px;
   --artales-block-leading:1.62;--artales-block-align:justify;--artales-block-indent:0em;
   --artales-block-before:0em;--artales-block-after:1em;--artales-block-hyphens:none">
   <blockquote class="artales-block artales-quote"><p id="italic-quote"></p></blockquote>
  </div>
  <div data-legacy-block-style="preface" data-legacy-page-split-after="true" style="--artales-block-font:Georgia,serif;
   --artales-block-weight:400;--artales-block-style:italic;--artales-block-size:19px;
   --artales-block-leading:1.62;--artales-block-align:justify;--artales-block-indent:0em;
   --artales-block-before:0em;--artales-block-after:1em;--artales-block-hyphens:none">
   <section class="artales-block artales-preface"><p id="intro"></p></section>
  </div>
  <div data-legacy-block-style="poem" style="--artales-block-font:Georgia,serif;
   --artales-block-weight:400;--artales-block-style:italic;--artales-block-size:19px;
   --artales-block-leading:1.62;--artales-block-align:left;--artales-block-indent:0em;
   --artales-block-before:0em;--artales-block-after:1em;--artales-block-hyphens:none">
   <section class="artales-block artales-poem"><p id="verse">This is a free line of poetry.</p></section>
  </div>
 </article></div>
</article>
<article class="artales-reader__paper artales-reader__paper--paged artales-reader__paper--spread-right" id="right-paper">
 <div class="artales-reader__page-content"><article class="artales-work-content">
  <section class="artales-block artales-paragraph"><p>The opposite leaf has the same available width.</p></section>
 </article></div>
</article>
</div>
<div class="artales-reader__measurement-stage" id="hidden-stage">
 <article class="artales-reader__paper artales-reader__paper--paged artales-reader__paper--spread-left">
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
 const italic=document.querySelector("#italic-quote");
 const intro=document.querySelector("#intro");
 const verse=document.querySelector("#verse");
 const hidden=document.querySelector("#hidden-text");
 const all=document.querySelector("#visible-paper");
 // Same physical reading width on left, right and measuring leaf. A transparent
 // seam border is not a cosmetic detail: a single extra pixel can rewrap words.
 const stage=document.querySelector("#hidden-stage");
 const rightPaper=document.querySelector("#right-paper");
 const leftBox=all.getBoundingClientRect();
 stage.style.width=leftBox.width+"px";
 stage.style.height=leftBox.height+"px";
 const paperContentWidth=(paper)=>paper.querySelector(".artales-reader__page-content").getBoundingClientRect().width;
 const contentWidths=[paperContentWidth(all),paperContentWidth(rightPaper),
   paperContentWidth(stage.querySelector(".artales-reader__paper--paged"))];
 // Arrange several styled source blocks on one sheet: only the actual
 // terminal block is permitted to justify its last measured row.
 const work=all.querySelector(".artales-work-content");
 work.append(document.querySelector("#prose-wrap"));
 const pan="Look about you, Clarke. You see the mountain and hill following "+
  "after hill, as wave on wave, you see the woods and orchard, the fields "+
  "of ripe corn, and the meadows reaching to the reed-beds by the river. "+
  "You see me standing here beside you, and hear my voice; but I tell you "+
  "that all these things are but dreams and shadows that hide the real world.";
 const words=pan.split(/\\s+/);
 function fillNaturallyFull(el) {
  for(let i=18;i<=words.length;i++) {
   el.textContent=words.slice(0,i).join(" ");
   const last=api.measureSemanticDomLastRow(el);
   if(last && api.shouldJustifySemanticPageEnd(last.fill,last.words,
       el.getBoundingClientRect().width,true))return last;
  }
  throw Error("No eligible measured paragraph for "+el.id);
 }
 const natural=fillNaturallyFull(normal);
 const italicNatural=fillNaturallyFull(italic);
 const introNatural=fillNaturallyFull(intro);
 const textBefore=all.textContent,hiddenBefore=hidden.textContent;
 const beforeRows=api.measureSemanticDomRows(normal);
 const beforeHeights=[normal,italic,intro].map(e=>e.getBoundingClientRect().height);
 if(!api.applyLegacyPaperLastRowJustification)
   throw Error("Production legacy paper pass not bundled");
 const pass=api.applyLegacyPaperLastRowJustification(all);
 const afterRows=api.measureSemanticDomRows(normal);
 const afterHeights=[normal,italic,intro].map(e=>e.getBoundingClientRect().height);
 const normalChanged=normal.classList.contains("semantic-reader__prose--justify-last");
 const italicChanged=italic.classList.contains("semantic-reader__prose--justify-last");
 const introChanged=intro.classList.contains("semantic-reader__prose--justify-last");
 const shortChanged=short.classList.contains("semantic-reader__prose--justify-last");
 const editorialChanged=verse.classList.contains("semantic-reader__prose--justify-last");
 const shortDecision=short.dataset.visiblePageEndDecision;
 const shortFill=short.dataset.visiblePageEndFill;
 // Simulate React replacing a paragraph on a page turn. The already
 // existing canonical helper must restore the visible decision on the
 // replacement node without altering source text or sibling blocks.
 const replacement=normal.cloneNode(true);
 replacement.classList.remove("semantic-reader__prose--justify-last");
 for(const key of ["visiblePageEndFill","visiblePageEndWords",
   "visiblePageEndDecision","visiblePageEndGapPx"])delete replacement.dataset[key];
 normal.replaceWith(replacement);
 const beforeReapply=replacement.dataset.visiblePageEndDecision ?? null;
 const afterSwapPass=api.applyLegacyPaperLastRowJustification(all);
 const afterSwapDecision=replacement.dataset.visiblePageEndDecision;
 const afterSwapAlign=getComputedStyle(replacement).textAlignLast;
 return {
  changed:normalChanged,italicChanged,introChanged,shortChanged,editorialChanged,
  beforeReapply,afterSwapPass,afterSwapDecision,afterSwapAlign,
  shortDecision,shortFill,contentWidths,
  normalDecision:normal.dataset.visiblePageEndDecision,
  italicDecision:italic.dataset.visiblePageEndDecision,
  introDecision:intro.dataset.visiblePageEndDecision,
  pass,
  align:getComputedStyle(replacement).textAlignLast,
  quoteAlign:getComputedStyle(italic).textAlignLast,
  prefaceAlign:getComputedStyle(intro).textAlignLast,
  prefacePolicy:getComputedStyle(intro).textAlign,
  shortAlign:getComputedStyle(short).textAlignLast,
  verseAlign:getComputedStyle(verse).textAlign,
  hasClass:normal.classList.contains("semantic-reader__prose--justify-last"),
  sourceSame:all.textContent===textBefore,
  hiddenSame:hidden.textContent===hiddenBefore,
  hiddenClass: hidden.classList.contains("semantic-reader__prose--justify-last"),
  rowsSame: beforeRows.length===afterRows.length &&
    beforeRows.every((r,i)=>r.sourceEnd===afterRows[i].sourceEnd),
  heightDeltas:afterHeights.map((h,i)=>h-beforeHeights[i]),
  naturalFill:natural.fill,
  quoteNaturalFill:italicNatural.fill,
  introNaturalFill:introNatural.fill,
  afterFill:afterRows.at(-1).fill,
  checkedSelector:Array.from(all.querySelectorAll(
    '.artales-reader__page-content .artales-work-content '+
    '[data-legacy-block-style] :is(.artales-paragraph,.artales-quote,.artales-letter-body,'+
    '.artales-newspaper,.artales-preface,.artales-afterword,.artales-acknowledgement) > p')).length
 };
 }""")
 assert max(result["contentWidths"])-min(result["contentWidths"])<.35,result
 assert result["checkedSelector"]==4,result
 assert result["beforeReapply"] is None,result
 assert result["afterSwapPass"]=={"checked":4,"justified":1},result
 assert result["afterSwapDecision"]=="justified" and result["afterSwapAlign"]=="justify",result
 assert result["pass"]=={"checked":4,"justified":1},result
 assert result["changed"] and not result["italicChanged"] and not result["introChanged"],result
 assert result["hasClass"],result
 assert not result["shortChanged"] and not result["editorialChanged"],result
 assert result["shortDecision"]=="block-complete",result
 assert result["align"]=="justify" and result["quoteAlign"]!="justify",result
 assert result["prefaceAlign"]!="justify" and result["prefacePolicy"]=="justify",result
 assert result["italicDecision"]=="block-complete" and result["introDecision"]=="block-complete",result
 assert result["normalDecision"]=="justified",result
 assert result["shortAlign"]!="justify",result
 assert result["verseAlign"]=="left",result
 assert result["sourceSame"] and result["hiddenSame"] and not result["hiddenClass"],result
 assert result["rowsSame"] and all(abs(delta)<.5 for delta in result["heightDeltas"]),result
 assert result["afterFill"]>=.975,result
 print("CHROMIUM_LEGACY_LAST_ROW: PASS",result)
 browser.close()
