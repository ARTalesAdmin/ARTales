"use client";
import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from "react";
import {unitView,type ApprovedSemanticImage} from "@/components/reader/SemanticPageUnit";
import {paginateSemanticUnits} from "@/lib/semantic/readerProjection";
import type {SemanticPage,SemanticPageUnit} from "@/lib/semantic/model";
import type {SupportedLocale} from "@/lib/i18n/config";
import {clampReaderFontScale,defaultReaderSettings,type ReaderSettings} from "@/lib/reader/readerSettings";
import {loadReaderSettings,saveReaderSettings,loadReaderProgress,saveReaderProgress,
 loadReaderNotes,saveReaderNotes,type ReaderNote,type ReaderNoteColor} from "@/lib/reader/readerStorage";
import "../editor/semantic-reader.css";
import "../editor/semantic-reader-theme.css";
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
 const [notesSyncState,setNotesSyncState]=useState<"local"|"syncing"|"synced">("local");
 const noteSyncGeneration=useRef(0);
 const [selectedNoteId,setSelectedNoteId]=useState<string|null>(null);
 const [notesExpanded,setNotesExpanded]=useState(false);
 const [noteTitle,setNoteTitle]=useState("");
 const [noteBody,setNoteBody]=useState("");
 const [noteColor,setNoteColor]=useState<ReaderNoteColor>("gold");
 const measureRef=useRef<HTMLDivElement|null>(null);
 const flowRef=useRef<HTMLDivElement|null>(null);
 const restoredRef=useRef(false);
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
  measured_unit_heights:readyMeasurements,protected_terms:protectedTerms,
 }),[units,pageWidth,pageHeight,settings.fontScale,settings.density,readyMeasurements,protectedTerms]);
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
 return <main lang={locale} className="semantic-reader semantic-reader--public"
  data-reader-theme={settings.theme} data-reader-mode={spread?"spread":"scroll"}>
  <header className="semantic-public-reader__header">
   <div className="semantic-public-reader__heading">
    <a href={"/work/"+slug}>← ARTales</a><strong>{title}</strong>
    <span>Čtečka ARTales{mode==="preview"?" · ukázka":""}</span>
   </div>
   <div className="semantic-reader__controls" aria-label="Nastavení čtení">
    <label>Čtení <select aria-label="Rozvržení" value={settings.layoutMode}
      onChange={e=>{patch({layoutMode:e.target.value as ReaderSettings["layoutMode"]});setPageIndex(0)}}>
      <option value="pagedFlow">Plynulé stránky</option>
      <option value="spread" disabled={viewport.width<860}>Dvoustrana</option>
     </select></label>
    <label>Motiv <select aria-label="Barevný motiv" value={settings.theme}
      onChange={e=>patch({theme:e.target.value as ReaderSettings["theme"]})}>
      <option value="light">Světlý</option><option value="script">Knižní</option>
      <option value="dark">Tmavý</option>
     </select></label>
    <label>Velikost <input type="range" aria-label="Velikost písma"
      min="0.85" max="1.3" step="0.05" value={settings.fontScale}
      onChange={e=>patch({fontScale:clampReaderFontScale(Number(e.target.value))})}/>
      <span>{Math.round(settings.fontScale*100)} %</span>
    </label>
    <label>Řádkování <select aria-label="Hustota řádkování" value={settings.density}
      onChange={e=>patch({density:e.target.value as ReaderSettings["density"]})}>
      <option value="comfortable">Normální</option><option value="compact">Zhuštěné</option>
     </select></label>
    <label>Šířka <select aria-label="Šířka sazby" value={settings.width}
      onChange={e=>patch({width:e.target.value as ReaderSettings["width"]})}>
      <option value="narrow">Úzká</option><option value="normal">Běžná</option>
      <option value="wide">Široká</option>
     </select></label>
    <label className="semantic-reader__page-navigation">Strana
      <input type="range" aria-label="Přejít na stránku" min={1} max={total}
       value={visibleStart+1} onChange={e=>goToIndex(Number(e.target.value)-1)}/>
      <span>{visibleStart+1} / {total}</span>
    </label>
    <button type="button" className="semantic-reader__fullscreen-button"
      onClick={()=>setNotesExpanded(v=>!v)} aria-expanded={notesExpanded}>
      Poznámky ({notes.length}){notesSyncState==="syncing"?" · synchronizuji":notesSyncState==="synced"?" · synchronizováno":""}
    </button>
   </div>
   <progress className="semantic-public-reader__progress" value={progress} max={100} aria-label="Postup čtení"/>
  </header>
  {notesExpanded?<aside className="semantic-public-reader__notes" aria-label="Čtenářské poznámky">
   <div className="semantic-public-reader__notes-head"><strong>Moje poznámky</strong>
    <button type="button" onClick={()=>setNotesExpanded(false)}>Zavřít</button>
   </div>
   <form onSubmit={e=>{e.preventDefault();if(!noteTitle.trim()&&!noteBody.trim())return;
    addNote({title:noteTitle,body:noteBody,color:noteColor});setNoteTitle("");setNoteBody("");}}>
    <label>Název <input value={noteTitle} maxLength={160} onChange={e=>setNoteTitle(e.target.value)}/></label>
    <label>Poznámka <textarea rows={2} value={noteBody} maxLength={4000}
     onChange={e=>setNoteBody(e.target.value)}/></label>
    <label>Barva <select value={noteColor} onChange={e=>setNoteColor(e.target.value as ReaderNoteColor)}>
      <option value="gold">Zlatá</option><option value="blue">Modrá</option>
      <option value="green">Zelená</option><option value="rose">Růžová</option><option value="violet">Fialová</option>
     </select></label>
    <button type="submit">Uložit na stránce {visibleStart+1}</button>
   </form>
   <div className="semantic-public-reader__notes-items">
    {!notesSorted.length?<p>Dosud žádné poznámky.</p>:notesSorted.map(note=>
     <div key={note.id} className="semantic-public-reader__note" data-selected={note.id===selectedNoteId}>
      <button type="button" onClick={()=>goToNote(note)}>
       {note.title||"Poznámka"} · {Math.round(note.progressPercent)} %
      </button>
      {note.body?<p>{note.body}</p>:null}
      {note.source!=="synced"?<button type="button" onClick={()=>deleteNote(note)} aria-label="Smazat poznámku">Smazat</button>:null}
     </div>)}
   </div>
  </aside>:null}
  <div className="semantic-reader__triptych semantic-reader__triptych--focus">
   <section aria-label="Sémantická edice ARTales" className="semantic-public-reader__reading-section">
    <div className="semantic-reader__viewport semantic-public-reader__viewport" data-focused="true">
     <div className="semantic-reader__measurement semantic-public-reader__measurement"
      aria-hidden="true" ref={measureRef} style={{width:pageWidth}}>
      <div className="semantic-reader__page semantic-reader__measurement-page" style={pageStyle}>
       {units.map(unit=><div className="semantic-reader__unit" data-semantic-measure-id={unit.id} key={unit.id}>
        {unitView(unit,protectedTerms,visuals)}
       </div>)}
      </div>
     </div>
     {!spread?<div className="semantic-reader__pages semantic-reader__pages--scroll semantic-public-reader__flow" ref={flowRef}>
      {pages.map((page,index)=>renderPaper(page,index))}
     </div>:<div className="semantic-reader__pages semantic-reader__pages--spread semantic-public-reader__spread"
      aria-label="Dvoustránkové čtení">
      {renderPaper(pages[visibleStart],visibleStart)}
      {pages[visibleStart+1]?renderPaper(pages[visibleStart+1],visibleStart+1):renderPaper(undefined,visibleStart+1,true)}
     </div>}
    </div>
    {spread?<nav className="semantic-public-reader__navigation" aria-label="Listování">
     <button type="button" disabled={visibleStart===0} onClick={()=>goToIndex(visibleStart-2)}>‹</button>
     <span>{visibleStart+1}–{Math.min(total,visibleStart+2)} / {total}</span>
     <button type="button" disabled={visibleStart+2>=total} onClick={()=>goToIndex(visibleStart+2)}>›</button>
    </nav>:null}
   </section>
  </div>
 </main>;
}
