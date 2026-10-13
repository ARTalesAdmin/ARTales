"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { synchronizeSemanticPanes } from "@/lib/semantic/pairedSemanticScroll";
import {
 FLOW_DEMO_BASE, FLOW_DEMO_KEY, FLOW_DEMO_RIGHTS,
 claimFlowDemo, editorialFlowDefects, finishFlowDemo, flowDemoInboxCount,
 freshFlowDemo, noteFlowDemo, queueFlowDemo, readFlowDemo, repairFlowDemo,
 type DemoBookBlock, type DemoDefectKey, type EditorialFlowBook, type FlowDemoSession,
} from "@/lib/fixtures/editorialFlowDemo";
import "./EditorialFlowDemo.css";
type View = "candidates" | "inbox" | "review";
type Side = "source" | "composed";
const stamp = () => new Date().toISOString();
export default function EditorialFlowDemo({view,book}:{view:View;book:EditorialFlowBook}) {
 const router=useRouter();
 const [session,setSession]=useState<FlowDemoSession>(freshFlowDemo);
 const [ready,setReady]=useState(false);
 const [storageEnabled,setStorageEnabled]=useState(true);
 const [checking,setChecking]=useState(false);
 const [selected,setSelected]=useState<string|null>(null);
 const [note,setNote]=useState("");
 const [feedback,setFeedback]=useState("");
 const timer=useRef<number|null>(null);
 const sourceRef=useRef<HTMLDivElement>(null);
 const composedRef=useRef<HTMLDivElement>(null);
 const frame=useRef<number|null>(null);
 const ignored=useRef<Record<Side,number>>({source:0,composed:0});
 const defects=editorialFlowDefects(book);
 const defectMap=new Map(defects.map(item=>[item.blockId,item.key]));
 const pending=flowDemoInboxCount(session);
 useEffect(()=>{
   let mounted=true;
   queueMicrotask(()=>{
     if(!mounted)return;
     try{setSession(readFlowDemo(window.localStorage.getItem(FLOW_DEMO_KEY)));setStorageEnabled(true);}
     catch{setStorageEnabled(false);}
     setReady(true);
   });
   return ()=>{mounted=false;if(timer.current!==null)window.clearTimeout(timer.current);
     if(frame.current!==null)window.cancelAnimationFrame(frame.current);};
 },[]);
 function commit(value:FlowDemoSession){
   try{window.localStorage.setItem(FLOW_DEMO_KEY,JSON.stringify(value));setSession(value);return true;}
   catch{setStorageEnabled(false);setFeedback("Prohlížeč nepovolil uložit rozpracovanou práci.");return false;}
 }
 function reset(){if(timer.current!==null)window.clearTimeout(timer.current);setChecking(false);
   setSelected(null);setNote("");setFeedback("");if(commit(freshFlowDemo()))router.push(FLOW_DEMO_BASE);}
 function begin(){if(checking||session.status!=="new")return;
   setChecking(true);timer.current=window.setTimeout(()=>{
     timer.current=null;commit(queueFlowDemo(session,stamp()));setChecking(false);},1000);}
 function enter(){if(session.status==="queued"||session.status==="in_review"){
   if(commit(claimFlowDemo(session)))router.push(FLOW_DEMO_BASE+"/review");}}
 function submit(){
   if(!selected)return;
   const key=defectMap.get(selected);
   try{
     const next=key?repairFlowDemo(session,key,note,stamp()):noteFlowDemo(session,selected,note,stamp());
     if(commit(next)){setFeedback(key?"Úprava byla zapracována.":"Připomínka byla uložena.");setNote("");}
   }catch(e){setFeedback(e instanceof Error?e.message:"Připomínku nelze uložit.");}
 }
 function finish(){try{
   if(commit(finishFlowDemo(session,stamp())))router.push(FLOW_DEMO_BASE+"/inbox");
 }catch(e){setFeedback(e instanceof Error?e.message:"Kontrolu nelze dokončit.");}}
 function onScroll(side:Side){
   if(frame.current!==null)window.cancelAnimationFrame(frame.current);
   frame.current=window.requestAnimationFrame(()=>{
     frame.current=null;
     if(performance.now()<ignored.current[side])return;
     const src=side==="source"?sourceRef.current:composedRef.current;
     const otherSide=side==="source"?"composed":"source";
     const dest=otherSide==="source"?sourceRef.current:composedRef.current;
     if(!src||!dest)return;
     const geometry=(element:HTMLElement)=>({
       markers:Array.from(element.querySelectorAll<HTMLElement>("[data-region-index]")).map(item=>({
         regionIndex:Number(item.dataset.regionIndex),top:item.getBoundingClientRect().top-element.getBoundingClientRect().top+element.scrollTop,
       })),scrollTop:element.scrollTop,clientHeight:element.clientHeight,scrollHeight:element.scrollHeight,
     });
     const next=synchronizeSemanticPanes(geometry(src),geometry(dest));
     ignored.current[otherSide]=performance.now()+100;dest.scrollTop=next;
   });
 }
 function selectBlock(blockId:string,side:Side){
   setSelected(blockId);setNote("");setFeedback("");
   // Align the corresponding source-anchored block to the same reading height.
   // Do not move the pane the editor just clicked.
   const from=side==="source"?sourceRef.current:composedRef.current;
   const otherSide:Side=side==="source"?"composed":"source";
   const to=otherSide==="source"?sourceRef.current:composedRef.current;
   const selector='[data-block-id="'+blockId+'"]';
   const chosen=from?.querySelector<HTMLElement>(selector);
   const counterpart=to?.querySelector<HTMLElement>(selector);
   if(!chosen||!counterpart||!to)return;
   if(frame.current!==null){window.cancelAnimationFrame(frame.current);frame.current=null;}
   const delta=counterpart.getBoundingClientRect().top-chosen.getBoundingClientRect().top;
   const max=Math.max(0,to.scrollHeight-to.clientHeight);
   to.scrollTop=Math.max(0,Math.min(max,to.scrollTop+delta));
   // Scroll events triggered by matching an anchor must not bounce back.
   window.requestAnimationFrame(()=>{ignored.current[otherSide]=performance.now()+180;});
 }
 const focused=book.blocks.find(block=>block.id===selected);
 const selectedKey=selected?defectMap.get(selected):undefined;
 const alreadyChanged=selectedKey?session.repairs[selectedKey]:selected?session.observations[selected]:undefined;
 const savedAny=Object.keys(session.repairs).length>0;
 function renderBlock(block:DemoBookBlock,side:Side,index:number){
   const key=defectMap.get(block.id);
   const damaged=side==="composed"&&key&&!session.repairs[key]?key:undefined;
   const cls=["flow-demo__text-block","flow-demo__text-block--"+block.kind,
      damaged?"flow-demo__text-block--misprint-"+damaged:"",
      selected===block.id?"flow-demo__text-block--selected":""].filter(Boolean).join(" ");
   const label=side==="source"?block.original:block.display;
   return <div key={block.id} data-region-index={index} data-block-id={block.id}
       className={cls} style={{marginTop:Math.min(24,block.gapBefore.length*1.5)}}>
     <button type="button" className="flow-demo__block-button"
       onClick={()=>selectBlock(block.id,side)} aria-pressed={selected===block.id}
       aria-label={(side==="source"?"Vybrat odpovídající blok originálu: ":"Otevřít připomínku k bloku: ")+label.slice(0,70)}>
       <BlockContent block={block} damaged={damaged} text={label}/>
     </button>
   </div>;
 }
 return <div className="flow-demo">
   <div className="flow-demo__subnav">
    <nav aria-label="Redakční navigace">
      <Link href={FLOW_DEMO_BASE} aria-current={view==="candidates"?"page":undefined}>Kandidáti</Link>
      <Link href={FLOW_DEMO_BASE+"/inbox"} aria-current={view==="inbox"?"page":undefined}>Redakční úkoly</Link>
    </nav>
    <Link className="flow-demo__account" href={FLOW_DEMO_BASE+"/inbox"}>
      Můj profil {ready&&pending>0?<span className="flow-demo__badge">1</span>:null}
    </Link>
   </div>
   <main className="flow-demo__main">
    <div className="flow-demo__context"><span>Redakční prostředí</span><span title="Náhledová data bez publikace">Náhled · nezveřejněno</span></div>
    {!ready?<p role="status">Načítání…</p>:!storageEnabled?
      <p role="alert">Nelze uchovat rozpracovanou práci v tomto prohlížeči.</p>:
    view==="candidates"?<section className="flow-demo__section">
      <h1>Kandidáti</h1>
      <article className="artales-member-panel flow-demo__candidate">
       <div className="flow-demo__book-icon" aria-hidden="true">A</div>
       <div><p className="flow-demo__muted">Literární dílo · původní jazyk</p>
        <h2>{book.title}</h2><p>{book.author}</p>
        <p className="flow-demo__muted">{book.sourceLabel}</p></div>
       <div>{session.status==="new"?
          <button className="artales-button-primary" type="button" disabled={checking} onClick={begin}>
            {checking?"Zpracovávám…":"Připravit k redakční kontrole"}</button>:
          <Link className="artales-button-primary" href={FLOW_DEMO_BASE+"/inbox"}>Redakční úkol</Link>}</div>
      </article>
      {checking?<p className="flow-demo__notice" role="status">Načítání zdroje a kontrola komponent…</p>:null}
      {session.status!=="new"?<section className="artales-member-panel flow-demo__rights">
       <h2>Stav zpracování</h2><dl>{FLOW_DEMO_RIGHTS.map(x=><div key={x.label}><dt>{x.label}</dt><dd>{x.value}</dd></div>)}</dl>
       <p className="flow-demo__muted">Výsledek vychází z předem připraveného náhledu. Není právním rozhodnutím.</p>
      </section>:null}
    </section>:view==="inbox"?<section className="flow-demo__section">
       <h1>Redakční úkoly</h1>
       {session.status==="new"?<div className="artales-member-panel flow-demo__panel">
        <p>Momentálně nemáte žádné otevřené úkoly.</p><Link href={FLOW_DEMO_BASE}>Kandidáti</Link></div>:
        <article className="artales-member-panel flow-demo__task">
         <div><span className="artales-status-chip">{session.status==="done"?"Dokončeno":session.status==="in_review"?"Rozpracováno":"K převzetí"}</span>
           <h2>{book.title}</h2><p>{book.author} · Kontrola redakčního zpracování</p></div>
         {session.status==="done"?<button className="artales-button-secondary" onClick={reset}>Nové zpracování</button>:
          <button className="artales-button-primary" onClick={enter}>{session.status==="queued"?"Otevřít úkol":"Pokračovat"}</button>}
        </article>}
    </section>:session.status!=="in_review"?<section className="artales-member-panel flow-demo__panel">
      <h1>Redakční kontrola</h1><p>Otevřete nejprve příslušný úkol.</p>
      <Link href={FLOW_DEMO_BASE+"/inbox"}>Zpět do úkolů</Link></section>:
    <section className="flow-demo__section">
      <div className="flow-demo__heading-row"><div><Link href={FLOW_DEMO_BASE+"/inbox"}>← Redakční úkoly</Link>
        <h1>{book.title}</h1><p>{book.author} · Kontrola sazby a struktury</p></div>
        <button className="artales-button-primary" type="button" disabled={!savedAny} onClick={finish}>
          Uložit a dokončit</button></div>
      <div className="flow-demo__review-grid">
        <section className="flow-demo__book" aria-label="Původní text">
          <header className="flow-demo__book-head"><strong>Původní text</strong><span>Gutenberg #11</span></header>
          <div className="flow-demo__book-scroll flow-demo__source" ref={sourceRef} onScroll={()=>onScroll("source")}>
           {book.blocks.map((block,index)=>renderBlock(block,"source",index))}
           <span>{book.sourceTail}</span>
          </div></section>
        <section className="flow-demo__book" aria-label="Redakční návrh">
          <header className="flow-demo__book-head"><strong>ARTales Reader</strong><span>Redakční verze</span></header>
          <div className="flow-demo__book-scroll" ref={composedRef} onScroll={()=>onScroll("composed")}>
           {book.blocks.map((block,index)=>renderBlock(block,"composed",index))}
          </div></section>
      </div>
      {selected&&focused?<section className="artales-member-panel flow-demo__notes">
         <div className="flow-demo__notes-head"><div><h2>Redakční připomínka</h2>
          <p className="flow-demo__selected-excerpt">„{focused.display.slice(0,120)}{focused.display.length>120?"…":""}“</p></div>
          <button className="flow-demo__close" onClick={()=>{setSelected(null);setNote("");setFeedback("");}} aria-label="Zavřít připomínku">×</button></div>
         {alreadyChanged?<p className="flow-demo__notice">{selectedKey?"Úprava zanesena.":"Připomínka uložena."} {alreadyChanged.text}</p>:
          <div className="flow-demo__note-form"><label htmlFor="flow-demo-note">Připomínka k vybranému bloku</label>
           <textarea id="flow-demo-note" value={note} onChange={e=>setNote(e.target.value)}
            rows={3} maxLength={500} placeholder="Popište požadovanou úpravu…" />
           <button className="artales-button-primary" type="button" disabled={note.trim().length<3} onClick={submit}>
            Uložit připomínku</button></div>}
         {feedback?<p role="status" className="flow-demo__notice">{feedback}</p>:null}
       </section>:null}
       {!selected&&feedback?<p role="status">{feedback}</p>:null}
      <p className="flow-demo__fineprint">Náhledová redakční revize. Původní text zůstává nezměněn; právní kontrola edice není uzavřena.</p>
    </section>}
   </main>
 </div>;
}
function BlockContent({block,text,damaged}:{block:DemoBookBlock;text:string;damaged?:DemoDefectKey}){
 if(block.kind==="chapter"&&!damaged)return <h3 className="flow-demo__chapter">{text}</h3>;
 if(block.kind==="section")return <h4>{text}</h4>;
 if(block.kind==="poem")return <pre className="flow-demo__poem">{text}</pre>;
 return <p className={damaged==="chapter"?"flow-demo__flat-heading":""}>{text}</p>;
}
