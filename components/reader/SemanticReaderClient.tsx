"use client";
import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from "react";
import {unitView,type ApprovedSemanticImage} from "@/components/reader/SemanticPageUnit";
import ReaderToolbar from "@/components/reader/ReaderToolbar";
import {getPublicDictionary} from "@/lib/i18n/public";
import {iterateSemanticPages,paginateSemanticUnits} from "@/lib/semantic/readerProjection";
import {projectSemanticProseText} from "@/lib/semantic/displayText";
import type {SemanticPage,SemanticPageUnit} from "@/lib/semantic/model";
import type {SupportedLocale} from "@/lib/i18n/config";
import {clampReaderFontScale,defaultReaderSettings,type ReaderSettings} from "@/lib/reader/readerSettings";
import {loadReaderSettings,saveReaderSettings,loadReaderProgress,saveReaderProgress,
 loadReaderNotes,saveReaderNotes,type ReaderNote,type ReaderNoteColor} from "@/lib/reader/readerStorage";
import "./reader.css";
import "../editor/semantic-reader.css";
import "../editor/semantic-reader-theme.css";
import "./semantic-public-reader.css";

type Props={
 slug:string;title:string;locale:SupportedLocale;mode:"preview"|"full";
 revisionSha:string;units:SemanticPageUnit[];
 protectedTerms?:string[];visuals?:ApprovedSemanticImage[];
};
type Measurements={key:string;heights:Record<string,number>;contentHeight:number;contentWidth:number};
const countProgress=(index:number,count:number)=>count<=1?100:Math.max(0,Math.min(100,index/(count-1)*100));
const pageStart=(index:number,spread:boolean)=>spread?index-index%2:index;

