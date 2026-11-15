"use client";
import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from "react";
import ReaderToolbar from "@/components/reader/ReaderToolbar";
import {unitView,type ApprovedSemanticImage} from "@/components/reader/SemanticPageUnit";
import {paginateSemanticUnits} from "@/lib/semantic/readerProjection";
import type {SemanticPage,SemanticPageUnit} from "@/lib/semantic/model";
import type {SupportedLocale} from "@/lib/i18n/config";
import {getPublicDictionary} from "@/lib/i18n/public";
import {clampReaderFontScale,defaultReaderSettings,type ReaderSettings} from "@/lib/reader/readerSettings";
import {loadReaderSettings,saveReaderSettings,loadReaderProgress,saveReaderProgress,
 loadReaderNotes,saveReaderNotes,type ReaderNote,type ReaderNoteColor} from "@/lib/reader/readerStorage";
import "./reader.css";
import "../editor/semantic-reader.css";
import "./semantic-public-reader.css";

type Props={
 slug:string;title:string;locale:SupportedLocale;mode:"preview"|"full";
 revisionSha:string;units:SemanticPageUnit[];
 protectedTerms?:string[];visuals?:ApprovedSemanticImage[];
};
type Measurements={key:string;heights:Record<string,number>};
const countProgress=(index:number,count:number)=>count<=1?100:Math.max(0,Math.min(100,index/(count-1)*100));
const pageStart=(index:number,spread:boolean)=>spread?index-index%2:index;

