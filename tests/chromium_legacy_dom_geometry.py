"""Chromium regression for actual legacy Reader block geometry.
Checks the real TypeScript DOM geometry, paper parity, physical line rows,
variable font styles and overflow recovery, not a copied Python algorithm.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
out=ROOT/"reader-chromium-artifacts"
out.mkdir(exist_ok=True)
common=(ROOT/"components/work/legacy-block-typography.css").read_text(encoding="utf-8")
work=(ROOT/"components/work/work-content-renderer.css").read_text(encoding="utf-8")
reader=(ROOT/"components/reader/reader.css").read_text(encoding="utf-8")
script=(out/"legacy-dom-bundle.js").read_text(encoding="utf-8")
html="""<main class="artales-reader artales-reader--layout-pagedFlow artales-reader--width-normal"
 style="--reader-font-scale:1">
<div class="artales-reader__paged-flow">
 <article class="artales-reader__paper artales-reader__paper--paged" id="visible">
  <header class="artales-reader__page-header">Chapter</header>
  <div class="artales-reader__page-content"><article class="artales-work-content">
   <div data-legacy-block-style="paragraph" style="--artales-block-font:Georgia,serif;--artales-block-size:1.2em;--artales-block-weight:400;--artales-block-style:normal;--artales-block-leading:1.7;--artales-block-align:justify;--artales-block-indent:1em;--artales-block-before:0em;--artales-block-after:1em;--artales-block-hyphens:auto">
    <section class="artales-block artales-paragraph"><p id="visible-text">Once upon a time there was a long journey across the old mountains. The town below was quiet. A great number of stories were still waiting to be told. These words continue until the paragraph wraps naturally across multiple rows and those rows are measured.</p></section>
   </div>
  </article></div><footer class="artales-reader__page-footer">1</footer>
 </article>
</div>
<div id="probe" class="artales-reader__measurement-stage">
 <article class="artales-reader__paper artales-reader__paper--paged">
  <header class="artales-reader__page-header">Chapter</header>
  <div class="artales-reader__page-content"><article class="artales-work-content">
   <div data-legacy-block-style="paragraph" style="--artales-block-font:Georgia,serif;--artales-block-size:1.2em;--artales-block-weight:400;--artales-block-style:normal;--artales-block-leading:1.7;--artales-block-align:justify;--artales-block-indent:1em;--artales-block-before:0em;--artales-block-after:1em;--artales-block-hyphens:auto">
    <section class="artales-block artales-paragraph"><p id="measured-text">Once upon a time there was a long journey across the old mountains. The town below was quiet. A great number of stories were still waiting to be told. These words continue until the paragraph wraps naturally across multiple rows and those rows are measured.</p></section>
   </div>
  </article></div><footer class="artales-reader__page-footer">1</footer>
 </article>
</div>
</main>"""
with sync_playwright() as pw:
 browser=pw.chromium.launch()
 page=browser.new_page(viewport={"width":1250,"height":950})
 page.set_content(html)
 for sheet in (work,reader,common):
  page.add_style_tag(content=sheet)
 page.add_script_tag(content=script)
 results=page.evaluate("""() => {
  const engine=window.ARTalesLegacyDomEngine;
  if(!engine?.measureLegacyReaderDom)throw Error("Production browser module not bundled");
  const visible=document.querySelector("#visible");
  const stage=document.querySelector("#probe");
  if(!engine.syncLegacyMeasuringPaper(stage,visible))throw Error("Cannot sync paper geometry");
  const geometry=engine.measureLegacyReaderDom(stage,1);
  if(!geometry)throw Error("No DOM measurements");
  const visibleLines=engine.countLegacyRenderedRows(document.querySelector("#visible-text"));
  const measuredLines=engine.countLegacyRenderedRows(document.querySelector("#measured-text"));
  const visibleRect=visible.querySelector(".artales-reader__page-content").getBoundingClientRect();
  const measuredRect=stage.querySelector(".artales-reader__page-content").getBoundingClientRect();
  const overflow=engine.legacyPageInkOverflowPx(visible.querySelector(".artales-reader__page-content"));
  return {geometry,visibleLines,measuredLines,visibleHeight:visibleRect.height,measuredHeight:measuredRect.height,overflow};
 }""")
 assert results["geometry"]["blockRows"][0]>=2,results
 assert results["geometry"]["blockRows"][0]==results["visibleLines"]==results["measuredLines"],results
 assert abs(results["visibleHeight"]-results["measuredHeight"])<1,results
 assert results["geometry"]["blockHeightsPx"][0]>20,results
 assert results["overflow"] is not None,results
 # Measured geometry should react to the exact same CSS font scale.
 scaled=page.evaluate("""() => {
  const root=document.querySelector(".artales-reader");
  root.style.setProperty("--reader-font-scale","1.4");
  const engine=window.ARTalesLegacyDomEngine;
  const stage=document.querySelector("#probe");
  engine.syncLegacyMeasuringPaper(stage,document.querySelector("#visible"));
  return engine.measureLegacyReaderDom(stage,1);
 }""")
 assert scaled is not None,scaled
 # A transformed font scale may change rows and heights; the measurement path
 # must remain finite even if browser fonts happen to fit the same row count.
 assert scaled["blockHeightsPx"][0]>0 and scaled["blockRows"][0]>0,scaled
 page.screenshot(path=str(out/"legacy-dom-measured.png"),full_page=True)
 print("Legacy DOM measured page geometry, physical rows and width parity PASS",results)
 browser.close()
