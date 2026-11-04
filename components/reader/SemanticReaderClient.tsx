"use client";
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type CSSProperties} from "react";
import ReaderToolbar from "@/components/reader/ReaderToolbar";
import SemanticUnitContent from "@/components/reader/SemanticUnitContent";
import {projectSemanticUnits} from "@/lib/semantic/readerProjectionCore";
import type {SemanticPage,SemanticPageUnit} from "@/lib/semantic/model";
import {clampReaderFontScale,defaultReaderSettings,type ReaderSettings} from "@/lib/reader/readerSettings";
import {loadReaderSettings,saveReaderSettings,type ReaderNote,type ReaderNoteColor} from "@/lib/reader/readerStorage";
import {filterSemanticReaderNotes,makeSemanticReaderNote,pageForSemanticNote,semanticNotesKey,type SemanticReaderNote} from "@/lib/semantic/readerNotes";
import {getPublicDictionary} from "@/lib/i18n/public";
import type {SupportedLocale} from "@/lib/i18n/config";
import {anchorForSemanticPage,pageForSemanticAnchor,semanticPositionKey,validateSemanticPosition}
 from "@/lib/semantic/readerPosition";
import "./reader.css";
import "./semantic-public-reader.css";

type Image={atomId:string;url:string;caption:string};
const WIDTHS={narrow:620,normal:700,wide:780} as const;
function clamp(n:number,min:number,max:number){return Math.max(min,Math.min(n,max));}
export default function SemanticReaderClient({slug,title,revisionSha,mode,locale,units,images,protectedTerms}:{
 slug:string;title:string;revisionSha:string;mode:"preview"|"full";locale:SupportedLocale;
 units:SemanticPageUnit[];images:Image[];protectedTerms:string[];
}){
 const [settings,setSettings]=useState<ReaderSettings>(defaultReaderSettings);
 const [viewport,setViewport]=useState({width:700,height:980});
 const [measured,setMeasured]=useState<Record<string,number>>({});
 const [pageIndex,setPageIndex]=useState(0);
 const [hydrated,setHydrated]=useState(false);
 const [positionLoaded,setPositionLoaded]=useState(false);
 const [restoreComplete,setRestoreComplete]=useState(false);
 const [semanticNotes,setSemanticNotes]=useState<SemanticReaderNote[]>([]);
 const [notesLoaded,setNotesLoaded]=useState(false);
 const [selectedNoteId,setSelectedNoteId]=useState<string|null>(null);
 const [notesExpanded,setNotesExpanded]=useState(false);
 const savedAnchor=useRef<{atomId:string;offset:number}|null>(null);
 const flowRef=useRef<HTMLDivElement>(null);
 const measurementRef=useRef<HTMLDivElement>(null);
 const dictionary=useMemo(()=>getPublicDictionary(locale),[locale]);
 const spread=settings.layoutMode==="spread"&&viewport.width>=700;
 const effectiveLayout=spread?"spread":"pagedFlow";
 const maxPaperWidth=WIDTHS[settings.width];
 const pageWidth=spread?clamp((viewport.width-52)/2,270,maxPaperWidth):clamp(viewport.width-28,290,maxPaperWidth);
 const pageHeight=Math.round(pageWidth*1.414);
 const readingWidth=Math.max(200,pageWidth-64);
 const layout=useMemo(()=>({
  mode:"paged" as const,viewport_width:readingWidth,viewport_height:Math.max(320,pageHeight-66),
  density:settings.density,font_scale:settings.fontScale,measured_unit_heights:measured
 }),[readingWidth,pageHeight,settings.density,settings.fontScale,measured]);
 const pages=useMemo(()=>projectSemanticUnits(units,layout),[units,layout]);
 const pageCount=Math.max(1,pages.length);
 const current=clamp(pageIndex,0,pageCount-1);
 const active=spread?current-current%2:current;
 const percent=pageCount>1?Math.round(active/(pageCount-1)*100):100;
 const toolbarNotes=useMemo<ReaderNote[]>(()=>semanticNotes.map(note=>{
  const idx=pageForSemanticNote(pages,note,units);
  return {id:note.id,slug,title:note.title,body:note.body,color:note.color,
   source:"local",progressPercent:idx===null?0:pageCount>1?idx/(pageCount-1)*100:100,
   scrollY:0,pageIndex:idx??undefined,pageCount,layoutMode:settings.layoutMode,
   createdAt:note.createdAt,updatedAt:note.updatedAt};
 }).sort((a,b)=>(a.pageIndex??Infinity)-(b.pageIndex??Infinity)),[semanticNotes,pages,units,slug,title,pageCount,settings.layoutMode]);
 const selectedNoteIndex=toolbarNotes.findIndex(x=>x.id===selectedNoteId);
 const pictureByAtom=useMemo(()=>{
  const map=new Map<string,Image[]>();
  for(const image of images){const list=map.get(image.atomId)??[];list.push(image);map.set(image.atomId,list);}
  return map;
 },[images]);
 const updateSettings=useCallback((patch:Partial<ReaderSettings>)=>
  setSettings(old=>({...old,...patch})),[]);
 useEffect(()=>{
  const resize=()=>setViewport({width:window.innerWidth,height:window.innerHeight});
  const frame=window.requestAnimationFrame(()=>{
   setSettings(loadReaderSettings());
   setHydrated(true);
   resize();
  });
  window.addEventListener("resize",resize);
  return ()=>{window.cancelAnimationFrame(frame);window.removeEventListener("resize",resize);};
 },[]);
 useEffect(()=>{if(hydrated)saveReaderSettings(settings);},[settings,hydrated]);
 useEffect(()=>{
  if(!hydrated||notesLoaded)return;
  const frame=window.requestAnimationFrame(()=>{
   try{
    const raw=window.localStorage.getItem(semanticNotesKey(slug));
    setSemanticNotes(filterSemanticReaderNotes(raw?JSON.parse(raw):null,slug,units));
   }catch{setSemanticNotes([]);}
   setNotesLoaded(true);
  });
  return ()=>window.cancelAnimationFrame(frame);
 },[hydrated,notesLoaded,slug,units]);
 useEffect(()=>{
  if(!notesLoaded||mode!=="full")return;
  try{window.localStorage.setItem(semanticNotesKey(slug),JSON.stringify(semanticNotes));}
  catch{/* allow reading without local storage */}
 },[notesLoaded,mode,slug,semanticNotes]);


 // Only the semantic position key is read. The legacy per-slug progress stays untouched.
 useEffect(()=>{
  if(!hydrated||positionLoaded)return;
  try{
   const raw=window.localStorage.getItem(semanticPositionKey(slug));
   const saved=validateSemanticPosition(raw?JSON.parse(raw):null,slug,revisionSha);
   if(saved)savedAnchor.current={atomId:saved.atomId,offset:saved.offset};
  }catch{/* malformed local state must never block reading */}
  const frame=window.requestAnimationFrame(()=>setPositionLoaded(true));
  return ()=>window.cancelAnimationFrame(frame);
 },[hydrated,positionLoaded,slug,revisionSha]);
 useEffect(()=>{
  if(!positionLoaded||restoreComplete)return;
  // Wait for the first actual DOM measurement before resolving old source anchors.
  if(units.length>0&&Object.keys(measured).length<units.length)return;
  const frame=window.requestAnimationFrame(()=>{
   if(savedAnchor.current){
    const idx=pageForSemanticAnchor(pages,savedAnchor.current.atomId,savedAnchor.current.offset);
    if(idx!==null)setPageIndex(idx);
    savedAnchor.current=null;
   }
   setRestoreComplete(true);
  });
  return ()=>window.cancelAnimationFrame(frame);
 },[pages,positionLoaded,restoreComplete,units.length,measured]);
 // Measure *exactly the same renderer* as the visible sheets at the active paper width.
 useLayoutEffect(()=>{
  if(!hydrated)return;
  const root=measurementRef.current;
  if(!root)return;
  let animation=0;
  const calculate=()=>{
   window.cancelAnimationFrame(animation);
   animation=window.requestAnimationFrame(()=>{
    const next:Record<string,number>={};
    for(const el of root.querySelectorAll<HTMLElement>("[data-measure-semantic-id]")){
     const id=el.dataset.measureSemanticId;
     if(!id)continue;
     const styles=window.getComputedStyle(el);
     const extra=(Number.parseFloat(styles.marginTop)||0)+(Number.parseFloat(styles.marginBottom)||0);
     next[id]=Math.max(1,Math.round((el.getBoundingClientRect().height+extra)*2)/2);
    }
    setMeasured(prev=>JSON.stringify(prev)===JSON.stringify(next)?prev:next);
   });
  };
  const observer=new ResizeObserver(calculate);
  observer.observe(root);
  calculate();
  return ()=>{observer.disconnect();window.cancelAnimationFrame(animation);};
 },[hydrated,units,settings.fontScale,settings.density,pageWidth]);
 // Save the source anchor, not the unstable page number. This is independent of legacy progress.
 useEffect(()=>{
  if(!hydrated||!restoreComplete||mode!=="full"||!pages.length)return;
  const anchor=anchorForSemanticPage(pages[current]);
  if(!anchor)return;
  try{
   window.localStorage.setItem(semanticPositionKey(slug),JSON.stringify({
    schema:"artales.semantic.saved-position.v1",
    slug,revisionSha,atomId:anchor.atomId,offset:anchor.offset,updatedAt:new Date().toISOString()
   }));
  }catch{/* reading works with storage disabled */}
 },[hydrated,restoreComplete,mode,pages,current,slug,revisionSha]);
 const goToPage=useCallback((requested:number)=>{
  const requestedIndex=clamp(Math.trunc(requested-1),0,pageCount-1);
  const next=spread?requestedIndex-requestedIndex%2:requestedIndex;
  setPageIndex(next);
  if(!spread)flowRef.current?.querySelector<HTMLElement>(`[data-page-index="${next}"]`)
   ?.scrollIntoView({behavior:"smooth",block:"start"});
 },[pageCount,spread]);
 const goToNote=(note:ReaderNote)=>{
  const found=semanticNotes.find(x=>x.id===note.id);
  if(!found)return;
  const idx=pageForSemanticNote(pages,found,units);
  if(idx===null)return;
  setSelectedNoteId(note.id);
  goToPage(idx+1);
 };
 const addNote=(data:{title:string;body:string;color:ReaderNoteColor})=>{
  if(!notesLoaded||mode!=="full")return;
  const note=makeSemanticReaderNote({slug,page:pages[active],units,
   id:crypto.randomUUID(),now:new Date().toISOString(),...data});
  if(!note)return;
  setSemanticNotes(prev=>[note,...prev]);setSelectedNoteId(note.id);
 };
 const jumpNote=(delta:number)=>{
  const next=toolbarNotes[selectedNoteIndex+delta];
  if(next)goToNote(next);
 };
 // Scroll mode uses a stream of numbered pages. Report the page crossing the reading line.
 useEffect(()=>{
  if(spread)return;
  let raf=0;
  const check=()=>{
   window.cancelAnimationFrame(raf);
   raf=window.requestAnimationFrame(()=>{
    let next=0;
    for(const el of flowRef.current?.querySelectorAll<HTMLElement>("[data-page-index]")??[])
     if(el.getBoundingClientRect().top<=window.innerHeight*.35)
      next=Number(el.dataset.pageIndex??0);
    setPageIndex(prev=>prev===next?prev:next);
   });
  };
  window.addEventListener("scroll",check,{passive:true});
  return ()=>{window.cancelAnimationFrame(raf);window.removeEventListener("scroll",check);};
 },[spread,pages]);
 // Source text remains immutable. No legacy WorkBlock, migration, or account writes.
 const renderUnit=(unit:SemanticPageUnit)=><div className="artales-semantic-public__unit"
  key={unit.id} data-page-unit-id={unit.id} data-source-atoms={unit.source_atom_ids.join(",")}>
  <SemanticUnitContent unit={unit} protectedTerms={protectedTerms}/>
  {(unit.fragment?.continuation_after?[]:unit.source_atom_ids.flatMap(id=>pictureByAtom.get(id)??[])).map(img=>
   <figure key={img.url} className="artales-semantic-public__illustration">
    {/* eslint-disable-next-line @next/next/no-img-element -- approved immutable image manifest */}
    <img src={img.url} alt={img.caption||"Ilustrace díla"} loading="lazy"/>
    {img.caption?<figcaption>{img.caption}</figcaption>:null}
   </figure>)}
 </div>;
 const renderSheet=(page:SemanticPage|undefined,index:number,additional="")=>
  <article data-page-index={index}
   className={`artales-reader__paper artales-reader__paper--paged ${additional} ${page?.overflow==="scroll_unit"?"artales-semantic-shell__paper--overflow":""}`}>
   <header className="artales-reader__page-header" aria-hidden="true">
    <span>{title}</span><span>{index+1}</span>
   </header>
   <div className="artales-reader__page-content">
    <div className="artales-semantic-public">
     {page?.units.map(renderUnit)}
    </div>
   </div>
   <footer className="artales-reader__page-footer">{index+1}</footer>
  </article>;
 return <main className={`artales-reader artales-semantic-shell artales-reader--theme-${settings.theme}
  artales-reader--width-${settings.width} artales-reader--density-${settings.density}
  artales-reader--layout-${effectiveLayout} artales-reader--pagefit-${settings.pageFit}`}
  style={{"--reader-font-scale":String(settings.fontScale)} as CSSProperties}
  data-semantic-revision={revisionSha}>
  <ReaderToolbar
   title={title}detailHref={`/work/${slug}`}mode={mode}
   fullHref={`/reader/${slug}?mode=full`}progressPercent={percent}
   pageIndex={active}pageCount={pageCount}settings={settings}
   labels={dictionary.reader}chromeLabels={dictionary.public}
   notes={toolbarNotes}notesEnabled={mode==="full"}selectedNoteId={selectedNoteId}
   selectedNoteIndex={selectedNoteIndex}isNotesListExpanded={notesExpanded}notesSyncState="local"
   onFontDelta={delta=>updateSettings({fontScale:clampReaderFontScale(settings.fontScale+delta)})}
   onThemeChange={theme=>updateSettings({theme})}
   onWidthChange={width=>updateSettings({width})}
   onDensityChange={density=>updateSettings({density})}
   onLayoutModeChange={layoutMode=>{updateSettings({layoutMode});setPageIndex(0);}}
   onToggleControls={()=>updateSettings({controlsCollapsed:!settings.controlsCollapsed})}
   onAddNote={addNote}onGoToNote={goToNote}onGoToPreviousNote={()=>jumpNote(-1)}
   onGoToNextNote={()=>jumpNote(1)}onNotesListExpandedChange={setNotesExpanded}
   onDeleteNote={note=>setSemanticNotes(prev=>prev.filter(x=>x.id!==note.id))}
   onGoToPage={goToPage}
  />
  <section className="artales-reader__stage">
   {/* Measure raw units; never measure split fragments as the original unit. */}
   <div className="artales-semantic-public artales-semantic-shell__measurement" aria-hidden="true"
    ref={measurementRef} style={{width:readingWidth}}>
    {units.map(unit=><div key={unit.id} data-measure-semantic-id={unit.id}>
     <SemanticUnitContent unit={unit} protectedTerms={protectedTerms}/>
    </div>)}
   </div>
   {spread?<div className="artales-reader__spread">
    {renderSheet(pages[active],active,"artales-reader__paper--spread-left")}
    {active+1<pageCount?renderSheet(pages[active+1],active+1,"artales-reader__paper--spread-right")
      :<article className="artales-reader__paper artales-reader__paper--blank" aria-hidden="true"/>}
   </div>:<div className="artales-reader__paged-flow" ref={flowRef}>
     {pages.map((page,i)=>renderSheet(page,i))}
    </div>}
   {spread?<div className="artales-reader-page-nav">
    <button type="button" onClick={()=>goToPage(active-1)} disabled={active===0}
     aria-label="Předchozí dvojstrana">‹</button>
    <span>{active+1} / {pageCount}</span>
    <button type="button" onClick={()=>goToPage(active+3)} disabled={active+2>=pageCount}
     aria-label="Další dvojstrana">›</button>
   </div>:null}
   {mode==="preview"?<p className="artales-reader__preview-cta">
    Ukázka díla. <a href={`/reader/${slug}?mode=full`}>Pokračovat ve čtení</a>
   </p>:null}
  </section>
 </main>;
}