export default function SemanticReaderClient({slug,title,locale,mode,revisionSha,units,
 protectedTerms=[],visuals=[]}:Props){
 const [settings,setSettings]=useState<ReaderSettings>(defaultReaderSettings);
 const [hydrated,setHydrated]=useState(false);
 const [viewport,setViewport]=useState({width:1024,height:780});
 const [measurements,setMeasurements]=useState<Measurements|null>(null);
 const [pageIndex,setPageIndex]=useState(0);
 const [notes,setNotes]=useState<ReaderNote[]>([]);
 const [selectedNoteId,setSelectedNoteId]=useState<string|null>(null);
 const [notesExpanded,setNotesExpanded]=useState(false);
 const measureRef=useRef<HTMLDivElement|null>(null);
 const flowRef=useRef<HTMLDivElement|null>(null);
 const restoredRef=useRef(false);
 const dict=getPublicDictionary(locale);
 const labels=dict.reader;
 const spread=settings.layoutMode==="spread"&&viewport.width>=860;
 const targetWidth=settings.width==="narrow"?620:settings.width==="wide"?940:760;
 const pageWidth=Math.max(240,Math.min(targetWidth,
  spread?(viewport.width-88)/2:viewport.width-48));
 const pageHeight=Math.max(540,Math.min(1040,viewport.height-95));
 const measureKey=[revisionSha,mode,pageWidth,pageHeight,settings.fontScale,
  settings.density,units.length].join("|");
 const readyMeasurements=measurements?.key===measureKey?measurements.heights:undefined;
 const pages=useMemo(()=>paginateSemanticUnits(units,{
  mode:"paged",viewport_width:pageWidth,viewport_height:pageHeight,
  font_scale:settings.fontScale,density:settings.density,
  measured_unit_heights:readyMeasurements,
 }),[units,pageWidth,pageHeight,settings.fontScale,settings.density,readyMeasurements]);
 const total=Math.max(1,pages.length);
 const current=Math.max(0,Math.min(pageIndex,total-1));
 const visibleStart=pageStart(current,spread);
 const progress=countProgress(current,total);
 const notesSorted=useMemo(()=>[...notes].sort((a,b)=>
  (a.progressPercent-b.progressPercent)||a.createdAt.localeCompare(b.createdAt)),[notes]);
 const selectedNoteIndex=notesSorted.findIndex(n=>n.id===selectedNoteId);
 const pageStyle={
  width:pageWidth+"px",maxWidth:"100%",
  ["--reader-scale" as string]:String(settings.fontScale),
  ["--reader-line-height" as string]:settings.density==="compact"?"1.4":"1.65",
  ["--reader-paragraph-gap" as string]:settings.density==="compact"?"0.65em":"1em",
  ["--reader-page-height" as string]:pageHeight+"px",
 } as CSSProperties;

 useEffect(()=>{
  const update=()=>setViewport({width:window.innerWidth,height:window.innerHeight});
  update();window.addEventListener("resize",update);
  return ()=>window.removeEventListener("resize",update);
 },[]);
 useEffect(()=>{
  setSettings({...loadReaderSettings(),controlsCollapsed:true});
  setNotes(loadReaderNotes(slug,title));
  setHydrated(true);
 },[slug,title]);
 useEffect(()=>{if(hydrated)saveReaderSettings(settings)},[hydrated,settings]);
 // Read the stable, user-owned progress only once. Page counts can change when
 // font/width changes, so restore by percentage rather than by stale page ID.
 useEffect(()=>{
  if(!hydrated||restoredRef.current||!total)return;
  const saved=mode==="full"?loadReaderProgress(slug):null;
  if(saved&&Number.isFinite(saved.progressPercent)){
   const next=Math.max(0,Math.min(total-1,Math.round(saved.progressPercent/100*(total-1))));
   setPageIndex(next);
  }
  restoredRef.current=true;
 },[hydrated,mode,slug,total]);
 useEffect(()=>{
  if(!hydrated||!restoredRef.current||mode!=="full")return;
  saveReaderProgress({
   slug,mode:"full",pageIndex:current,pageCount:total,progressPercent:progress,
   scrollY:current,layoutMode:settings.layoutMode,updatedAt:new Date().toISOString(),
  });
 },[hydrated,mode,slug,current,total,progress,settings.layoutMode]);
 useEffect(()=>{setPageIndex(old=>Math.min(old,total-1))},[total]);
 // The exact same semantic markup is measured before repagination as in QA.
 useEffect(()=>{
  const measure=()=>{
   const root=measureRef.current;
   if(!root)return;
   const elements=[...root.querySelectorAll<HTMLElement>("[data-semantic-measure-id]")];
   if(elements.length!==units.length)return;
   const heights:Record<string,number>={};
   for(const element of elements){
    const id=element.dataset.semanticMeasureId;
    if(!id)return;
    heights[id]=Math.max(1,Math.round(element.getBoundingClientRect().height*2)/2);
   }
   setMeasurements(previous=>{
    if(previous?.key===measureKey&&Object.keys(heights).length===Object.keys(previous.heights).length
      &&Object.keys(heights).every(k=>previous.heights[k]===heights[k]))return previous;
    return {key:measureKey,heights};
   });
  };
  const frame=requestAnimationFrame(measure);
  const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(measure):null;
  if(measureRef.current)observer?.observe(measureRef.current);
  document.fonts?.ready.then(measure).catch(()=>{});
  return ()=>{cancelAnimationFrame(frame);observer?.disconnect()};
 },[measureKey,units]);

 // The toolbar's menu and progress are the existing public Reader controls.
 const toggleControls=useCallback(()=>setSettings(old=>({
  ...old,controlsCollapsed:!old.controlsCollapsed
 })),[]);
 const patch=useCallback((next:Partial<ReaderSettings>)=>setSettings(old=>({...old,...next})),[]);
 const goToIndex=useCallback((index:number)=>{
  const safe=Math.max(0,Math.min(total-1,index));
  const target=pageStart(safe,spread);
  setPageIndex(target);
  if(!spread){
   const element=flowRef.current?.querySelector<HTMLElement>(
    '[data-semantic-page-index="'+target+'"]');
   element?.scrollIntoView({behavior:"smooth",block:"start"});
  }
 },[total,spread]);
 useEffect(()=>{
  if(!spread)return;
  const keydown=(e:KeyboardEvent)=>{
   if((e.target as HTMLElement|null)?.closest("input,textarea,select,button,a"))return;
   if(["ArrowRight","PageDown"].includes(e.key)){
    e.preventDefault();goToIndex(visibleStart+2);
   }
   if(["ArrowLeft","PageUp"].includes(e.key)){
    e.preventDefault();goToIndex(visibleStart-2);
   }
  };
  window.addEventListener("keydown",keydown);
  return ()=>window.removeEventListener("keydown",keydown);
 },[spread,goToIndex,visibleStart]);
 useEffect(()=>{
  if(spread)return;
  const onScroll=()=>{
   const elements=flowRef.current?.querySelectorAll<HTMLElement>("[data-semantic-page-index]");
   if(!elements?.length)return;
   let idx=0;
   for(const el of elements){
    const box=el.getBoundingClientRect();
    if(box.top<=window.innerHeight*.38)idx=Number(el.dataset.semanticPageIndex||0);
   }
   setPageIndex(old=>old===idx?old:idx);
  };
  window.addEventListener("scroll",onScroll,{passive:true});
  return ()=>window.removeEventListener("scroll",onScroll);
 },[spread,pages.length]);
 const addNote=useCallback((input:{title:string;body:string;color:ReaderNoteColor})=>{
  const stamp=new Date().toISOString();
  const note:ReaderNote={
   id:crypto.randomUUID(),slug,title:input.title.trim(),body:input.body.trim(),
   color:input.color,progressPercent:progress,scrollY:current,
   pageIndex:current,pageCount:total,layoutMode:settings.layoutMode,
   createdAt:stamp,updatedAt:stamp,source:"local",
  };
  setNotes(old=>{const next=[note,...old];saveReaderNotes(slug,next);return next});
  setSelectedNoteId(note.id);
 },[slug,progress,current,total,settings.layoutMode]);
 const goToNote=(note:ReaderNote)=>{
  setSelectedNoteId(note.id);
  goToIndex(Math.round(note.progressPercent/100*(total-1)));
 };
 const deleteNote=(note:ReaderNote)=>{
  // Synced notes must not silently disappear only from local storage.
  if(note.source==="synced")return;
  setNotes(old=>{const next=old.filter(n=>n.id!==note.id);saveReaderNotes(slug,next);return next});
  if(selectedNoteId===note.id)setSelectedNoteId(null);
 };
 const renderPaper=(page:SemanticPage|undefined,index:number,blank=false)=>{
  const cover=Boolean(page?.units.some(u=>u.kind==="title_page"));
  return <article key={blank?"blank":index} data-semantic-page-index={blank?undefined:index}
   className={"semantic-reader__page semantic-public-reader__paper"+
    (cover?" semantic-reader__front-page":"")+(blank?" semantic-public-reader__paper--blank":"")}
   style={pageStyle}>
   {blank?null:<>
    {!cover?<div className="semantic-public-reader__paper-top" aria-hidden="true">
     <span>{title}</span><span>{index+1}</span>
    </div>:null}
    {page?.units.map(unit=><div key={unit.id} className="semantic-reader__unit" data-semantic-root={unit.fragment?.original_unit_id??unit.id}>
     {unitView(unit,protectedTerms,visuals)}
    </div>)}
    {mode==="preview"&&index===total-1?<aside className="semantic-public-reader__preview-note">
     <p>Ukázka díla. Pokračujte do plné čtečky.</p>
     <a href={"/reader/"+slug+"?mode=full"}>Pokračovat ve čtení</a>
    </aside>:null}
    {!cover?<footer className="semantic-public-reader__paper-footer">{index+1}</footer>:null}
   </>}
  </article>;
 };
 return <main className={"artales-reader artales-reader--semantic artales-reader--theme-"+
   settings.theme+" artales-reader--width-"+settings.width+
   " artales-reader--density-"+settings.density+
   " artales-reader--layout-"+settings.layoutMode+
   " artales-reader--pagefit-"+settings.pageFit}>
  <ReaderToolbar title={title} detailHref={"/work/"+slug}
   mode={mode} fullHref={"/reader/"+slug+"?mode=full"}
   progressPercent={progress} pageIndex={current} pageCount={total}
   settings={{...settings,showAdvancedReaderControls:true}}
   labels={labels} chromeLabels={dict.public}
   notes={notesSorted} notesEnabled={true}
   selectedNoteId={selectedNoteId} selectedNoteIndex={selectedNoteIndex}
   isNotesListExpanded={notesExpanded} notesSyncState="local"
   onFontDelta={delta=>patch({fontScale:clampReaderFontScale(settings.fontScale+delta)})}
   onThemeChange={theme=>patch({theme})}
   onWidthChange={width=>patch({width})}
   onDensityChange={density=>patch({density})}
   onLayoutModeChange={layoutMode=>{patch({layoutMode});setPageIndex(0)}}
   onToggleControls={toggleControls}
   onAddNote={addNote} onGoToNote={goToNote}
   onGoToPreviousNote={()=>{if(selectedNoteIndex>0)goToNote(notesSorted[selectedNoteIndex-1])}}
   onGoToNextNote={()=>{if(selectedNoteIndex>=0&&selectedNoteIndex<notesSorted.length-1)goToNote(notesSorted[selectedNoteIndex+1])}}
   onNotesListExpandedChange={setNotesExpanded}
   onDeleteNote={deleteNote}
   onGoToPage={n=>goToIndex(n-1)}/>
  <section className="artales-reader__stage">
   <div className="semantic-reader semantic-public-reader" style={{
    ["--reader-scale" as string]:String(settings.fontScale),
    ["--reader-line-height" as string]:settings.density==="compact"?"1.4":"1.65",
    ["--reader-paragraph-gap" as string]:settings.density==="compact"?"0.65em":"1em",
   }}>
    <div className="semantic-reader__viewport semantic-public-reader__viewport">
     <div className="semantic-reader__measurement semantic-public-reader__measurement"
      aria-hidden="true" ref={measureRef} style={{width:pageWidth}}>
      <div className="semantic-reader__page semantic-reader__measurement-page" style={pageStyle}>
       {units.map(unit=><div className="semantic-reader__unit" data-semantic-measure-id={unit.id} key={unit.id}>
        {unitView(unit,protectedTerms,visuals)}
       </div>)}
      </div>
     </div>
     {!spread?<div className="semantic-public-reader__flow" ref={flowRef}>
      {pages.map((page,index)=>renderPaper(page,index))}
     </div>:<div className="semantic-public-reader__spread" aria-label="Dvoustránkové čtení">
      {renderPaper(pages[visibleStart],visibleStart)}
      {pages[visibleStart+1]?renderPaper(pages[visibleStart+1],visibleStart+1):renderPaper(undefined,visibleStart+1,true)}
     </div>}
    </div>
   </div>
   {spread?<div className="semantic-public-reader__navigation">
    <button type="button" disabled={visibleStart===0}
     onClick={()=>goToIndex(visibleStart-2)} aria-label="Předchozí dvojstrana">‹</button>
    <span>{visibleStart+1}–{Math.min(total,visibleStart+2)} / {total}</span>
    <button type="button" disabled={visibleStart+2>=total}
     onClick={()=>goToIndex(visibleStart+2)} aria-label="Další dvojstrana">›</button>
   </div>:null}
  </section>
 </main>;
}
