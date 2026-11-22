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

 # General (not title-specific) punctuation regression on real physical DOM rows.
 # The hidden sampler must report NATURAL punctuation positions, not positions
 # inflated by Chromium's normal text justification.
 for terminal in (";","." ):
  selected=page.evaluate("""terminal=>{
    const e=window.ARTalesLegacyDomEngine;
    const paper=document.querySelector('#visible');
    const sampler=document.querySelector('#probe');
    if(!e.syncLegacyMeasuringPaper(sampler,paper))throw Error('Paper parity failed');
    const measured=document.querySelector('#measured');
    const visible=document.querySelector('#original');
    let result=null;
    const samples=[];
    for(let n=0;n<96;n++){
      const prose=(("The conversation was warm and everyone listened carefully. ".repeat(4))+
        "Neighbors gathered and shared their stories "+ "a ".repeat(n) +
        "until the whole community understood the messages"+terminal+" after that " +
        ("the discussion carried on through many unhurried evenings ".repeat(16))).trim();
      visible.textContent=prose;
      measured.textContent=prose;
      const block={id:'general-prose',type:'paragraph',content:prose,editor_note:null};
      const geo=e.measureLegacyReaderDom(sampler,1,[block]);
      const rows=geo?.paragraphRows?.[0]?.rows??[];
      const hit=rows.findIndex((row,index)=>index<rows.length-1 &&
        row.punctuationCuts?.some(mark=>mark.fill>=.8 && mark.fill<=.98 &&
          mark.displayEnd<row.displayEnd));
      if(hit<0){
        if(n%20===0) samples.push({n,rows:rows.length,
          marks:rows.flatMap((row,index)=>(row.punctuationCuts??[])
            .map(mark=>({row:index,fill:mark.fill,cut:mark.displayEnd,
              rowEnd:row.displayEnd,bottom:row.bottomPx})))
        });
        continue;
      }
      // The canonical paginator requires at least 80px of page height.
      // Place the target punctuation well below the first physical rows.
      const fitting=rows[hit];
      if(fitting.bottomPx<80)continue;
      // Page height includes the block's non-text chrome (margins), just as
      // paginateMeasuredLegacyFragments does. The previous fixture counted
      // only the glyph rows, incorrectly excluding its own target line.
      const chrome=Math.max(0,geo.blockHeightsPx[0]-
        geo.paragraphRows[0].textHeightPx);
      const controlled={...geo,contentHeightPx:fitting.bottomPx+chrome+8};
      let reflows=0;
      let firstReflow=null;
      const remeasure=controlled.remeasureRemainder;
      controlled.remeasureRemainder=(index,start,displayStart)=>{
        const result=remeasure?.(index,start,displayStart)??null;
        if(result){
          reflows++;
          firstReflow??={sourceStart:start,displayStart,
            rows:result.rows.slice(0,3),
            textHeight:result.textHeightPx,height:result.heightPx};
        }
        return result;
      };
      const pages=e.paginateReaderBlocks([block],e.defaultReaderSettings,{},
        e.DEFAULT_LEGACY_BLOCK_STYLES,controlled);
      const first=pages[0]?.blocks?.[0];
      if(first?.fields?.legacyReaderPageEndReason!=='punctuation_80'){
        if(samples.length<10)samples.push({n,hit,reason:first?.fields?.legacyReaderPageEndReason,
          first:first?.content?.slice(-120),pageCount:pages.length,
          fitting,contentHeightPx:controlled.contentHeightPx});
        continue;
      }
      result={
        reason:first.fields.legacyReaderPageEndReason,
        cut:first.content,source:pages.flatMap(page=>page.blocks.map(b=>b.content)).join(''),
        expected:prose,sheets:pages.length,
        samplerAlignment:getComputedStyle(measured).textAlign,
        visibleAlignment:getComputedStyle(visible).textAlign,
        punctuationFill:fitting.punctuationCuts.map(x=>x.fill),
        reflows,firstReflow,
      };
      break;
    }
    return {result,samples};
  }""",terminal)
  if selected["result"] is None:
   print("PUNCTUATION_DIAGNOSTICS",terminal,str(selected["samples"])[:6500])
  selected=selected["result"]
  assert selected is not None, ("No physical 80% punctuation candidate",terminal)
  assert selected["reason"]=="punctuation_80",selected
  assert selected["reflows"]>0,selected
  assert selected["firstReflow"]["sourceStart"]>0,selected
  assert selected["firstReflow"]["rows"][0]["sourceEnd"]>selected["firstReflow"]["sourceStart"],selected
  assert selected["firstReflow"]["height"]>=selected["firstReflow"]["textHeight"],selected
  assert selected["cut"].rstrip().endswith(terminal),selected
  assert selected["source"]==selected["expected"],selected
  assert selected["sheets"]>1,selected
  assert selected["samplerAlignment"] in ("start","left"),selected
  assert selected["visibleAlignment"]=="justify",selected
  print("Chromium natural 80% punctuation cut, title-independent PASS",terminal,selected["sheets"])

 # Real browser regression for the shared hanging-tail exception. A period
 # around 72%-80% may win ONLY if leaving the physical row intact would
 # strand "But the" at the end; both versions must preserve all source text.
 hanging_result=page.evaluate("""()=>{
   const e=window.ARTalesLegacyDomEngine;
   const visible=document.querySelector('#original');
   const measured=document.querySelector('#measured');
   const stage=document.querySelector('#probe');
   let candidateCount=0, outcome=null;
   for(let n=0;n<140;n++){
     const intro="People talked patiently about the latest events in town. ".repeat(5);
     const text=(intro+"A thoughtful observer "+("carefully ".repeat(n))+
       "explained the difficult subject. But the extraordinarily detailed " +
       "continuation carried onward through several new pages of prose. "+
       ("Another sentence discussed the lasting consequences. ".repeat(12))).trim();
     visible.textContent=text;
     measured.textContent=text;
     if(!e.syncLegacyMeasuringPaper(stage,document.querySelector('#visible')))
       throw Error('Paper parity changed');
     const block={id:'sentence-tail',type:'paragraph',content:text,editor_note:null};
     const geo=e.measureLegacyReaderDom(stage,1,[block]);
     const rows=geo?.paragraphRows?.[0]?.rows??[];
     const hit=rows.findIndex((row,i)=>i<rows.length-1 &&
       /But the$/.test(text.slice(0,row.sourceEnd)) &&
       row.bottomPx>=80 && row.punctuationCuts?.some(m=>
         m.fill>=.72 && m.fill<.8 && m.displayEnd<row.displayEnd &&
         text[m.displayEnd-1]==='.'));
     if(hit<0)continue;
     candidateCount++;
     const row=rows[hit];
     const chrome=Math.max(0,geo.blockHeightsPx[0]-geo.paragraphRows[0].textHeightPx);
     const controlled={...geo,contentHeightPx:row.bottomPx+chrome+8};
     let reflows=0;
     const original=controlled.remeasureRemainder;
     controlled.remeasureRemainder=(index,start,end)=>{
       const measuredRemainder=original?.(index,start,end)??null;
       if(measuredRemainder)reflows++;
       return measuredRemainder;
     };
     const pages=e.paginateReaderBlocks([block],e.defaultReaderSettings,{},
       e.DEFAULT_LEGACY_BLOCK_STYLES,controlled);
     const first=pages[0]?.blocks?.[0];
     if(first?.fields?.legacyReaderPageEndReason!=='punctuation_80')continue;
     outcome={fill:row.punctuationCuts.filter(m=>m.fill<.8).map(m=>m.fill),
       first:first.content,entire:pages.flatMap(p=>p.blocks.map(b=>b.content)).join(''),
       expected:text,reflows,pageCount:pages.length};
     break;
   }
   return {candidateCount,outcome};
 }""")
 assert hanging_result["candidateCount"]>0,hanging_result
 assert hanging_result["outcome"] is not None,hanging_result
 assert hanging_result["outcome"]["first"].rstrip().endswith("."),hanging_result
 assert hanging_result["outcome"]["entire"]==hanging_result["outcome"]["expected"],hanging_result
 assert hanging_result["outcome"]["reflows"]>0,hanging_result
 assert hanging_result["outcome"]["pageCount"]>1,hanging_result
 print("Chromium general hanging-tail punctuation below 80% PASS",
       hanging_result["outcome"]["fill"])

 # The canonical renderer can produce several <p> elements from ONE source
 # block. This used to trigger character-budget fragmentation for the ENTIRE
 # Gutenberg-style block, leaving arbitrarily short physical page endings.
 multi_first="<em>"+("A reflective introduction with many carefully chosen words. "*30).strip()+"</em>"
 multi_second=("The following discussion has ordinary words and a "+
   "<strong>literal tag</strong> that the renderer does not interpret. ")*15
 multi_source=multi_first+"\n\n"+multi_second.strip()
 page.evaluate("""(parts)=>{
   for(const selector of ['#visible .artales-paragraph','#probe .artales-paragraph']){
     const parent=document.querySelector(selector);
     parent.replaceChildren();
     const first=document.createElement('p');
     first.id=selector.includes('#probe')?'measured':'original';
     first.innerHTML=parts[0];
     const second=document.createElement('p');
     second.textContent=parts[1];
     parent.append(first,second);
   }
 }""",[multi_first,multi_second.strip()])
 multi_result=page.evaluate("""raw=>{
   const e=window.ARTalesLegacyDomEngine,stage=document.querySelector('#probe');
   e.syncLegacyMeasuringPaper(stage,document.querySelector('#visible'));
   const block={id:'multi-prose',type:'paragraph',content:raw,editor_note:null};
   const geo=e.measureLegacyReaderDom(stage,1,[block]);
   if(!geo?.paragraphRows?.[0])throw Error('Multi-<p> block fell back to character estimates');
   const pages=e.paginateReaderBlocks([block],e.defaultReaderSettings,{},
     e.DEFAULT_LEGACY_BLOCK_STYLES,geo);
   const pieces=pages.flatMap(page=>page.blocks);
   const rows=geo.paragraphRows[0].rows;
   return {
     rowCount:rows.length,sourceLength:raw.length,
     mappedFinalEnd:rows.at(-1).sourceEnd,
     source:pieces.map(x=>x.content).join(''),
     pages:pages.length,
     emphasisContinuations:pieces.filter(x=>x.fields?.legacyReaderInlinePrefix==='<em>').length,
     sampledTextHeight:geo.paragraphRows[0].textHeightPx,
   };
 }""",multi_source)
 assert multi_result["rowCount"]>12,multi_result
 assert multi_result["source"]==multi_source,multi_result
 assert multi_result["pages"]>1,multi_result
 assert multi_result["emphasisContinuations"]>0,multi_result
 print("Chromium multiple paragraphs/markup: exact DOM rows, unchanged source PASS",multi_result["pages"])

 # Rendered quote/front-matter/newspaper prose uses the identical DOM source
 # mapping and physical-line fragments as standard paragraphs.
 for block_type,semantic_class in (
   ("quote","artales-quote"),
   ("newspaper_article","artales-newspaper"),
   ("preface","artales-preface"),
   ("afterword","artales-afterword"),
   ("acknowledgement","artales-acknowledgement"),
 ):
  prose=("An ordinary reading paragraph with many carefully considered words "+
   "and a natural ending. ")*18
  probe=page.evaluate("""args=>{
   const [type,cls,text]=args;
   for(const id of ['#visible','#probe']){
     const parent=document.querySelector(id+' .artales-work-content [data-legacy-block-style]');
     const section=parent.querySelector('.artales-block');
     section.className='artales-block '+cls;
     section.innerHTML='';
     const p=document.createElement('p');
     p.textContent=text;
     section.append(p);
   }
   const engine=window.ARTalesLegacyDomEngine;
   const stage=document.querySelector('#probe');
   engine.syncLegacyMeasuringPaper(stage,document.querySelector('#visible'));
   const block={id:'shared-prose',type,content:text,editor_note:null};
   const geometry=engine.measureLegacyReaderDom(stage,1,[block]);
   const rows=geometry?.paragraphRows?.[0]?.rows??[];
   if(rows.length<2) return {rows:rows.length,source:null};
   const pages=engine.paginateReaderBlocks([block],engine.defaultReaderSettings,{},
     engine.DEFAULT_LEGACY_BLOCK_STYLES,geometry);
   return {rows:rows.length,source:pages.flatMap(page=>
     page.blocks.map(b=>b.content)).join(''),
     pageCount:pages.length,
     sourceTypeOk:pages.every(page=>page.blocks.every(b=>b.type===type))};
  }""",[block_type,semantic_class,prose.strip()])
  assert probe["rows"]>1,(block_type,probe)
  assert probe["source"]==prose.strip(),(block_type,probe)
  assert probe["sourceTypeOk"],(block_type,probe)
  print("Chromium same physical DOM paths for prose",block_type,"PASS",probe["pageCount"])
 browser.close()
