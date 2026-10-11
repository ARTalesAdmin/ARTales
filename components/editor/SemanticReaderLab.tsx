"use client";
import {useEffect, useMemo, useRef, useState, type CSSProperties} from "react";
import {projectSemanticProseText} from "@/lib/semantic/displayText";
import {resolveQaProjectionMode, buildSemanticSourceRegions} from "@/lib/semantic/qaReaderModes";
import {synchronizeSemanticPanes} from "@/lib/semantic/pairedSemanticScroll";
import {createSessionReaderNote,locateSessionReaderNote,noteAnchorForUnit,type SessionReaderNote} from "@/lib/semantic/qaNoteSession";
import type {ReaderNoteColor} from "@/lib/reader/readerStorage";
import {getProfileReaderSettings, type FixtureProfileReaderDefaults} from "@/lib/fixtures/readerPreferences";
import {defaultReaderSettings, type ReaderDensityId} from "@/lib/reader/readerSettings";
import type {SemanticRevision, SemanticNode, SemanticAtom, SemanticPoem, SemanticBlockPresentation, SemanticPageUnit} from "@/lib/semantic/model";
import {getSemanticPageUnits, projectSemanticReader, verifyReaderProjection} from "@/lib/semantic/readerProjection";
import "./semantic-reader.css";

type Props={revision:SemanticRevision;original:string;profileReaderDefaults?:FixtureProfileReaderDefaults|null};
type ReadingSpacing = ReaderDensityId | "airy";
type PaneSide = "source" | "composed";
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
  if(u.fragment&&u.node.kind==="paragraph"){
    const {start,end}=u.fragment;
    const original=u.node.atom;
    // Fragment layout only: the original atom ID and source anchor remain authoritative.
    return <p data-semantic-id={u.node.id} data-source-atom={original.id}
      data-fragment-start={start} data-fragment-end={end}
      className={"semantic-reader__fragment"+(u.fragment.continuation_before?" semantic-reader__fragment--continued":"")}
      style={presentationStyle(u.node.presentation)}>
      <span className="semantic-reader__atom" data-atom-id={original.id}>
        {projectSemanticProseText(original.raw.slice(start,end))}
      </span>
    </p>;
  }
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

