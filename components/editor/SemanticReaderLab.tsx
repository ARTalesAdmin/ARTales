"use client";
import {useEffect, useMemo, useRef, useState, type CSSProperties} from "react";
import {projectSemanticProseText} from "@/lib/semantic/displayText";
import {getProfileReaderSettings, type FixtureProfileReaderDefaults} from "@/lib/fixtures/readerPreferences";
import {defaultReaderSettings, type ReaderDensityId} from "@/lib/reader/readerSettings";
import type {SemanticRevision, SemanticNode, SemanticAtom, SemanticPoem, SemanticBlockPresentation, SemanticPageUnit} from "@/lib/semantic/model";
import {getSemanticPageUnits, projectSemanticReader, verifyReaderProjection} from "@/lib/semantic/readerProjection";
import "./semantic-reader.css";

type Props={revision:SemanticRevision;original:string;legacySynthetic:string;profileReaderDefaults?:FixtureProfileReaderDefaults|null};
type BrowserMeasurements={
  key:string;pageWidth:number;viewportHeight:number;heights:Record<string,number>;
};
function inline(atom:SemanticAtom, prose=false) {
  const italic=atom.marks.some(x=>x.kind==="italic");
  const bold=atom.marks.some(x=>x.kind==="bold");
  return <span data-atom-id={atom.id} data-source-start={atom.anchor.normalized_start}
    data-source-end={atom.anchor.normalized_end} className="semantic-reader__atom"
    style={{fontStyle:italic?"italic":undefined,fontWeight:bold?700:undefined,
      marginInlineStart:atom.marks.some(x=>x.kind==="indent")?"1.3em":undefined}}>
    {prose?projectSemanticProseText(atom.raw):atom.raw}
  </span>;
}
function presentationStyle(p?:SemanticBlockPresentation):CSSProperties|undefined {
  if(!p)return undefined;
  const spaces={none:"0",normal:"1em",generous:"2.5em"};
  const indents={none:"0",small:"1em",medium:"2em",large:"3em"};
  return {textAlign:p.align,marginBlockStart:spaces[p.space_before],
    marginBlockEnd:spaces[p.space_after],paddingInlineStart:indents[p.indent]};
}
function poem(node:SemanticPoem) {
  return <figure className={"semantic-reader__poem semantic-reader__poem--"+node.layout}
    data-semantic-id={node.id}>{node.stanzas.map(s=><div className="semantic-reader__stanza" key={s.id}>
      {s.lines.map(line=><div key={line.atom.id} className="semantic-reader__verse">{inline(line.atom)}</div>)}
    </div>)}</figure>;
}
function nodeView(n:SemanticNode):React.ReactNode {
  if(n.kind==="chapter"||n.kind==="section")return <section key={n.id} data-semantic-id={n.id}
    style={presentationStyle(n.presentation)}>
    {n.kind==="chapter"?<h2>{inline(n.heading)}</h2>:<h3>{inline(n.heading)}</h3>}
    {n.children.map(nodeView)}</section>;
  if(n.kind==="poem")return <div key={n.id} style={presentationStyle(n.presentation)}>{poem(n)}</div>;
  if(!("atom" in n))return null;
  const body=inline(n.atom,true);
  if(n.kind==="quote"||n.kind==="epigraph")return <blockquote key={n.id}
    style={presentationStyle(n.presentation)}>{body}</blockquote>;
  if(n.kind==="footnote")return <aside key={n.id} role="note"
    style={presentationStyle(n.presentation)}><sup>{n.footnote_label??"*"}</sup>{body}</aside>;
  return <p key={n.id} data-semantic-id={n.id} style={presentationStyle(n.presentation)}>{body}</p>;
}
/** The same markup is used both on the visible page and in the offscreen measuring page. */
function unitView(u:SemanticPageUnit):React.ReactNode {
  if(u.kind==="title_page"&&u.node.kind==="title_page"){
    return <div className="semantic-reader__title-page">
      <span className="semantic-reader__brand">{u.node.brand}</span>
      <h2>{u.node.title}</h2><p>{u.node.authors.join(" · ")}</p>
      {u.node.edition_note&&<small>{u.node.edition_note}</small>}
      <small className="semantic-reader__draft-note">Návrh titulky · čeká na redakční revizi</small>
    </div>;
  }
  if((u.kind==="chapter_heading"||u.kind==="section_heading")&&
    (u.node.kind==="chapter"||u.node.kind==="section")){
    return <div className="semantic-reader__heading" style={presentationStyle(u.node.presentation)}>
      {u.kind==="chapter_heading"?<h3>{inline(u.node.heading)}</h3>:<h4>{inline(u.node.heading)}</h4>}
    </div>;
  }
  if(u.node.kind==="chapter"||u.node.kind==="section"||u.node.kind==="title_page")return null;
  return nodeView(u.node);
}
function sameMeasurements(a:BrowserMeasurements|null,b:BrowserMeasurements) {
  if(!a||a.key!==b.key||a.pageWidth!==b.pageWidth||a.viewportHeight!==b.viewportHeight)return false;
  const keys=Object.keys(b.heights);
  return keys.length===Object.keys(a.heights).length&&keys.every(key=>a.heights[key]===b.heights[key]);
}