export default function SemanticReaderClient({slug,title,locale,mode,revisionSha,units,
 protectedTerms=[],visuals=[]}:Props){
 const [settings,setSettings]=useState<ReaderSettings>(defaultReaderSettings);
 const [hydrated,setHydrated]=useState(false);
 const [viewport,setViewport]=useState({width:1024,height:780});
 const [measurements,setMeasurements]=useState<Measurements|null>(null);
 const [measuredPages,setMeasuredPages]=useState<{key:string;pages:SemanticPage[]}|null>(null);
 const [pageIndex,setPageIndex]=useState(0);
 const [notes,setNotes]=useState<ReaderNote[]>([]);
 const [notesSyncState,setNotesSyncState]=useState<"local"|"syncing"|"synced">("local");
 const noteSyncGeneration=useRef(0);
 const [selectedNoteId,setSelectedNoteId]=useState<string|null>(null);
 const [notesExpanded,setNotesExpanded]=useState(false);
 const reflowGeneration=useRef(0);
 const readingAnchor=useRef<{rootId:string;offset:number}|null>(null);
 const measureRef=useRef<HTMLDivElement|null>(null);
 const flowRef=useRef<HTMLDivElement|null>(null);
 const restoredRef=useRef(false);
 const spread=settings.layoutMode==="spread"&&viewport.width>=860;
 // Book geometry and margins come from the existing, proven Reader.
 // The semantic paginator uses the *content* area rather than viewport height.
 const singleWidth=settings.width==="narrow"?620:settings.width==="wide"?780:700;
 const pageWidth=Math.max(250,Math.floor(Math.min(
  spread?Math.min(730,(viewport.width-72)/2):singleWidth,viewport.width-24)));
 const pageHeight=Math.round(pageWidth*1.414);
 const pageContentHeight=Math.max(300,pageHeight-210);
 const measureKey=[revisionSha,mode,pageWidth,pageHeight,settings.fontScale,
  settings.density,units.length,protectedTerms.join("\u0001")].join("|");
 const readyMeasurements=measurements?.key===measureKey?measurements.heights:undefined;
 const actualCapacity=measurements?.key===measureKey?measurements.contentHeight:pageContentHeight;
 const contentWidth=measurements?.key===measureKey?measurements.contentWidth:Math.max(200,pageWidth-144);
 // Before the browser has measured the actual font and page geometry, show
 // a conservative projection. Replace it atomically after the DOM audit.
 const fallbackPages=useMemo(()=>paginateSemanticUnits(units,{
  mode:"paged",viewport_width:contentWidth,
  viewport_height:actualCapacity+100,content_height:actualCapacity,
  font_scale:settings.fontScale,density:settings.density,
  measured_unit_heights:readyMeasurements,protected_terms:protectedTerms,
 }),[units,contentWidth,actualCapacity,settings.fontScale,settings.density,readyMeasurements,protectedTerms]);
 const paginationKey=[measureKey,contentWidth,actualCapacity,readyMeasurements?"measured":"estimate"].join("|");
 const pages=measuredPages?.key===paginationKey?measuredPages.pages:fallbackPages;
 const paginationSettled=Boolean(measuredPages?.key===paginationKey);
 const total=Math.max(1,pages.length);
 const current=Math.max(0,Math.min(pageIndex,total-1));
 // The first source-bearing fragment is stable across page-count changes.
 // It lives only in memory; legacy progress and notes storage is untouched.
 useEffect(()=>{
  if(!paginationSettled)return;
  const first=pages[current]?.units.find(u=>u.source_atom_ids.length>0);
  if(first)readingAnchor.current={
   rootId:first.fragment?.original_unit_id??first.id,
   offset:first.fragment?.start??0,
  };
 },[paginationSettled,pages,current]);

 const visibleStart=pageStart(current,spread);
 const progress=countProgress(current,total);
 const notesSorted=useMemo(()=>[...notes].sort((a,b)=>
  (a.progressPercent-b.progressPercent)||a.createdAt.localeCompare(b.createdAt)),[notes]);
 const selectedNoteIndex=notesSorted.findIndex(n=>n.id===selectedNoteId);
 const pageStyle={
  width:pageWidth+"px",maxWidth:"100%",
  ["--reader-font-scale" as string]:String(settings.fontScale),
  ["--reader-scale" as string]:String(settings.fontScale),
  ["--reader-line-height" as string]:settings.density==="compact"?"1.48":"1.62",
  ["--reader-paragraph-gap" as string]:settings.density==="compact"?"0.85em":"1em",
  ["--reader-page-height" as string]:pageHeight+"px",
  ["--reader-content-capacity" as string]:pageContentHeight+"px",
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
 const syncNotes=useCallback(async()=>{
  if(!hydrated||mode!=="full")return;
  const generation=++noteSyncGeneration.current;
  setNotesSyncState("syncing");
  try{
   const res=await fetch("/api/reader/notes?slug="+encodeURIComponent(slug),{credentials:"same-origin"});
   if(!res.ok)throw new Error("notes_read_failed");
   const body=await res.json() as {signedIn:boolean;notes?:Array<Record<string,unknown>>};
   if(generation!==noteSyncGeneration.current)return;
   if(!body.signedIn){setNotesSyncState("local");return;}
   const unsynced=loadReaderNotes(slug,title).filter(n=>n.source!=="synced");
   for(const note of unsynced){
    const post=await fetch("/api/reader/notes",{method:"POST",headers:{"content-type":"application/json"},
     credentials:"same-origin",body:JSON.stringify(note)});
    if(!post.ok)throw new Error("notes_upload_failed");
   }
   const latest=await fetch("/api/reader/notes?slug="+encodeURIComponent(slug),{credentials:"same-origin"});
   if(!latest.ok)throw new Error("notes_refresh_failed");
   const refreshed=await latest.json() as {notes:Array<Record<string,unknown>>};
   if(generation!==noteSyncGeneration.current)return;
   const remote:ReaderNote[]=refreshed.notes.map(row=>({
    id:String(row.id),slug:String(row.work_slug),userId:String(row.user_id),
    title:row.title as string|null,body:row.body as string|null,
    color:row.color as ReaderNoteColor,progressPercent:Number(row.progress_percent),
    scrollY:Number(row.scroll_y),pageIndex:row.page_index==null?undefined:Number(row.page_index),
    pageCount:row.page_count==null?undefined:Number(row.page_count),
    layoutMode:row.layout_mode as ReaderNote["layoutMode"],
    createdAt:String(row.created_at),updatedAt:String(row.updated_at),source:"synced"
   }));
   const merged=new Map(remote.map(note=>[note.id,note]));
   loadReaderNotes(slug,title).filter(note=>note.source!=="synced").forEach(note=>{
    if(!merged.has(note.id))merged.set(note.id,note);
   });
   const all=[...merged.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
   setNotes(all);saveReaderNotes(slug,all);setNotesSyncState("synced");
  }catch{
   if(generation===noteSyncGeneration.current)setNotesSyncState("local");
  }
 },[hydrated,mode,slug,title]);
 useEffect(()=>{
  void syncNotes();
  const onOnline=()=>void syncNotes();
  const onVisible=()=>{if(document.visibilityState==="visible"&&navigator.onLine)void syncNotes();};
  window.addEventListener("online",onOnline);
  document.addEventListener("visibilitychange",onVisible);
  return()=>{
   noteSyncGeneration.current++;
   window.removeEventListener("online",onOnline);
   document.removeEventListener("visibilitychange",onVisible);
  };
 },[syncNotes]);
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
  if(!hydrated||!restoredRef.current||mode!=="full"||!paginationSettled)return;
  saveReaderProgress({
   slug,mode:"full",pageIndex:current,pageCount:total,progressPercent:progress,
   scrollY:current,layoutMode:settings.layoutMode,updatedAt:new Date().toISOString(),
  });
 },[hydrated,mode,slug,current,total,progress,settings.layoutMode,paginationSettled]);
 useEffect(()=>{setPageIndex(old=>Math.min(old,total-1))},[total]);
 // The exact same semantic markup is measured before repagination as in QA.
 useEffect(()=>{
  const measure=()=>{
   const root=measureRef.current;
   if(!root)return;
   const elements=[...root.querySelectorAll<HTMLElement>("[data-semantic-measure-id]")];
   if(elements.length!==units.length)return;
   const content=root.querySelector<HTMLElement>(".semantic-public-reader__page-content");
   const contentRect=content?.getBoundingClientRect();
   const contentHeight=contentRect?.height??pageContentHeight;
   const contentWidth=contentRect?.width??Math.max(200,pageWidth-144);
   const heights:Record<string,number>={};
   for(const element of elements){
    const id=element.dataset.semanticMeasureId;
    if(!id)return;
    heights[id]=Math.max(1,Math.round(element.getBoundingClientRect().height*2)/2);
   }
   setMeasurements(previous=>{
    if(previous?.key===measureKey&&previous.contentHeight===contentHeight
       &&previous.contentWidth===contentWidth
       &&Object.keys(heights).length===Object.keys(previous.heights).length
       &&Object.keys(heights).every(k=>previous.heights[k]===heights[k]))return previous;
    return {key:measureKey,heights,contentHeight,contentWidth};
   });
  };
  const frame=requestAnimationFrame(measure);
  const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(measure):null;
  if(measureRef.current)observer?.observe(measureRef.current);
  document.fonts?.ready.then(measure).catch(()=>{});
  return ()=>{cancelAnimationFrame(frame);observer?.disconnect()};
 },[measureKey,units,pageContentHeight,pageWidth]);
 // One leaf per animation frame, canceling superseded reflow generations.
 useEffect(()=>{
  if(!readyMeasurements||!measureRef.current)return;
  const generation=++reflowGeneration.current;
  let frame=0;
  const root=measureRef.current;
  const content=root.querySelector<HTMLElement>(".semantic-public-reader__page-content");
  if(!content)return;
  const original=new Map([...root.querySelectorAll<HTMLElement>("[data-semantic-measure-id]")]
    .map(el=>[el.dataset.semanticMeasureId??"",el] as const));
  const cache=new Map<string,number>();
  const fragmentHeight=(unit:SemanticPageUnit):number|null=>{
   if(!unit.fragment||!("atom" in unit.node))return null;
   const {start,end,original_unit_id}=unit.fragment;
   const key=original_unit_id+":"+start+":"+end;
   const cached=cache.get(key);
   if(cached!==undefined)return cached;
   const template=original.get(original_unit_id);
   if(!template)return null;
   const clone=template.cloneNode(true) as HTMLElement;
   const prose=clone.querySelector("p,blockquote,aside");
   if(!prose)return null;
   const projected=projectSemanticProseText(unit.node.atom.raw);
   const atom=prose.querySelector(".semantic-reader__atom");
   if(!atom)return null;
   const walker=document.createTreeWalker(atom,NodeFilter.SHOW_TEXT);
   const nodes:Text[]=[];
   let next:Node|null;
   while((next=walker.nextNode()))nodes.push(next as Text);
   if(!nodes.length||nodes.reduce((n,node)=>n+(node.textContent?.length??0),0)!==projected.length)
     return null;
   const at=(offset:number):[Text,number]=>{
    let remaining=offset;
    for(const node of nodes){
     const length=node.textContent?.length??0;
     if(remaining<=length)return [node,remaining];
     remaining-=length;
    }
    const last=nodes.at(-1)!;
    return [last,last.textContent?.length??0];
   };
   const tail=document.createRange();
   const endAt=at(end);
   tail.setStart(endAt[0],endAt[1]);
   tail.setEnd(nodes.at(-1)!,nodes.at(-1)!.textContent?.length??0);
   tail.deleteContents();
   const head=document.createRange();
   const startAt=at(start);
   head.setStart(nodes[0],0);
   head.setEnd(startAt[0],startAt[1]);
   head.deleteContents();
   prose.classList.add("semantic-reader__fragment");
   if(start>0)prose.classList.add("semantic-reader__fragment--continued");
   if(unit.kind==="footnote"&&start>0)prose.querySelector("sup")?.remove();
   clone.removeAttribute("data-semantic-measure-id");
   content.appendChild(clone);
   const height=Math.ceil(clone.getBoundingClientRect().height*2)/2;
   clone.remove();
   cache.set(key,height);
   return height;
  };
  const iterator=iterateSemanticPages(units,{
   mode:"paged",viewport_width:contentWidth,
   viewport_height:actualCapacity+100,content_height:actualCapacity,
   font_scale:settings.fontScale,density:settings.density,
   measured_unit_heights:readyMeasurements,protected_terms:protectedTerms,
   measure_fragment_height:fragmentHeight,
  });
  const collected:SemanticPage[]=[];
  const step=()=>{
   if(generation!==reflowGeneration.current)return;
   const item=iterator.next();
   if(!item.done)collected.push(item.value);
   if(item.done){
    const anchor=readingAnchor.current;
    if(anchor){
     const mapped=collected.findIndex(page=>page.units.some(unit=>{
      const root=unit.fragment?.original_unit_id??unit.id;
      return root===anchor.rootId&&(!unit.fragment||
       (unit.fragment.start<=anchor.offset&&anchor.offset<unit.fragment.end));
     }));
     if(mapped>=0)setPageIndex(mapped);
    }
    setMeasuredPages({key:paginationKey,pages:collected});
    return;
   }
   frame=requestAnimationFrame(step);
  };
  frame=requestAnimationFrame(step);
  return ()=>{
   reflowGeneration.current++;
   cancelAnimationFrame(frame);
   iterator.return(undefined);
  };
 },[paginationKey,readyMeasurements,units,contentWidth,actualCapacity,
   settings.fontScale,settings.density,protectedTerms]);

 const patch=useCallback((next:Partial<ReaderSettings>)=>setSettings(old=>({...old,...next})),[]);
 const goToIndex=useCallback((index:number)=>{
  const safe=Math.max(0,Math.min(total-1,index));
  const target=pageStart(safe,spread);
  setPageIndex(target);
  if(spread)window.scrollTo({top:0,behavior:"smooth"});
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
  if(notesSyncState==="synced")void fetch("/api/reader/notes",{method:"POST",credentials:"same-origin",
   headers:{"content-type":"application/json"},body:JSON.stringify(note)}).then(r=>{
    if(!r.ok)setNotesSyncState("local");
   }).catch(()=>setNotesSyncState("local"));
  setSelectedNoteId(note.id);
 },[slug,progress,current,total,settings.layoutMode,notesSyncState]);
 const goToNote=(note:ReaderNote)=>{
  setSelectedNoteId(note.id);
  goToIndex(Math.round(note.progressPercent/100*(total-1)));
 };
 const deleteNote=(note:ReaderNote)=>{
  // Synced notes must not silently disappear only from local storage.
  if(note.source==="synced")return;
  setNotes(old=>{const next=old.filter(n=>n.id!==note.id);saveReaderNotes(slug,next);return next});
  if(notesSyncState==="synced")void fetch("/api/reader/notes?id="+encodeURIComponent(note.id),{
   method:"DELETE",credentials:"same-origin"}).then(r=>{
    if(!r.ok)setNotesSyncState("local");
   }).catch(()=>setNotesSyncState("local"));
  if(selectedNoteId===note.id)setSelectedNoteId(null);
 };
 const renderPaper=(page:SemanticPage|undefined,index:number,blank=false)=>{
  const cover=Boolean(page?.units.some(u=>u.kind==="title_page"));
  const side=spread?(index%2===0?" artales-reader__paper--spread-left":
   " artales-reader__paper--spread-right"):"";
  return <article key={blank?"blank":index}
   data-semantic-page-index={blank?undefined:index}
   className={"artales-reader__paper artales-reader__paper--paged semantic-reader__page"+
    " semantic-public-reader__paper"+side+
    (cover?" semantic-reader__front-page":"")+
    (blank?" artales-reader__paper--blank semantic-public-reader__paper--blank":"")+
    (page?.overflow==="scroll_unit"?" semantic-public-reader__paper--scroll-unit":"")}
   style={pageStyle}>
   {!blank&&!cover?<div className="artales-reader__page-header semantic-public-reader__paper-top">
    <span>{title}</span><span>{index+1}</span>
   </div>:<div className="semantic-public-reader__cover-chrome" aria-hidden="true"/>}
   <div className="artales-reader__page-content semantic-public-reader__page-content">
    {!blank&&page?.units.map(unit=><div key={unit.id} className="semantic-reader__unit"
     data-semantic-root={unit.fragment?.original_unit_id??unit.id}>
     {unitView(unit,protectedTerms,visuals)}
    </div>)}
    {!blank&&mode==="preview"&&index===total-1?
     <aside className="semantic-public-reader__preview-note">
      <p>Ukázka díla. Pokračujte do plné čtečky.</p>
      <a href={"/reader/"+slug+"?mode=full"}>Pokračovat ve čtení</a>
     </aside>:null}
   </div>
   {!blank&&!cover?<footer className="artales-reader__page-footer semantic-public-reader__paper-footer">
    <span>{index+1}</span>
   </footer>:<div className="semantic-public-reader__cover-chrome" aria-hidden="true"/>}
  </article>;
 };

 const dictionary=getPublicDictionary(locale);
 const toggleControls=()=>setSettings(old=>({...old,controlsCollapsed:!old.controlsCollapsed}));
 return <main lang={locale}
  className={"artales-reader artales-reader--semantic artales-reader--theme-"+settings.theme+
   " artales-reader--width-"+settings.width+
   " artales-reader--density-"+settings.density+
   " artales-reader--layout-"+settings.layoutMode+
   " artales-reader--pagefit-"+settings.pageFit}>
  <ReaderToolbar title={title} detailHref={"/work/"+slug}
   mode={mode} fullHref={"/reader/"+slug+"?mode=full"}
   progressPercent={progress} pageIndex={current} pageCount={total}
   settings={{...settings,showAdvancedReaderControls:true}}
   labels={dictionary.reader} chromeLabels={dictionary.public}
   notes={notesSorted} notesEnabled={true}
   selectedNoteId={selectedNoteId} selectedNoteIndex={selectedNoteIndex}
   isNotesListExpanded={notesExpanded} notesSyncState={notesSyncState}
   onFontDelta={delta=>patch({fontScale:clampReaderFontScale(settings.fontScale+delta)})}
   onThemeChange={theme=>patch({theme})}
   onWidthChange={width=>patch({width})}
   onDensityChange={density=>patch({density})}
   onLayoutModeChange={layoutMode=>patch({layoutMode})}
   onToggleControls={toggleControls}
   onAddNote={addNote} onGoToNote={goToNote}
   onGoToPreviousNote={()=>{if(selectedNoteIndex>0)goToNote(notesSorted[selectedNoteIndex-1])}}
   onGoToNextNote={()=>{if(selectedNoteIndex>=0&&selectedNoteIndex<notesSorted.length-1)
    goToNote(notesSorted[selectedNoteIndex+1])}}
   onNotesListExpandedChange={setNotesExpanded}
   onDeleteNote={deleteNote}
   onGoToPage={n=>goToIndex(n-1)}/>
  <section className="artales-reader__stage semantic-public-reader__stage">
   <div className="semantic-reader semantic-reader--public">
    <div className="semantic-reader__viewport semantic-public-reader__viewport">
     <div className="semantic-reader__measurement semantic-public-reader__measurement"
      aria-hidden="true" ref={measureRef} style={{width:pageWidth}}>
      <div className="artales-reader__paper artales-reader__paper--paged
       semantic-reader__page semantic-public-reader__paper semantic-reader__measurement-page"
       style={pageStyle}>
       <div className="artales-reader__page-header semantic-public-reader__paper-top"
        aria-hidden="true"><span>{title}</span><span>1</span></div>
       <div className="artales-reader__page-content semantic-public-reader__page-content">
        {units.map(unit=><div className="semantic-reader__unit" data-semantic-measure-id={unit.id} key={unit.id}>
         {unitView(unit,protectedTerms,visuals)}
        </div>)}
       </div>
       <div className="artales-reader__page-footer semantic-public-reader__paper-footer" aria-hidden="true">
        <span>1</span>
       </div>
      </div>
     </div>
     {!spread?<div className="artales-reader__paged-flow semantic-reader__pages
      semantic-reader__pages--scroll semantic-public-reader__flow" ref={flowRef}>
      {pages.map((page,index)=>renderPaper(page,index))}
     </div>:<div className="artales-reader__spread semantic-reader__pages
      semantic-reader__pages--spread semantic-public-reader__spread" aria-label="Dvoustránkové čtení">
      {renderPaper(pages[visibleStart],visibleStart)}
      {pages[visibleStart+1]?renderPaper(pages[visibleStart+1],visibleStart+1):
       renderPaper(undefined,visibleStart+1,true)}
     </div>}
    </div>
    {spread?<nav className="artales-reader-page-nav semantic-public-reader__navigation"
     aria-label="Listování">
     <button type="button" disabled={visibleStart===0} onClick={()=>goToIndex(visibleStart-2)}>‹</button>
     <span>{visibleStart+1}–{Math.min(total,visibleStart+2)} / {total}</span>
     <button type="button" disabled={visibleStart+2>=total}
      onClick={()=>goToIndex(visibleStart+2)}>›</button>
    </nav>:null}
   </div>
   {spread?<nav className="semantic-public-reader__side-navigation" aria-label="Boční listování">
    <button type="button" className="artales-reader-side-nav artales-reader-side-nav--previous"
     disabled={visibleStart===0} onClick={()=>goToIndex(visibleStart-2)}
     aria-label="Předchozí dvojstrana" title="Předchozí dvojstrana">‹</button>
    <button type="button" className="artales-reader-side-nav artales-reader-side-nav--next"
     disabled={visibleStart+2>=total} onClick={()=>goToIndex(visibleStart+2)}
     aria-label="Další dvojstrana" title="Další dvojstrana">›</button>
   </nav>:null}
  </section>
 </main>;
}
