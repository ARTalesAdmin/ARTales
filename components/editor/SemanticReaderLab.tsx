"use client";
import {useEffect, useMemo, useRef, useState, type CSSProperties} from "react";
import {resolveQaProjectionMode, buildSemanticSourceRegions} from "@/lib/semantic/qaReaderModes";
import {synchronizeSemanticPanes} from "@/lib/semantic/pairedSemanticScroll";
import {createSessionReaderNote,locateSessionReaderNote,locateAndSortSessionNotes,selectActiveQaReadingUnit,type SessionReaderNote} from "@/lib/semantic/qaNoteSession";
import SemanticReaderNotesQa from "./SemanticReaderNotesQa";
import {getProfileReaderSettings, type FixtureProfileReaderDefaults} from "@/lib/fixtures/readerPreferences";
import {defaultReaderSettings, type ReaderDensityId} from "@/lib/reader/readerSettings";
import type {SemanticRevision} from "@/lib/semantic/model";
import SemanticUnitContent from "@/components/reader/SemanticUnitContent";
import {getSemanticPageUnits, projectSemanticReader, verifyReaderProjection} from "@/lib/semantic/readerProjectionCore";
import {selectEditorialEdition} from "@/lib/semantic/editionProjection";
import SemanticQaPanel,{type SemanticQaFlag} from "./SemanticQaPanel";
import "./semantic-reader.css";

type Props={revision:SemanticRevision;original:string;profileReaderDefaults?:FixtureProfileReaderDefaults|null;
 candidateId:string;revisionSha:string;editionTitle:string;editionAuthor:string;
 flags:SemanticQaFlag[];qaDatabaseReady:boolean;protectedTerms:string[];
 systemSignals:{atomId:string;sourceStart:number;reason:string;kind:"source_ambiguity"}[];
 canCommitBatch:boolean;currentTaskId:string|null;
 reviewDecisions:{issue_id:string;decision:string;note:string|null;reviewed_at:string}[];}
type ReadingSpacing = ReaderDensityId | "airy";
type PaneSide = "source" | "composed";
type BrowserMeasurements={
  key:string;pageWidth:number;viewportHeight:number;heights:Record<string,number>;
};
function sameMeasurements(a:BrowserMeasurements|null,b:BrowserMeasurements) {
  if(!a||a.key!==b.key||a.pageWidth!==b.pageWidth||a.viewportHeight!==b.viewportHeight)return false;
  const keys=Object.keys(b.heights);
  return keys.length===Object.keys(a.heights).length&&keys.every(key=>a.heights[key]===b.heights[key]);
}

