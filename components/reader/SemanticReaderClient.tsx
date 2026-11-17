"use client";
import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from "react";
import {unitView,type ApprovedSemanticImage} from "@/components/reader/SemanticPageUnit";
import ReaderToolbar from "@/components/reader/ReaderToolbar";
import {getPublicDictionary} from "@/lib/i18n/public";
import {iterateSemanticPages,projectFlatChapterHeadings} from "@/lib/semantic/readerProjection";
import {segmentSemanticProse} from "@/lib/semantic/protectedSpans";
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
// Stable defaults: allocating [] during each render cancels the in-flight
// page stream on every partial update for works without editorial terms.
const EMPTY_PROTECTED_TERMS:string[]=[];
const EMPTY_VISUALS:ApprovedSemanticImage[]=[];
const countProgress=(index:number,count:number)=>count<=1?100:Math.max(0,Math.min(100,index/(count-1)*100));
const pageStart=(index:number,spread:boolean)=>spread?index-index%2:index;

export default function SemanticReaderClient({slug,title,locale,mode,revisionSha,units,
 protectedTerms=EMPTY_PROTECTED_TERMS,visuals=EMPTY_VISUALS}:Props){
 const semanticUnits=useMemo(()=>projectFlatChapterHeadings(units),[units]);
 const [settings,setSettings]=useState<ReaderSettings>(defaultReaderSettings);
 const [hydrated,setHydrated]=useState(false);
 const [viewport,setViewport]=useState({width:1024,height:780});
 const [nativeFullscreen,setNativeFullscreen]=useState(false);
 const immersive=nativeFullscreen;
 const readerRootRef=useRef<HTMLElement|null>(null);
 const [measurements,setMeasurements]=useState<Measurements|null>(null);
 const [measuredPages,setMeasuredPages]=useState<{key:string;pages:SemanticPage[];complete:boolean}|null>(null);
 const [capacityPenalty,setCapacityPenalty]=useState(0);
 const [scrollFallbackPages,setScrollFallbackPages]=useState<number[]>([]);
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
 // Only the reading layout controls page geometry. Native fullscreen must
 // never reflow or shrink sheets: it changes browser chrome, not the book.
 // Match the visible spread's stage padding when measuring offscreen.
 const spreadSidePadding=Math.min(30,Math.max(12,viewport.width*.02));
 const availableSpreadWidth=Math.min(1460,viewport.width-44,
  viewport.width-2*spreadSidePadding);
 const pageWidth=Math.max(250,Math.floor(Math.min(
  spread?Math.min(730,availableSpreadWidth/2):singleWidth,viewport.width-24)));
 const pageHeight=Math.round(pageWidth*1.414);
 const pageContentHeight=Math.max(300,pageHeight-210);
 const measureKey=[revisionSha,mode,pageWidth,pageHeight,settings.fontScale,
  settings.density,semanticUnits.length,protectedTerms.join("\u0001")].join("|");
 const readyMeasurements=measurements?.key===measureKey?measurements.heights:undefined;
 // Leave a small rounding buffer after measuring the actual content rect.
 // The existing ink-overflow check increases capacityPenalty and repaginates
 // if the real browser needs more space; never silently clip text.
 const measuredCapacity=measurements?.key===measureKey?measurements.contentHeight:pageContentHeight;
 // The measured grid can temporarily report zero before the first browser
 // layout pass. Never feed transient dimensions below the canonical engine's
 // validated viewport minimum; the next ResizeObserver event remeasures.
 const actualCapacity=Math.max(220,Number.isFinite(measuredCapacity)?
  measuredCapacity-12-capacityPenalty:pageContentHeight-12-capacityPenalty);
 const measuredWidth=measurements?.key===measureKey?measurements.contentWidth:pageWidth-144;
 const contentWidth=Math.max(200,Number.isFinite(measuredWidth)?measuredWidth:pageWidth-144);
 // Render the first leaf without a synchronous full-book fallback.
 // DOM measurement and all later pages use the same canonical iterator.
 const fallbackPages=useMemo(()=>{
  const iterator=iterateSemanticPages(semanticUnits,{
   mode:"paged",viewport_width:460,viewport_height:780,
   font_scale:1,density:"comfortable",protected_terms:protectedTerms,
  });
  const first=iterator.next();
  iterator.return(undefined);
  return first.done?[]:[first.value];
 },[semanticUnits,protectedTerms]);
 const paginationKey=[measureKey,contentWidth,actualCapacity,readyMeasurements?"measured":"estimate"].join("|");
 const pages=measuredPages?.key===paginationKey?measuredPages.pages:measuredPages?.pages??fallbackPages;
 const paginationSettled=Boolean(measuredPages?.key===paginationKey&&measuredPages.complete);
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
 const progress=paginationSettled?countProgress(current,total):
  measuredPages?.complete?countProgress(current,measuredPages.pages.length):0;
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
  const saved=loadReaderSettings();
  // Fullscreen is independent from the saved page/spread reading mode.
  const semanticPreference=window.localStorage.getItem("artales-semantic-layout-mode");
  const layoutMode=semanticPreference==="spread"||semanticPreference==="pagedFlow"
   ?semanticPreference:window.innerWidth>=860?"spread":"pagedFlow";
  setSettings({...saved,layoutMode,controlsCollapsed:true});
  setNotes(loadReaderNotes(slug,title));
  setHydrated(true);
 },[slug,title]);
 useEffect(()=>{
  if(!hydrated)return;
  // The semantic Reader stores its layout preference separately. Do not
  // change the classic Reader's layout through shared reader settings.
  const legacyLayout=loadReaderSettings().layoutMode;
  saveReaderSettings({...settings,layoutMode:legacyLayout});
 },[hydrated,settings]);
 // Browser fullscreen requires a user gesture, whereas the quiet immersive
 // layout may load by default. Esc exits native fullscreen but preserves the
 // chosen immersive Reader layout.
 useEffect(()=>{
  const onFullscreenChange=()=>setNativeFullscreen(
   document.fullscreenElement===readerRootRef.current);
  document.addEventListener("fullscreenchange",onFullscreenChange);
  return ()=>document.removeEventListener("fullscreenchange",onFullscreenChange);
 },[]);
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
  if(!hydrated||restoredRef.current||!total||!paginationSettled)return;
  const saved=mode==="full"?loadReaderProgress(slug):null;
  if(saved&&Number.isFinite(saved.progressPercent)){
   const next=Math.max(0,Math.min(total-1,Math.round(saved.progressPercent/100*(total-1))));
   setPageIndex(next);
  }
  restoredRef.current=true;
 },[hydrated,mode,slug,total,paginationSettled]);
 useEffect(()=>{
  if(!hydrated||!restoredRef.current||mode!=="full"||!paginationSettled)return;
  saveReaderProgress({
   slug,mode:"full",pageIndex:current,pageCount:total,progressPercent:progress,
   scrollY:current,layoutMode:settings.layoutMode,updatedAt:new Date().toISOString(),
  });
 },[hydrated,mode,slug,current,total,progress,settings.layoutMode,paginationSettled]);
 // Partial repagination publishes four-page slices: never clamp the saved
 // reader position to a temporary partial page count.
 useEffect(()=>{if(paginationSettled)setPageIndex(old=>Math.min(old,total-1))},
  [total,paginationSettled]);
 // The exact same semantic markup is measured before repagination as in QA.
 useEffect(()=>{
  const measure=()=>{
   const root=measureRef.current;
   if(!root)return;
   const elements=[...root.querySelectorAll<HTMLElement>("[data-semantic-measure-id]")];
   if(elements.length!==semanticUnits.length)return;
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
 },[measureKey,semanticUnits,pageContentHeight,pageWidth]);
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
  const cache=new Map<string,{height:number;last_line_top:number;last_line_fill:number;last_line_words:number}|null>();
  const fragmentGeometry=(unit:SemanticPageUnit)=>{
   if(!unit.fragment||!("atom" in unit.node))return null;
   const {start,end,original_unit_id}=unit.fragment;
   const key=original_unit_id+":"+start+":"+end;
   if(cache.has(key))return cache.get(key)??null;
   const template=original.get(original_unit_id);
   if(!template)return null;
   const clone=template.cloneNode(true) as HTMLElement;
   const prose=clone.querySelector("p,blockquote,aside");
   if(!prose)return null;
   // Measure the exact same fragment DOM as SemanticPageUnit/ProtectedProseText.
   // Cloning the uncut paragraph and deleting Ranges leaves different protection
   // wrappers, so the measured lines can disagree with the published page.
   const atom=prose.querySelector<HTMLElement>(".semantic-reader__atom");
   if(!atom)return null;
   const segments=segmentSemanticProse(unit.node.atom.raw.slice(start,end),protectedTerms);
   const children:Node[]=[];
   for(const segment of segments){
    if(!segment.protected){children.push(document.createTextNode(segment.text));continue;}
    const protectedNode=document.createElement("span");
    protectedNode.style.whiteSpace="nowrap";
    protectedNode.dataset.workProtectedTerm=segment.text;
    protectedNode.textContent=segment.text;
    children.push(protectedNode);
   }
   atom.replaceChildren(...children);
   prose.classList.add("semantic-reader__fragment");
   if(start>0)prose.classList.add("semantic-reader__fragment--continued");
   if(!unit.fragment.continuation_after)prose.classList.add("semantic-reader__fragment--final");
   if(unit.kind==="footnote"&&start>0)prose.querySelector("sup")?.remove();
   clone.removeAttribute("data-semantic-measure-id");
   content.appendChild(clone);
   const measuredBox=clone.getBoundingClientRect();
   const height=Math.ceil(measuredBox.height*2)/2;
   const proseBox=prose.getBoundingClientRect();
   let lastTop=-Infinity,lastRight=proseBox.left;
   const textWalker=document.createTreeWalker(prose,NodeFilter.SHOW_TEXT);
   let textNode:Node|null;
   while((textNode=textWalker.nextNode())){
    if(!textNode.textContent?.trim())continue;
    const range=document.createRange();range.selectNodeContents(textNode);
    for(const rect of range.getClientRects()){
     if(rect.width<0.1||rect.height<0.1)continue;
     if(rect.top>lastTop+1.5){lastTop=rect.top;lastRight=rect.right;}
     else if(Math.abs(rect.top-lastTop)<=1.5)lastRight=Math.max(lastRight,rect.right);
    }
   }
   // The last row must be counted from visible DOM word boxes, not raw
   // character counts: protected names are atomic and font marks change width.
   // Traverse backwards and stop when encountering a preceding physical row.
   let lastLineWords=0;
   let reachedPreviousRow=false;
   const wordNodes:Text[]=[];
   const wordWalker=document.createTreeWalker(prose,NodeFilter.SHOW_TEXT);
   while((textNode=wordWalker.nextNode()))wordNodes.push(textNode as Text);
   for(let i=wordNodes.length-1;i>=0&&!reachedPreviousRow;i--){
    const node=wordNodes[i],source=node.textContent??"";
    const words=[...source.matchAll(/\\S+/gu)];
    for(let j=words.length-1;j>=0;j--){
     const match=words[j];
     const range=document.createRange();
     range.setStart(node,match.index!);
     range.setEnd(node,match.index!+match[0].length);
     const rects=[...range.getClientRects()];
     if(rects.some(rect=>Math.abs(rect.top-lastTop)<=1.5))lastLineWords++;
     else if(rects.some(rect=>rect.top<lastTop-1.5)){
      reachedPreviousRow=true;break;
     }
    }
   }
   clone.remove();
   if(!Number.isFinite(lastTop)||!Number.isFinite(proseBox.width)||proseBox.width<=0){
    cache.set(key,null);return null;
   }
   const value={height,last_line_top:lastTop-measuredBox.top,
    last_line_fill:Math.max(0,Math.min(1,(lastRight-proseBox.left)/proseBox.width)),
    last_line_words:lastLineWords};
   cache.set(key,value);return value;
  };
  const fragmentHeight=(unit:SemanticPageUnit):number|null=>
   fragmentGeometry(unit)?.height??null;
  const iterator=iterateSemanticPages(semanticUnits,{
   mode:"paged",viewport_width:contentWidth,
   viewport_height:actualCapacity+100,content_height:actualCapacity,
   font_scale:settings.fontScale,density:settings.density,
   measured_unit_heights:readyMeasurements,protected_terms:protectedTerms,
   measure_fragment_height:fragmentHeight,
   measure_fragment_geometry:fragmentGeometry,
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
    setMeasuredPages({key:paginationKey,pages:collected,complete:true});
    return;
   }
   // Show the first pages immediately, then reveal bounded groups.
   // Do not commit a React render for every page.
   if(collected.length===4||collected.length%16===0)
    setMeasuredPages({key:paginationKey,pages:[...collected],complete:false});
   frame=requestAnimationFrame(step);
  };
  frame=requestAnimationFrame(step);
  return ()=>{
   reflowGeneration.current++;
   cancelAnimationFrame(frame);
   iterator.return(undefined);
  };
 },[paginationKey,readyMeasurements,semanticUnits,contentWidth,actualCapacity,
   settings.fontScale,settings.density,protectedTerms]);

 // Guard against any final browser layout discrepancy (fonts, image boxes,
 // CSS rounding). If the visible rendered ink crosses the content boundary,
 // reserve more height and recompute. If that still fails, expose scrolling,
 // NEVER silently clip a line behind overflow:hidden.
 useEffect(()=>{
  if(!paginationSettled||!readerRootRef.current)return;
  const frame=requestAnimationFrame(()=>{
   const root=readerRootRef.current;
   if(!root)return;
   let greatestOverflow=0;
   const affected:number[]=[];
   const papers=root.querySelectorAll<HTMLElement>(
    ".semantic-public-reader__paper[data-semantic-page-index]");
   for(const paper of papers){
    if(paper.classList.contains("semantic-reader__front-page")||
       paper.classList.contains("semantic-public-reader__paper--scroll-unit"))continue;
    const area=paper.querySelector<HTMLElement>(".semantic-public-reader__page-content");
    if(!area)continue;
    const rect=area.getBoundingClientRect();
    // Skip virtualized and offscreen pages; they are verified when visited.
    if(rect.bottom<0||rect.top>window.innerHeight)continue;
    let inkBottom=-Infinity;
    const walker=document.createTreeWalker(area,NodeFilter.SHOW_TEXT);
    let node:Node|null;
    while((node=walker.nextNode())){
     if(!node.textContent?.trim())continue;
     const range=document.createRange();
     range.selectNodeContents(node);
     for(const box of range.getClientRects())
      if(box.height>.5&&box.width>.5)inkBottom=Math.max(inkBottom,box.bottom);
    }
    for(const media of area.querySelectorAll<HTMLElement>("figure,img,pre,svg"))
     inkBottom=Math.max(inkBottom,media.getBoundingClientRect().bottom);
    const overflow=inkBottom-rect.bottom;
    if(overflow>2){
     greatestOverflow=Math.max(greatestOverflow,overflow);
     affected.push(Number(paper.dataset.semanticPageIndex));
    }
   }
   if(!affected.length)return;
   if(capacityPenalty<96)
    setCapacityPenalty(old=>Math.min(96,old+Math.max(16,Math.ceil(greatestOverflow+12))));
   else setScrollFallbackPages(old=>[...new Set([...old,...affected])]);
  });
  return ()=>cancelAnimationFrame(frame);
 },[paginationSettled,paginationKey,pageIndex,spread,capacityPenalty]);
 useEffect(()=>{setCapacityPenalty(0);setScrollFallbackPages([]);},[measureKey]);
 const patch=useCallback((next:Partial<ReaderSettings>)=>setSettings(old=>({...old,...next})),[]);
 const goToIndex=useCallback((index:number)=>{
  const safe=Math.max(0,Math.min(total-1,index));
  const target=pageStart(safe,spread);
  const first=pages[target]?.units.find(u=>u.source_atom_ids.length>0);
  if(first)readingAnchor.current={
   rootId:first.fragment?.original_unit_id??first.id,
   offset:first.fragment?.start??0,
  };
  setPageIndex(target);
  if(spread){
   const scrollTarget=immersive?readerRootRef.current:window;
   scrollTarget?.scrollTo({top:0,behavior:"smooth"});
  }
  if(!spread){
   const element=flowRef.current?.querySelector<HTMLElement>(
    '[data-semantic-page-index="'+target+'"]');
   element?.scrollIntoView({behavior:"smooth",block:"start"});
  }
 },[total,spread,immersive,pages]);
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
  // Native fullscreen scrolls the Reader root, not the window. Listening
  // only to window freezes the page indicator, progress and reading anchor.
  const scrollTarget=immersive?readerRootRef.current:window;
  scrollTarget?.addEventListener("scroll",onScroll,{passive:true});
  return ()=>scrollTarget?.removeEventListener("scroll",onScroll);
 },[spread,pages.length,immersive]);
 const addNote=useCallback((input:{title:string;body:string;color:ReaderNoteColor})=>{
  if(!paginationSettled)return;
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
 },[slug,progress,current,total,settings.layoutMode,notesSyncState,paginationSettled]);
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
    (page?.overflow==="scroll_unit"||scrollFallbackPages.includes(index)?
      " semantic-public-reader__paper--scroll-unit":"")}
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

 const toggleFullscreen=()=>{
  if(document.fullscreenElement){
   void document.exitFullscreen();
   return;
  }
  const root=readerRootRef.current;
  if(root?.requestFullscreen)void root.requestFullscreen().catch(()=>{});
 };
 const dictionary=getPublicDictionary(locale);
 const toggleControls=()=>setSettings(old=>({...old,controlsCollapsed:!old.controlsCollapsed}));
 return <main lang={locale} ref={readerRootRef}
  className={"artales-reader artales-reader--semantic"+
   (immersive?" artales-reader--immersive":"")+
   " artales-reader--theme-"+settings.theme+
   " artales-reader--width-"+settings.width+
   " artales-reader--density-"+settings.density+
   " artales-reader--layout-"+settings.layoutMode+
   " artales-reader--pagefit-"+settings.pageFit}>
  {!paginationSettled?<div role="status" aria-live="polite" className="semantic-public-reader__reflow-status">
   Přepočítávám sazbu…
  </div>:null}
  <ReaderToolbar title={title} detailHref={"/work/"+slug}
   mode={mode} fullHref={"/reader/"+slug+"?mode=full"}
   progressPercent={progress} pageIndex={current} pageCount={total}
   settings={{...settings,showAdvancedReaderControls:true}}
   labels={dictionary.reader} chromeLabels={dictionary.public}
   notes={notesSorted} notesEnabled={paginationSettled}
   selectedNoteId={selectedNoteId} selectedNoteIndex={selectedNoteIndex}
   isNotesListExpanded={notesExpanded} notesSyncState={notesSyncState}
   onFontDelta={delta=>patch({fontScale:clampReaderFontScale(settings.fontScale+delta)})}
   onThemeChange={theme=>patch({theme})}
   onWidthChange={width=>patch({width})}
   onDensityChange={density=>patch({density})}
   onLayoutModeChange={layoutMode=>{
    window.localStorage.setItem("artales-semantic-layout-mode",layoutMode);
    patch({layoutMode});
   }}
   fullscreenActive={nativeFullscreen} onToggleFullscreen={toggleFullscreen}
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
        {semanticUnits.map(unit=><div className="semantic-reader__unit" data-semantic-measure-id={unit.id} key={unit.id}>
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