export default function SemanticReaderLab({revision,original,profileReaderDefaults=null}:Props) {
  const accountPreferences=getProfileReaderSettings(profileReaderDefaults)??defaultReaderSettings;
  const [readerMode,setReaderMode]=useState<"scroll"|"spread">("scroll");
  const [deviceWidth,setDeviceWidth]=useState(1366);
  const [scale,setScale]=useState(accountPreferences.fontScale);
  const [density,setDensity]=useState<ReadingSpacing>(accountPreferences.density);
  const [width,setWidth]=useState(900);
  const [focus,setFocus]=useState(false);
  const [metrics,setMetrics]=useState<BrowserMeasurements|null>(null);
  const [qaNotes,setQaNotes]=useState<SessionReaderNote[]>([]);
  const [selectedUnit,setSelectedUnit]=useState<string|null>(null);
  const [noteTitle,setNoteTitle]=useState("");
  const [noteBody,setNoteBody]=useState("");
  const [noteColor,setNoteColor]=useState<ReaderNoteColor>("gold");
  const [noteFeedback,setNoteFeedback]=useState("");
  const frameRef=useRef<HTMLDivElement>(null);
  const sourceRef=useRef<HTMLDivElement>(null);
  const composedRef=useRef<HTMLDivElement>(null);
  const syncFrameRef=useRef<number|null>(null);
  const ignoreSyncRef=useRef<Record<PaneSide,{top:number;until:number}|null>>({source:null,composed:null});
  const measureRef=useRef<HTMLDivElement>(null);
  const mode=resolveQaProjectionMode(focus?"reader":"editor",readerMode,width,deviceWidth);
  const measureKey=[revision.revision_ref,mode,scale,density,width,focus].join("|");
  const measured=metrics?.key===measureKey?metrics:null;
  const allUnits=useMemo(()=>getSemanticPageUnits(revision),[revision]);
  const sourceRegions=useMemo(()=>buildSemanticSourceRegions(original,allUnits),[original,allUnits]);
  const regionIndices=useMemo(()=>new Map(sourceRegions.filter(x=>x.regionIndex!==null && x.unitId!==null)
    .map(x=>[x.unitId!,x.regionIndex!])),[sourceRegions]);
  const effectiveDensity:ReaderDensityId=density==="airy"?"comfortable":density;
  const fallbackWidth=focus?(mode==="spread"&&width>=700?Math.floor((width-42)/2):width-24):340;
  const pages=useMemo(()=>projectSemanticReader(revision,{
    mode,viewport_width:measured?.pageWidth??Math.max(220,fallbackWidth),
    viewport_height:measured?.viewportHeight??850,font_scale:scale,density:effectiveDensity,
    measured_unit_heights:measured?.heights,
  }),[revision,mode,scale,effectiveDensity,measured,fallbackWidth]);
  const integrity=verifyReaderProjection(revision,pages);
  const anchorable=pages.flatMap(page=>page.units.map(unit=>({unit,pageIndex:page.index})))
    .filter(entry=>Boolean(noteAnchorForUnit(revision,entry.unit)));
  const chosen=anchorable.find(entry=>entry.unit.id===selectedUnit)??anchorable[0];
  const addQaNote=()=>{
    if(!chosen)return;
    try{
      const saved=createSessionReaderNote(revision,chosen.unit,{
        id:crypto.randomUUID(),title:noteTitle,body:noteBody,color:noteColor,
        now:new Date().toISOString(),pageIndex:chosen.pageIndex,pageCount:pages.length,
        layoutMode:mode==="spread"?"spread":"pagedFlow",
      });
      setQaNotes(current=>[...current,saved]);setNoteTitle("");setNoteBody("");
      setNoteFeedback("Testovací poznámka přidána jen do této relace.");
    }catch(e){setNoteFeedback(e instanceof Error?e.message:"Poznámku nelze vytvořit.");}
  };
  const jumpToQaNote=(saved:SessionReaderNote)=>{
    const location=locateSessionReaderNote(revision,pages,saved);
    if(location.status!=="exact"||!location.unitId){
      setNoteFeedback("Kotva není dostupná; původní poznámka zůstává zachována.");return;
    }
    const units=frameRef.current?.querySelectorAll<HTMLElement>("[data-page-unit-id]");
    const target=[...(units??[])].find(node=>node.dataset.pageUnitId===location.unitId);
    if(!target){setNoteFeedback("Cílový blok ještě není vykreslen.");return;}
    target.scrollIntoView({behavior:"smooth",block:"center"});
    setNoteFeedback("Návrat podle obsahové kotvy, nikoli původního čísla stránky.");
  };

  useEffect(()=>{
    const update=()=>setDeviceWidth(window.innerWidth);
    update();window.addEventListener("resize",update);
    return()=>window.removeEventListener("resize",update);
  },[]);
  useEffect(()=>()=>{if(syncFrameRef.current!==null)cancelAnimationFrame(syncFrameRef.current);},[]);
  const synchronize=(side:PaneSide)=>{
    if(focus)return;
    const active=side==="source"?sourceRef.current:composedRef.current;
    const passive=side==="source"?composedRef.current:sourceRef.current;
    if(!active||!passive)return;
    const ignored=ignoreSyncRef.current[side];
    if(ignored && performance.now()<ignored.until && Math.abs(active.scrollTop-ignored.top)<2)return;
    if(syncFrameRef.current!==null)cancelAnimationFrame(syncFrameRef.current);
    syncFrameRef.current=requestAnimationFrame(()=>{
      syncFrameRef.current=null;
      const markers=(pane:HTMLDivElement)=>[...pane.querySelectorAll<HTMLElement>("[data-region-index]")]
        .map(n=>({regionIndex:Number(n.dataset.regionIndex),top:n.getBoundingClientRect().top-
          pane.getBoundingClientRect().top+pane.scrollTop}))
        .filter(m=>Number.isInteger(m.regionIndex));
      const target=synchronizeSemanticPanes(
        {markers:markers(active),scrollTop:active.scrollTop,clientHeight:active.clientHeight,scrollHeight:active.scrollHeight},
        {markers:markers(passive),scrollTop:passive.scrollTop,clientHeight:passive.clientHeight,scrollHeight:passive.scrollHeight});
      ignoreSyncRef.current[side==="source"?"composed":"source"]={top:target,until:performance.now()+180};
      passive.scrollTop=target;
    });
  };
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
    ["--reader-line-height" as string]:density==="compact"?1.4:density==="airy"?1.95:1.65,
    ["--reader-paragraph-gap" as string]:density==="compact"?"0.65em":density==="airy"?"1.4em":"1em",
    ["--reader-page-height" as string]:(measured?.viewportHeight??758)+"px",
  } as CSSProperties;
  return <main className="semantic-reader">
    <header><h1>ARTales · Sémantický Reader v2 (QA)</h1>
      <p>Textová zkouška, nikoli veřejná publikace. Redakční srovnání originálu a nové kompozice.</p>
      <div className="semantic-reader__controls">
        {focus?<label>Čtení <select value={mode==="spread"?"spread":"scroll"} onChange={e=>setReaderMode(e.target.value as typeof readerMode)}>
          <option value="scroll">Plynulý text</option>{deviceWidth>=700&&width>=700&&<option value="spread">Dvoustrana</option>}
        </select></label>:<span>Redakční srovnání · stránky</span>}
        <label>Velikost <input aria-label="Velikost textu" type="range" min="0.85" max="1.3"
          step="0.05" value={scale} onChange={e=>setScale(Number(e.target.value))}/></label>
        <label>Řádkování <select aria-label="Hustota řádkování" value={density}
          onChange={e=>setDensity(e.target.value as ReadingSpacing)}>
          <option value="comfortable">Normální</option><option value="compact">Zhuštěné</option>
          <option value="airy">Vzdušnější (QA)</option>
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
    {focus&&<section className="semantic-reader__note-lab" aria-label="Testování čtenářských poznámek">
      <h2>Poznámky · izolované QA</h2>
      <p>Poznámky zůstávají pouze v paměti náhledu; obnovení stránky je smaže. Žádný zápis do účtu.</p>
      <label>Místo v textu <select aria-label="Místo poznámky" value={chosen?.unit.id??""}
        onChange={e=>setSelectedUnit(e.target.value)}>
        {anchorable.map(({unit,pageIndex})=><option key={unit.id} value={unit.id}>
          {"Strana "+(pageIndex+1)+" · "+unit.kind+" · "+unit.id.slice(-14)}</option>)}
      </select></label>
      <label>Název <input maxLength={160} value={noteTitle} onChange={e=>setNoteTitle(e.target.value)} /></label>
      <label>Text poznámky <textarea maxLength={4000} value={noteBody} onChange={e=>setNoteBody(e.target.value)} /></label>
      <label>Barva <select value={noteColor} onChange={e=>setNoteColor(e.target.value as ReaderNoteColor)}>
        {(["gold","blue","green","rose","violet"] as const).map(color=><option key={color} value={color}>{color}</option>)}
      </select></label>
      <button type="button" disabled={!chosen} onClick={addQaNote}>Uložit testovací poznámku</button>
      <div aria-live="polite">{noteFeedback}</div>
      {qaNotes.map(saved=><div key={saved.note.id} className="semantic-reader__note-entry">
        <span>{saved.note.title||"Bez názvu"} · {saved.note.color}</span>
        <button type="button" onClick={()=>jumpToQaNote(saved)}>Přejít na poznámku</button>
        <button type="button" onClick={()=>setQaNotes(notes=>notes.filter(n=>n.note.id!==saved.note.id))}>Smazat</button>
      </div>)}
    </section>}
    <div className={"semantic-reader__triptych"+(focus?" semantic-reader__triptych--focus":"")}>
      {!focus&&<section aria-label="Archivní Gutenberg"><h2>Gutenberg #11 · originál</h2>
        <div ref={sourceRef} className="semantic-reader__paired-scroll semantic-reader__source-sheet"
          onScroll={()=>synchronize("source")} data-qa-pane="source">
          {sourceRegions.map((part,i)=><div key={i}
            {...(part.regionIndex!==null?{"data-region-index":part.regionIndex}:{})}
            data-source-start={part.start} data-source-end={part.end}
            className="semantic-reader__source-region">{part.text}</div>)}
        </div>
      </section>}
      <section aria-label="Nová sémantická revize"><h2>ARTales · sémantická kompozice</h2>
        <div className={"semantic-reader__viewport"+(!focus?" semantic-reader__paired-scroll":"")} ref={node=>{frameRef.current=node;composedRef.current=node;}}
          onScroll={()=>synchronize("composed")} style={viewportStyle}
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
              {page.units.map(u=><div className="semantic-reader__unit" key={u.id} data-page-unit-id={u.id}
                {...(regionIndices.has(u.fragment?.original_unit_id??u.id)?{"data-region-index":regionIndices.get(u.fragment?.original_unit_id??u.id)}:{})}>
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
