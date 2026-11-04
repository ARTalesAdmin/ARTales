"use client";
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type CSSProperties} from "react";
import ReaderToolbar from "@/components/reader/ReaderToolbar";
import SemanticUnitContent from "@/components/reader/SemanticUnitContent";
import {projectSemanticUnits} from "@/lib/semantic/readerProjectionCore";
import type {SemanticPage,SemanticPageUnit} from "@/lib/semantic/model";
import {clampReaderFontScale,defaultReaderSettings,type ReaderSettings} from "@/lib/reader/readerSettings";
import {loadReaderSettings,saveReaderSettings} from "@/lib/reader/readerStorage";
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
 const savedAnchor=useRef<{atomId:string;offset:number}|null>(null);
 const flowRef=useRef<HTMLDivElement>(null);
 const measurementRef=useRef<HTMLDivElement>(null);
 const dictionary=useMemo(()=>getPublicDictionary(locale),[locale]);
 const spread=settings.layoutMode==="spread"&&viewport.width>=700;
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
 const pictureByAtom=useMemo(()=>{
  const map=new Map<string,Image[]>();
  for(const image of images){const list=map.get(image.atomId)??[];list.push(image);map.set(image.atomId,list);}
  return map;
 },[images]);
 const updateSettings=useCallback((patch:Partial<ReaderSettings>)=>
  setSettings(old=>({...old,...patch})),[]);
 useEffect(()=>{
  setSettings(loadReaderSettings());
  setHydrated(true);
  const resize=()=>setViewport({width:window.innerWidth,height:window.innerHeight});
  resize();window.addEventListener("resize",resize);
  return ()=>window.removeEventListener("resize",resize);
 },[]);
 useEffect(()=>{if(hydrated)saveReaderSettings(settings);},[settings,hydrated]);
 useEffect(()=>{
  setMeasured({});
 },[pageWidth,settings.fontScale,settings.density,revisionSha]);
 // Only the semantic position key is read. The legacy per-slug progress stays untouched.
 useEffect(()=>{
  if(!hydrated||positionLoaded)return;
  try{
   const raw=window.localStorage.getItem(semanticPositionKey(slug));
   const saved=validateSemanticPosition(raw?JSON.parse(raw):null,slug,revisionSha);
   if(saved)savedAnchor.current={atomId:saved.atomId,offset:saved.offset};
  }catch{/* malformed local state must never block reading */}
  setPositionLoaded(true);
 },[hydrated,positionLoaded,slug,revisionSha]);
 useEffect(()=>{
  if(!positionLoaded||!savedAnchor.current)return;
  const idx=pageForSemanticAnchor(pages,savedAnchor.current.atomId,savedAnchor.current.offset);
  if(idx!==null){setPageIndex(idx);savedAnchor.current=null;}
 },[pages,positionLoaded]);
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
  if(!hydrated||!positionLoaded||mode!=="full"||!pages.length)return;
  const anchor=anchorForSemanticPage(pages[current]);
  if(!anchor)return;
  try{
   window.localStorage.setItem(semanticPositionKey(slug),JSON.stringify({
    schema:"artales.semantic.saved-position.v1",
    slug,revisionSha,atomId:anchor.atomId,offset:anchor.offset,updatedAt:new Date().toISOString()
   }));
  }catch{/* reading works with storage disabled */}
 },[hydrated,positionLoaded,mode,pages,current,slug,revisionSha]);
 const goToPage=useCallback((requested:number)=>{
  const requestedIndex=clamp(Math.trunc(requested-1),0,pageCount-1);
  const next=spread?requestedIndex-requestedIndex%2:requestedIndex;
  setPageIndex(next);
  if(!spread)flowRef.current?.querySelector<HTMLElement>(`[data-page-index="${next}"]`)
   ?.scrollIntoView({behavior:"smooth",block:"start"});
 },[pageCount,spread]);
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
  {unit.source_atom_ids.flatMap(id=>pictureByAtom.get(id)??[]).map(img=>
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
  artales-reader--layout-${settings.layoutMode} artales-reader--pagefit-${settings.pageFit}`}
  style={{"--reader-font-scale":String(settings.fontScale)} as CSSProperties}
  data-semantic-revision={revisionSha}>
  <ReaderToolbar
   title={title}detailHref={`/work/${slug}`}mode={mode}
   fullHref={`/reader/${slug}?mode=full`}progressPercent={percent}
   pageIndex={active}pageCount={pageCount}settings={settings}
   labels={dictionary.reader}chromeLabels={dictionary.public}
   notes={[]}notesEnabled={false}selectedNoteId={null}selectedNoteIndex={-1}
   isNotesListExpanded={false}notesSyncState="local"
   onFontDelta={delta=>updateSettings({fontScale:clampReaderFontScale(settings.fontScale+delta)})}
   onThemeChange={theme=>updateSettings({theme})}
   onWidthChange={width=>updateSettings({width})}
   onDensityChange={density=>updateSettings({density})}
   onLayoutModeChange={layoutMode=>{updateSettings({layoutMode});setPageIndex(0);}}
   onToggleControls={()=>updateSettings({controlsCollapsed:!settings.controlsCollapsed})}
   onAddNote={()=>{}}onGoToNote={()=>{}}onGoToPreviousNote={()=>{}}
   onGoToNextNote={()=>{}}onNotesListExpandedChange={()=>{}}
   onDeleteNote={()=>{}}onGoToPage={goToPage}
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
