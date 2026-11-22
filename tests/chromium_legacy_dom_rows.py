"""Verify the production measurement of source offsets and visual lines in Chromium."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
out=ROOT/"reader-chromium-artifacts"
css=(ROOT/"components/work/work-content-renderer.css").read_text()
shared=(ROOT/"components/work/legacy-block-typography.css").read_text()
reader=(ROOT/"components/reader/reader.css").read_text()
code=(out/"legacy-dom-bundle.js").read_text()
raw=("A beginning sentence with an ordinary number of words. "*19).strip()
markup="""<main class="artales-reader artales-reader--layout-pagedFlow artales-reader--width-normal" style="--reader-font-scale:1">
<div class="artales-reader__paged-flow"><article class="artales-reader__paper artales-reader__paper--paged" id="visible">
<header class="artales-reader__page-header">Chapter</header>
<div class="artales-reader__page-content"><article class="artales-work-content">
<div data-legacy-block-style="paragraph" style="--artales-block-font:Georgia,serif;--artales-block-size:1em;--artales-block-weight:400;--artales-block-style:normal;--artales-block-leading:1.7;--artales-block-align:justify;--artales-block-indent:1.2em;--artales-block-before:0em;--artales-block-after:.95em;--artales-block-hyphens:none">
<section class="artales-block artales-paragraph"><p id="original"></p></section></div></article></div>
<footer class="artales-reader__page-footer">1</footer></article></div>
<div class="artales-reader__measurement-stage" id="probe"><article class="artales-reader__paper artales-reader__paper--paged">
<header class="artales-reader__page-header">Chapter</header><div class="artales-reader__page-content"><article class="artales-work-content">
<div data-legacy-block-style="paragraph" style="--artales-block-font:Georgia,serif;--artales-block-size:1em;--artales-block-weight:400;--artales-block-style:normal;--artales-block-leading:1.7;--artales-block-align:justify;--artales-block-indent:1.2em;--artales-block-before:0em;--artales-block-after:.95em;--artales-block-hyphens:none">
<section class="artales-block artales-paragraph"><p id="measured"></p></section></div></article></div>
<footer class="artales-reader__page-footer">1</footer></article></div></main>"""
with sync_playwright() as pw:
 browser=pw.chromium.launch()
 page=browser.new_page(viewport={"width":1170,"height":850})
 page.set_content(markup)
 page.add_style_tag(content="#visible{height:550px!important;min-height:550px!important;max-height:550px!important;}")
 page.evaluate("(raw)=>{document.querySelector('#original').textContent=raw;document.querySelector('#measured').textContent=raw;}",raw)
 for style in [css,reader,shared]:page.add_style_tag(content=style)
 page.add_script_tag(content=code)
 result=page.evaluate("""raw=>{
 const e=window.ARTalesLegacyDomEngine,stage=document.querySelector('#probe');
 if(!e.syncLegacyMeasuringPaper(stage,document.querySelector('#visible')))throw Error('No width parity');
 const geo=e.measureLegacyReaderDom(stage,1,[{id:'prose',type:'paragraph',content:raw,editor_note:null}]);
 if(!geo?.paragraphRows?.[0])throw Error('Missing row source offsets');
 return geo;
 }""",raw)
 rows=result["paragraphRows"][0]["rows"]
 assert len(rows)>4,result
 assert all(0<row["sourceEnd"]<=len(raw) for row in rows),rows
 assert all(rows[i]["sourceEnd"]<rows[i+1]["sourceEnd"] for i in range(len(rows)-1)),rows
 assert all(rows[i]["bottomPx"]<rows[i+1]["bottomPx"] for i in range(len(rows)-1)),rows
 assert rows[-1]["sourceEnd"]<=len(raw),rows
 paged=page.evaluate("""raw=>{
  const e=window.ARTalesLegacyDomEngine,stage=document.querySelector('#probe');
  e.syncLegacyMeasuringPaper(stage,document.querySelector('#visible'));
  const unit={id:'prose',type:'paragraph',content:raw,editor_note:null};
  const geo=e.measureLegacyReaderDom(stage,1,[unit]);
  const pages=e.paginateReaderBlocks([unit],e.defaultReaderSettings,{},e.DEFAULT_LEGACY_BLOCK_STYLES,geo);
  return {source:pages.flatMap(p=>p.blocks.map(b=>b.content)).join(""),
    pageCount:pages.length,heights:pages.map(p=>p.estimatedWeight),
    capacity:geo.contentHeightPx,overflows:pages.map(p=>p.overflow??"none")};
 }""",raw)
 assert paged["source"]==raw,paged
 assert paged["pageCount"]>1,paged
 assert all(h<=paged["capacity"]+1 or o=="scroll_unit"
   for h,o in zip(paged["heights"],paged["overflows"])),paged
 print("Chromium measured physical rows -> complete page coverage PASS",paged["pageCount"])
 print("Chromium measured physical rows and ordered source offsets PASS",len(rows))

 # Verify actual rendered italic text maps back to original *markup* offsets.
 # Splitting must keep the source intact and close/reopen emphasis only for
 # display on each physical page.
 rich=(("Plain words before the marked section. "*16) +
   "<em>" + ("Italic words crossing a physical page boundary. "*24) +
   "</em> " + ("Ordinary ending words. "*12)).strip()
 page.evaluate("(rich)=>{document.querySelector('#original').innerHTML=rich;document.querySelector('#measured').innerHTML=rich;}",rich)
 rich_result=page.evaluate("""raw=>{
   const e=window.ARTalesLegacyDomEngine;
   const stage=document.querySelector('#probe');
   e.syncLegacyMeasuringPaper(stage,document.querySelector('#visible'));
   const block={id:'rich-prose',type:'paragraph',content:raw,editor_note:null};
   const geo=e.measureLegacyReaderDom(stage,1,[block]);
   if(!geo?.paragraphRows?.[0])throw Error('Inline markup lost DOM source offsets');
   const pages=e.paginateReaderBlocks([block],e.defaultReaderSettings,{},
     e.DEFAULT_LEGACY_BLOCK_STYLES,geo);
   const pieces=pages.flatMap(page=>page.blocks);
   const displayed=pieces.map(piece=>{
     const p=document.createElement('p');
     p.innerHTML=(piece.fields?.legacyReaderInlinePrefix||'')+
       piece.content+(piece.fields?.legacyReaderInlineSuffix||'');
     return p.textContent;
   }).join('');
   const marked=pieces.filter(piece=>
     piece.fields?.legacyReaderInlinePrefix || piece.fields?.legacyReaderInlineSuffix).length;
   return {
     source:pieces.map(piece=>piece.content).join(''),
     displayed,
     expected:document.querySelector('#measured').textContent,
     rows:geo.paragraphRows[0].rows.length,
     pieces:pieces.length,
     marked,
     computedHyphens:getComputedStyle(document.querySelector('#measured')).hyphens,
   };
 }""",rich)
 assert rich_result["source"]==rich,rich_result
 assert rich_result["displayed"]==rich_result["expected"],rich_result
 assert rich_result["rows"]>4 and rich_result["pieces"]>1,rich_result
 assert rich_result["marked"]>0,rich_result
 assert rich_result["computedHyphens"]=="none",rich_result
 print("Chromium italic rich text -> exact source and intact display PASS",rich_result["pieces"])

 # Single-newline source paragraphs are one rendered <p>, not two.
 single=("An ordinary paragraph starts here and extends across one line.\nAnd this is its continuation in the same Gutenberg block. "*9).strip()
 page.evaluate("(text)=>{document.querySelector('#original').textContent=text;document.querySelector('#measured').textContent=text;}",single)
 newline_result=page.evaluate("""text=>{
   const e=window.ARTalesLegacyDomEngine,stage=document.querySelector('#probe');
   e.syncLegacyMeasuringPaper(stage,document.querySelector('#visible'));
   const unit={id:'newline',type:'paragraph',content:text,editor_note:null};
   const geo=e.measureLegacyReaderDom(stage,1,[unit]);
   if(!geo?.paragraphRows?.[0])throw Error('Single newline failed DOM geometry');
   const pages=e.paginateReaderBlocks([unit],e.defaultReaderSettings,{},
    e.DEFAULT_LEGACY_BLOCK_STYLES,geo);
   return {source:pages.flatMap(p=>p.blocks.map(b=>b.content)).join(''),
    pageCount:pages.length,rows:geo.paragraphRows[0].rows.length};
 }""",single)
 assert newline_result["source"]==single,newline_result
 assert newline_result["pageCount"]>1,newline_result
 print("Chromium legacy inline newline follows measured row path PASS",newline_result["rows"])
 browser.close()