export default function SemanticReaderLab({
 revision,original,profileReaderDefaults=null,candidateId,revisionSha,editionTitle,editionAuthor,
 flags,qaDatabaseReady,protectedTerms,systemSignals,canCommitBatch,currentTaskId,reviewDecisions
}:Props) {
  const accountPreferences=getProfileReaderSettings(profileReaderDefaults)??defaultReaderSettings;
  const [readerMode,setReaderMode]=useState<"scroll"|"spread">("scroll");
  const [deviceWidth,setDeviceWidth]=useState(1366);
  const [scale,setScale]=useState(accountPreferences.fontScale);
  const [density,setDensity]=useState<ReadingSpacing>(accountPreferences.density);
  const [width,setWidth]=useState(900);
  const [focus,setFocus]=useState(false);
  const [selectedAtomId,setSelectedAtomId]=useState<string|null>(null);
  const [qaPanelOpen,setQaPanelOpen]=useState(false);
  const [showOpenFlags,setShowOpenFlags]=useState(true);
  const [pageNumber,setPageNumber]=useState(0);
  const [fullscreen,setFullscreen]=useState(false);
  const [preview,setPreview]=useState<{parentSha:string;draft:SemanticRevision}|null>(null);
  const previewRevision=preview?.parentSha===revisionSha?preview.draft:null;
  const activeRevision=previewRevision??revision;
  const edition=useMemo(()=>selectEditorialEdition(original),[original]);
  const [metrics,setMetrics]=useState<BrowserMeasurements|null>(null);
  const [qaNotes,setQaNotes]=useState<SessionReaderNote[]>([]);
  const [selectedNoteId,setSelectedNoteId]=useState<string|null>(null);
  const [notesListExpanded,setNotesListExpanded]=useState<boolean|null>(null);
  const [readingPosition,setReadingPosition]=useState<{unitId:string;pageIndex:number}|null>(null);
  const [openNotesRequest,setOpenNotesRequest]=useState(0);
  const [noteFeedback,setNoteFeedback]=useState("");
  const rootRef=useRef<HTMLElement>(null);
  const frameRef=useRef<HTMLDivElement>(null);
  const sourceRef=useRef<HTMLDivElement>(null);
  const composedRef=useRef<HTMLDivElement>(null);
  const syncFrameRef=useRef<number|null>(null);
  const ignoreSyncRef=useRef<Record<PaneSide,{top:number;until:number}|null>>({source:null,composed:null});
  const measureRef=useRef<HTMLDivElement>(null);
  const mode=resolveQaProjectionMode(focus?"reader":"editor",readerMode,width,deviceWidth);
  const measureKey=[activeRevision.revision_ref,mode,scale,density,width,focus,fullscreen,edition.range.start,edition.range.end].join("|");
  const measured=metrics?.key===measureKey?metrics:null;
  const allUnits=useMemo(()=>getSemanticPageUnits(activeRevision,edition.range),[activeRevision,edition]);
  const sourceRegions=useMemo(()=>buildSemanticSourceRegions(original,allUnits,edition.range),[original,allUnits,edition]);
  const regionIndices=useMemo(()=>new Map(sourceRegions.filter(x=>x.regionIndex!==null && x.unitId!==null)
    .map(x=>[x.unitId!,x.regionIndex!])),[sourceRegions]);
  const unitsById=useMemo(()=>new Map(allUnits.map(u=>[u.id,u])),[allUnits]);
  const selectedUnit=allUnits.find(u=>selectedAtomId&&u.source_atom_ids.includes(selectedAtomId));
  const selectedText=selectedUnit?.kind==="chapter_heading"||selectedUnit?.kind==="section_heading"
    ? "heading" in selectedUnit.node?selectedUnit.node.heading.raw:null
    :selectedUnit&&"atom" in selectedUnit.node?selectedUnit.node.atom.raw:null;
  const effectiveDensity:ReaderDensityId=density==="airy"?"comfortable":density;
  const fallbackWidth=focus?(mode==="spread"&&width>=700?Math.floor((width-42)/2):width-24):340;
  const pages=useMemo(()=>projectSemanticReader(activeRevision,{
    mode,viewport_width:measured?.pageWidth??Math.max(220,fallbackWidth),
    viewport_height:measured?.viewportHeight??850,font_scale:scale,density:effectiveDensity,
    measured_unit_heights:measured?.heights,editionRange:edition.range,
  }),[activeRevision,mode,scale,effectiveDensity,measured,fallbackWidth,edition.range]);
  const integrity=verifyReaderProjection(activeRevision,pages,edition.range);
  const locatedNotes=useMemo(()=>locateAndSortSessionNotes(activeRevision,pages,qaNotes),[activeRevision,pages,qaNotes]);
  const selectedNoteIndex=locatedNotes.findIndex(item=>item.saved.note.id===selectedNoteId);
  const expanded=notesListExpanded??locatedNotes.length<=3;
  const pageUnits=useMemo(()=>new Map(pages.flatMap(page=>
    page.units.map(unit=>[unit.id,{unit,pageIndex:page.index}] as const))),[pages]);
  const currentUnit=readingPosition?pageUnits.get(readingPosition.unitId):null;

  const addQaNote=(input:{title:string;body:string;color:import("@/lib/reader/readerStorage").ReaderNoteColor}):boolean=>{
    if(!currentUnit||currentUnit.unit.kind==="title_page"){
      setNoteFeedback("Posuň se na text díla, aby se poznámka měla kam ukotvit.");
      return false;
    }
    try{
      const saved=createSessionReaderNote(activeRevision,currentUnit.unit,{
        id:crypto.randomUUID(),...input,
        now:new Date().toISOString(),pageIndex:currentUnit.pageIndex,pageCount:pages.length,
        layoutMode:mode==="spread"?"spread":"pagedFlow",
      });
      setQaNotes(current=>[...current,saved]);
      setSelectedNoteId(saved.note.id);
      setNoteFeedback("Testovací poznámka přidána pouze do této relace.");
      return true;
    }catch(e){
      setNoteFeedback(e instanceof Error?e.message:"Poznámku nelze vytvořit.");
      return false;
    }
  };
  const jumpToQaNote=(saved:SessionReaderNote)=>{
    const location=locateSessionReaderNote(activeRevision,pages,saved);
    if(location.status!=="exact"||!location.unitId){
      setNoteFeedback("Kotva není dostupná; původní poznámka zůstává zachována.");return;
    }
    const units=frameRef.current?.querySelectorAll<HTMLElement>('[data-qa-projection="visible"] [data-page-unit-id]');
    const target=[...(units??[])].find(node=>node.dataset.pageUnitId===location.unitId);
    if(!target){setNoteFeedback("Cílový blok ještě není vykreslen.");return;}
    setSelectedNoteId(saved.note.id);
    target.scrollIntoView({behavior:"smooth",block:"center"});
    setNoteFeedback("Návrat podle obsahové kotvy, nikoli původního čísla stránky.");
  };
  const goToRelativeNote=(delta:number)=>{
    const index=selectedNoteIndex+delta;
    if(index>=0&&index<locatedNotes.length)jumpToQaNote(locatedNotes[index].saved);
  };
  const deleteQaNote=(saved:SessionReaderNote)=>{
    setQaNotes(notes=>notes.filter(n=>n.note.id!==saved.note.id));
    if(selectedNoteId===saved.note.id)setSelectedNoteId(null);
    setNoteFeedback("Testovací poznámka smazána pouze z této relace.");
  };

  useEffect(()=>{
    const list=locatedNotes;
    if(list.length===0){
      // eslint-disable-next-line react-hooks/set-state-in-effect -- keep QA note selection in sync with loaded revision
      setSelectedNoteId(previous=>previous===null?previous:null);
    }else if(!list.some(item=>item.saved.note.id===selectedNoteId)){
      setSelectedNoteId(list[0].saved.note.id);
    }
  },[locatedNotes,selectedNoteId]);
  useEffect(()=>{
    if(!focus){
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset nonpersistent QA-only reading state
      setReadingPosition(previous=>previous===null?previous:null);return;}
    let frame=0;
    const update=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const root=frameRef.current;
        const visible=root?.querySelector<HTMLElement>('[data-qa-projection="visible"]');
        if(!visible)return;
        const measured=[...visible.querySelectorAll<HTMLElement>("[data-page-unit-id]")].map(element=>{
          const entry=pageUnits.get(element.dataset.pageUnitId??"");
          const rect=element.getBoundingClientRect();
          return {
            unitId:element.dataset.pageUnitId??"",
            pageIndex:entry?.pageIndex??-1,top:rect.top,bottom:rect.bottom,
            anchorable:Boolean(entry&&entry.unit.kind!=="title_page"&&entry.unit.source_atom_ids.length),
          };
        });
        const next=selectActiveQaReadingUnit(measured,window.innerHeight*0.35,window.innerHeight);
        setReadingPosition(previous=>(previous?.unitId===next?.unitId&&previous?.pageIndex===next?.pageIndex)
          ?previous:next);
      });
    };
    window.addEventListener("scroll",update,{passive:true});
    window.addEventListener("resize",update);
    update();
    return()=>{cancelAnimationFrame(frame);window.removeEventListener("scroll",update);
      window.removeEventListener("resize",update);};
  },[focus,pageUnits]);
  useEffect(()=>{
    const update=()=>setDeviceWidth(window.innerWidth);
    update();window.addEventListener("resize",update);
    return()=>window.removeEventListener("resize",update);
  },[]);
  useEffect(()=>()=>{if(syncFrameRef.current!==null)cancelAnimationFrame(syncFrameRef.current);},[]);
  useEffect(()=>{
    const change=()=>setFullscreen(document.fullscreenElement===rootRef.current);
    document.addEventListener("fullscreenchange",change);
    return()=>document.removeEventListener("fullscreenchange",change);
  },[]);
  const toggleFullscreen=async()=>{
    if(document.fullscreenElement===rootRef.current)await document.exitFullscreen();
    else if(!document.fullscreenElement)await rootRef.current?.requestFullscreen();
  };
  const scrollToMarker=(pane:HTMLDivElement|null,unitId:string)=>{
    if(!pane)return;
    const node=[...pane.querySelectorAll<HTMLElement>("[data-semantic-root]")].find(
      n=>n.dataset.semanticRoot===unitId);
    if(!node)return;
    const current=node.getBoundingClientRect().top-pane.getBoundingClientRect().top;
    pane.scrollTo({top:pane.scrollTop+current-25,behavior:"smooth"});
  };
  const selectAtom=(id:string)=>{
    if(selectedAtomId===id){setSelectedAtomId(null);setQaPanelOpen(false);return;}
    setSelectedAtomId(id);setQaPanelOpen(true);
    const unit=allUnits.find(u=>u.source_atom_ids.includes(id));
    if(unit){
      scrollToMarker(sourceRef.current,unit.id);
      scrollToMarker(composedRef.current,unit.id);
    }
  };
  const jumpToPage=(index:number)=>{
    const pane=composedRef.current;
    if(!pane)return;
    const node=[...pane.querySelectorAll<HTMLElement>("[data-page-index]")].find(
      e=>Number(e.dataset.pageIndex)===index-1);
    if(node){
      const top=node.getBoundingClientRect().top-pane.getBoundingClientRect().top;
      pane.scrollTo({top:pane.scrollTop+top-6,behavior:"smooth"});
      setPageNumber(index);
    }
  };
  const updateCurrentPage=()=>{
    const pane=composedRef.current;
    if(!pane)return;
    const origin=pane.getBoundingClientRect().top;
    const candidates=[...pane.querySelectorAll<HTMLElement>('[data-qa-projection="visible"] [data-page-index]')];
    const visible=candidates.findLast(n=>n.getBoundingClientRect().top<=origin+60);
    if(visible){
      const index=Number(visible.dataset.pageIndex)+1;
      setPageNumber(previous=>previous===index?previous:index);
    }
  };
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
  return <main ref={rootRef} className={"semantic-reader"+(fullscreen?" semantic-reader--fullscreen":"")}>
    <header><h1>ARTales · Sémantický Reader v2 (QA)</h1>
      {previewRevision?<div role="status" className="semantic-reader__live-preview">
       <strong>Náhled opravené sazby · neuloženo</strong>
       <p>Stejný literární text, ověřené kotvy. Zkontroluj změny a stránkování;
        zavřením náhledu se vrátíš k původní revizi.</p>
       <button type="button" onClick={()=>{setPreview(null);setPageNumber(0);}}>
        Vrátit původní sazbu</button>
      </div>:null}
      <p>Textová zkouška, nikoli veřejná publikace. Redakční srovnání literárního textu.</p>
      <p className="semantic-reader__edition-note">ARTales vydání: Gutenberg distribuční a právní
        aparát je vynechán z náhledu, ale zůstává v soukromém archivu a úplné revizi.
        {edition.warnings.map(w=><span key={w}> {w}</span>)}</p>
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
        <button type="button" className="semantic-reader__fullscreen-button"
          onClick={()=>void toggleFullscreen()} aria-pressed={fullscreen}>
          {fullscreen?"Ukončit celou obrazovku":"Celá obrazovka"}
        </button>

        <span className="semantic-reader__qa-key">
          <span className="semantic-reader__key-swatch semantic-reader__key-swatch--changed"/> Opravený blok
          <span className="semantic-reader__key-swatch semantic-reader__key-swatch--selected"/> Aktivní výběr
        </span>
        <label><input type="checkbox" checked={showOpenFlags}
          onChange={e=>setShowOpenFlags(e.target.checked)}/> Upozornění na otevřené nálezy</label>
        <button type="button" className="semantic-reader__fullscreen-button"
          aria-expanded={qaPanelOpen} onClick={()=>setQaPanelOpen(v=>!v)}>
          Nálezy ({flags.filter(f=>f.status==="open").length})
        </button>
        <label className="semantic-reader__page-navigation">Strana
          <input type="range" min={0} max={pages.length} step={1} value={Math.min(pageNumber,pages.length)}
            onChange={e=>jumpToPage(Number(e.target.value))}
            aria-label="Přejít na stránku"/>
          <span>{pageNumber===0?"Titulka":pageNumber+" / "+pages.length}</span>
        </label>
        <span role="status">{integrity.ok?"QA: zachováno pořadí jednotek":"QA selhala"} · {pages.length+1} stránek
          {" · "}{measured?"měřeno prohlížečem":"předběžný odhad"}
        </span>
      </div>
    </header>
    {qaPanelOpen&&<div className="semantic-qa-overlay">
      <button type="button" className="semantic-qa-overlay__close" onClick={()=>setQaPanelOpen(false)}
        aria-label="Zavřít panel nálezů">×</button>
      <SemanticQaPanel candidateId={candidateId} revisionSha={revisionSha}
        selectedAtomId={selectedAtomId} selectedText={selectedText??null}
        flags={flags} databaseReady={qaDatabaseReady} onSelect={selectAtom}
        systemSignals={systemSignals} canCommitBatch={canCommitBatch}
        currentTaskId={currentTaskId} reviewDecisions={reviewDecisions}
        currentChangeIssues={revision.review_issues.filter(issue=>issue.round===revision.round)}
        onPreview={next=>{setPreview({parentSha:revisionSha,draft:next});setPageNumber(0);setQaPanelOpen(false);}}
        onSaved={()=>{setPreview(null);setQaPanelOpen(false);setSelectedAtomId(null);}}/>
    </div>}
    {focus&&<SemanticReaderNotesQa notes={locatedNotes} selectedNoteId={selectedNoteId}
      selectedNoteIndex={selectedNoteIndex} listExpanded={expanded} status={noteFeedback}
      canAddNote={Boolean(currentUnit&&currentUnit.unit.kind!=="title_page")}
      openRequest={openNotesRequest}
      onAdd={addQaNote} onGoTo={jumpToQaNote}
      onPrevious={()=>goToRelativeNote(-1)} onNext={()=>goToRelativeNote(1)}
      onListExpanded={setNotesListExpanded} onDelete={deleteQaNote}/>}
    <div className={"semantic-reader__triptych"+(focus?" semantic-reader__triptych--focus":"")}>
      {!focus&&<section aria-label="Archivní Gutenberg"><h2>Gutenberg #389 · literární text</h2>
        <div ref={sourceRef} className="semantic-reader__paired-scroll semantic-reader__source-sheet"
          onScroll={()=>synchronize("source")} data-qa-pane="source">
          {sourceRegions.map((part,i)=><div key={i}
            data-semantic-root={part.unitId??undefined}
            data-selected={part.unitId&&selectedUnit?.id===part.unitId?"true":undefined}
            data-review-signal={part.unitId&&systemSignals.some(s=>
              unitsById.get(part.unitId??"")?.source_atom_ids.includes(s.atomId))?"true":undefined}
            data-review-fixed={part.unitId&&activeRevision.review_issues.some(issue=>
              issue.round===activeRevision.round&&unitsById.get(part.unitId??"")?.source_atom_ids.includes(issue.target_atom_id))?"true":undefined}
            {...(part.regionIndex!==null?{"data-region-index":part.regionIndex}:{})}
            data-source-start={part.start} data-source-end={part.end}
            className="semantic-reader__source-region">
            {part.unitId&&unitsById.get(part.unitId)?.source_atom_ids[0]?
              <button type="button" className="semantic-reader__block-picker"
                onClick={()=>selectAtom(unitsById.get(part.unitId??"")!.source_atom_ids[0])}
                aria-label="Vybrat tento blok v originálu">◆</button>:null}
            {part.text}</div>)}
        </div>
      </section>}
      <section aria-label="Nová sémantická revize"><h2>ARTales · sémantická kompozice</h2>
        <div className={"semantic-reader__viewport"+(!focus?" semantic-reader__paired-scroll":"")} ref={node=>{frameRef.current=node;composedRef.current=node;}}
          onScroll={()=>{synchronize("composed");updateCurrentPage();}} style={viewportStyle}
          data-target-width={width} data-focused={focus} data-density={density}>
          <div ref={measureRef} className="semantic-reader__measurement" aria-hidden="true">
            <div className={"semantic-reader__pages semantic-reader__pages--"+mode}>
              <article className="semantic-reader__page semantic-reader__measurement-page">
                {allUnits.map(u=><div className="semantic-reader__unit" key={u.id}
                  data-measure-id={u.id}>{<SemanticUnitContent unit={u} protectedTerms={protectedTerms}/>}</div>)}
              </article>
            </div>
          </div>
          <div className={"semantic-reader__pages semantic-reader__pages--"+mode} data-qa-projection="visible">
            <article className="semantic-reader__page semantic-reader__front-page" data-page-index="-1"
              data-mode={mode}>
              <div className="semantic-reader__front-inner">
                <span className="semantic-reader__front-brand">ARTales</span>
                <h2>{editionTitle}</h2><p className="semantic-reader__front-author">{editionAuthor}</p>
                <div className="semantic-reader__front-ornament">✦</div>
                <p className="semantic-reader__front-love">ARTales with Love</p>
              </div>
            </article>
            {pages.map(page=><article className="semantic-reader__page" key={page.index}
              data-page-index={page.index} data-overflow={page.overflow} data-mode={mode}>
              {page.units.map(u=>{
                const notesAtUnit=focus?locatedNotes.filter(item=>item.unitId===u.id):[];
                const first=notesAtUnit[0];
                const selectedHere=notesAtUnit.some(item=>item.saved.note.id===selectedNoteId);
                return <div className="semantic-reader__unit" key={u.id} data-page-unit-id={u.id}
                  data-semantic-root={u.fragment?.original_unit_id??u.id}
                  data-selected={selectedAtomId&&u.source_atom_ids.includes(selectedAtomId)?"true":undefined}
                  data-review-flag={showOpenFlags&&flags.some(f=>f.status==="open"&&u.source_atom_ids.includes(f.target_atom_id))?"open":undefined}
                  data-review-signal={systemSignals.some(s=>u.source_atom_ids.includes(s.atomId))?"true":undefined}
                  data-review-fixed={activeRevision.review_issues.some(issue=>issue.round===activeRevision.round&&
                    u.source_atom_ids.includes(issue.target_atom_id))?"true":undefined}
                  {...(regionIndices.has(u.fragment?.original_unit_id??u.id)?{"data-region-index":regionIndices.get(u.fragment?.original_unit_id??u.id)}:{})}>
                  {u.source_atom_ids[0]&&<button type="button"
                    className="semantic-reader__block-picker"
                    onClick={()=>selectAtom(u.source_atom_ids[0])}
                    aria-label="Vybrat tento sémantický blok">◆</button>}
                  {first&&<button type="button"
                    className={"semantic-reader__note-marker artales-reader-note-marker--"+first.saved.note.color+
                      (selectedHere?" semantic-reader__note-marker--selected":"")}
                    title={notesAtUnit.length>1?"Poznámky na tomto místě: "+notesAtUnit.length:"Poznámka na tomto místě"}
                    aria-label={"Otevřít poznámky na straně "+(page.index+1)}
                    onClick={()=>{
                      jumpToQaNote(first.saved);setNotesListExpanded(true);setOpenNotesRequest(x=>x+1);
                    }}>
                    {notesAtUnit.length>1?notesAtUnit.length:null}
                  </button>}
                  {<SemanticUnitContent unit={u} protectedTerms={protectedTerms}/>}</div>;
              })}
              <footer>QA strana {page.index+2}
                {page.overflow==="scroll_unit"?" · dlouhý celek, bez rozdělení":""}
              </footer>
            </article>)}
          </div>
        </div>
      </section>
    </div>
  </main>;
}