export default function SemanticReaderLab({revision,original,legacySynthetic,profileReaderDefaults=null}:Props) {
  const accountPreferences=getProfileReaderSettings(profileReaderDefaults)??defaultReaderSettings;
  const [mode,setMode]=useState<"paged"|"spread"|"scroll">("paged");
  const [scale,setScale]=useState(accountPreferences.fontScale);
  const [density,setDensity]=useState<ReaderDensityId>(accountPreferences.density);
  const [width,setWidth]=useState(900);
  const [focus,setFocus]=useState(false);
  const [metrics,setMetrics]=useState<BrowserMeasurements|null>(null);
  const frameRef=useRef<HTMLDivElement>(null);
  const measureRef=useRef<HTMLDivElement>(null);
  const measureKey=[revision.revision_ref,mode,scale,density,width,focus].join("|");
  const measured=metrics?.key===measureKey?metrics:null;
  const allUnits=useMemo(()=>getSemanticPageUnits(revision),[revision]);
  const fallbackWidth=focus?(mode==="spread"&&width>=700?Math.floor((width-42)/2):width-24):340;
  const pages=useMemo(()=>projectSemanticReader(revision,{
    mode,viewport_width:measured?.pageWidth??Math.max(220,fallbackWidth),
    viewport_height:measured?.viewportHeight??850,font_scale:scale,density,
    measured_unit_heights:measured?.heights,
  }),[revision,mode,scale,density,measured,fallbackWidth]);
  const integrity=verifyReaderProjection(revision,pages);

  useEffect(()=>{
    let active=true;
    let frame=0;
    const measure=()=>{
      if(!active)return;
      const panel=measureRef.current;
      const paper=panel?.querySelector<HTMLElement>(".semantic-reader__measurement-page");
      if(!paper)return;
      const pageWidth=Math.round(paper.getBoundingClientRect().width);
      // Actual browser viewport, rather than a fixed assumed QA window.
      const viewportHeight=Math.max(430,Math.min(1200,window.innerHeight-92));
      if(pageWidth<200)return;
      const heights:Record<string,number>={};
      for(const element of panel!.querySelectorAll<HTMLElement>("[data-measure-id]")){
        const id=element.dataset.measureId;
        if(id)heights[id]=Math.max(1,Math.ceil(element.getBoundingClientRect().height*2)/2);
      }
      if(Object.keys(heights).length!==allUnits.length)return;
      const next={key:measureKey,pageWidth,viewportHeight,heights};
      setMetrics(previous=>sameMeasurements(previous,next)?previous:next);
    };
    const schedule=()=>{
      if(!active)return;
      window.cancelAnimationFrame(frame);
      frame=window.requestAnimationFrame(measure);
    };
    const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(schedule):null;
    const paper=measureRef.current?.querySelector<HTMLElement>(".semantic-reader__measurement-page");
    if(paper)observer?.observe(paper);
    if(frameRef.current)observer?.observe(frameRef.current);
    window.addEventListener("resize",schedule);
    // Font loading can change line count without changing source identity or viewport.
    if(document.fonts)void document.fonts.ready.then(()=>{if(active)schedule();});
    schedule();
    return()=>{
      active=false;window.cancelAnimationFrame(frame);observer?.disconnect();
      window.removeEventListener("resize",schedule);
    };
  },[allUnits,measureKey]);

  const viewportStyle={
    width:focus?width:"100%",maxWidth:"100%",
    ["--reader-scale" as string]:scale,
    ["--reader-line-height" as string]:density==="compact"?1.4:1.65,
    ["--reader-paragraph-gap" as string]:density==="compact"?"0.65em":"1em",
    ["--reader-page-height" as string]:(measured?.viewportHeight??758)+"px",
  } as CSSProperties;
  return <main className="semantic-reader">
    <header><h1>ARTales · Sémantický Reader v2 (QA)</h1>
      <p>Textová zkouška, nikoli veřejná publikace. Legacy sloupec je výhradně syntetický.</p>
      <div className="semantic-reader__controls">
        <label>Režim <select value={mode} onChange={e=>setMode(e.target.value as typeof mode)}>
          <option value="paged">Stránky</option><option value="spread">Dvoustrany</option><option value="scroll">Plynulý text</option>
        </select></label>
        <label>Velikost <input aria-label="Velikost textu" type="range" min="0.85" max="1.3"
          step="0.05" value={scale} onChange={e=>setScale(Number(e.target.value))}/></label>
        <label>Řádkování <select aria-label="Hustota řádkování" value={density}
          onChange={e=>setDensity(e.target.value as ReaderDensityId)}>
          <option value="comfortable">Normální</option><option value="compact">Zhuštěné</option>
        </select></label>
        <label>Test viewportu <select value={width} onChange={e=>setWidth(Number(e.target.value))}>
          <option value={360}>Mobil 360</option><option value={768}>Tablet 768</option>
          <option value={900}>Desktop 900</option>
        </select></label>
        <label><input type="checkbox" checked={focus} onChange={e=>setFocus(e.target.checked)}/> Samostatná čtečka</label>
        <span role="status">{integrity.ok?"QA: zachováno pořadí jednotek":"QA selhala"} · {pages.length} stránek
          {" · "}{measured?"měřeno prohlížečem":"předběžný odhad"}
        </span>
      </div>
    </header>
    <div className={"semantic-reader__triptych"+(focus?" semantic-reader__triptych--focus":"")}>
      {!focus&&<section aria-label="Archivní Gutenberg"><h2>Gutenberg #11 · originál</h2>
        <pre className="semantic-reader__original">{original}</pre></section>}
      {!focus&&<section aria-label="Syntetické legacy srovnání"><h2>ARTales legacy · pouze simulace</h2>
        <p>Skutečný produkční snapshot Alice zatím nebyl bezpečně převzat. Srovnání záměrně není prohlášeno za ověřené.</p>
        <pre className="semantic-reader__original">{legacySynthetic}</pre></section>}
      <section aria-label="Nová sémantická revize"><h2>ARTales · sémantická kompozice</h2>
        <div className="semantic-reader__viewport" ref={frameRef} style={viewportStyle}
          data-target-width={width} data-focused={focus} data-density={density}>
          <div ref={measureRef} className="semantic-reader__measurement" aria-hidden="true">
            <div className={"semantic-reader__pages semantic-reader__pages--"+mode}>
              <article className="semantic-reader__page semantic-reader__measurement-page">
                {allUnits.map(u=><div className="semantic-reader__unit" key={u.id}
                  data-measure-id={u.id}>{unitView(u)}</div>)}
              </article>
            </div>
          </div>
          <div className={"semantic-reader__pages semantic-reader__pages--"+mode} data-qa-projection="visible">
            {pages.map(page=><article className="semantic-reader__page" key={page.index}
              data-page-index={page.index} data-overflow={page.overflow} data-mode={mode}>
              {page.units.map(u=><div className="semantic-reader__unit" key={u.id} data-page-unit-id={u.id}>
                {unitView(u)}</div>)}
              <footer>QA strana {page.index+1}
                {page.overflow==="scroll_unit"?" · dlouhý celek, bez rozdělení":""}
              </footer>
            </article>)}
          </div>
        </div>
      </section>
    </div>
  </main>;
}
