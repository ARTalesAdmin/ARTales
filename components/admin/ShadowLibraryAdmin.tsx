"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {rebalancePercentages} from "@/lib/prescreen/shadowPolicy";
import {PRESCREEN_GENRES,type PrescreenGenre,type PrescreenWeights} from "@/lib/prescreen/engine";
import {PRESCREEN_THEMES,type PrescreenTheme,type ThemeWeights} from "@/lib/prescreen/themes";
import "./ShadowLibraryAdmin.css";

const formNames:Record<PrescreenGenre,string>={prose:"Próza",poetry:"Poezie",drama:"Drama",fairy_tale:"Pohádka",essay:"Esej",other:"Ostatní"};
const themeNames:Record<PrescreenTheme,string>={horror:"Horor",romance:"Romantika",detective:"Detektivka",science_fiction:"Sci-fi",fantasy:"Fantasy",adventure:"Dobrodružství",humor:"Humor",historical:"Historický",mystery:"Záhady",social:"Společenský"};
type Title={id:string;title:string;author:string;form:string;themes:string[];primary_theme:string|null;state:string;reason:string;reconsider_year:number|null;first_published:number|null;author_died:number|null;source_url:string};
type Handoff={id:string;title_id:string;state:string;selected_at:string;transferred_candidate_id:string|null};
type State={policy:{form_weights:PrescreenWeights;theme_weights:ThemeWeights;revision:number};titles:Title[];handoffs:Handoff[]};
type Run={id:string;requested:number;status:string;summary:{discovered?:number;suggested?:number;review?:number;deferred?:number;missing?:number;stopReason?:string;problems?:string[]};started_at:string};
type Tab="catalog"|"handoff"|"weights"|"history";
async function readJson(path:string,init?:RequestInit){
 const response=await fetch(path,init);
 const data=await response.json().catch(()=>({error:"Neplatná odpověď serveru"}));
 if(!response.ok)throw Error(data.error??"Server není dostupný");
 return data;
}
function statusFor(t:Title){
 if(t.state==="suggested")return {kind:"ready",label:"Vhodné k prověření",description:"Základní autorská lhůta uplynula. Právní kontrola teprve následuje."};
 if(t.state==="deferred")return {kind:"deferred",label:"Pro budoucnost",description:t.reconsider_year?"Znovu prověřit od roku "+t.reconsider_year:"Zatím nesplňuje předběžnou lhůtu."};
 return {kind:"review",label:"Nutno doplnit údaje",description:"Neznáme dost údajů o autorovi či vydání. Právní kontrola ještě neproběhla."};
}
function summaryMessage(r:Run["summary"]){
 const count=r.discovered??0,valid=r.suggested??0,review=r.review??0,deferred=r.deferred??0;
 const why=r.stopReason==="target_reached"?"Nalezen požadovaný počet předběžně vhodných knih.":r.stopReason==="enrichment_limit"?"Pro tento běh byl dosažen limit kontrol. Zkus další hledání.":r.stopReason==="time_budget"?"Vyhledávání dosáhlo časového limitu. Další spuštění naváže.":"Vyhledávání skončilo. Můžeš pokračovat další dávkou.";
 return `${count} nových titulů · ${valid} předběžně vhodných · ${review} k doplnění · ${deferred} pro budoucnost. ${why}`;
}
export default function ShadowLibraryAdmin(){
 const [data,setData]=useState<State|null>(null);
 const [forms,setForms]=useState<PrescreenWeights|null>(null);
 const [themes,setThemes]=useState<ThemeWeights|null>(null);
 const [runs,setRuns]=useState<Run[]>([]);
 const [tab,setTab]=useState<Tab>("catalog");
 const [filter,setFilter]=useState("all");
 const [requested,setRequested]=useState(5);
 const [period,setPeriod]=useState("1900");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const refresh=useCallback(async()=>{
  const next=await readJson("/api/member/prescreen/shadow") as State;
  setData(next);setForms(next.policy.form_weights);setThemes(next.policy.theme_weights);
 },[]);
 const refreshHistory=useCallback(async()=>{
  const result=await readJson("/api/member/prescreen/shadow?tab=runs");
  setRuns(result.runs??[]);
 },[]);
 useEffect(()=>{void refresh().catch(e=>setError(String(e.message)));},[refresh]);
 const selected=new Set(data?.handoffs.filter(h=>h.state==="queued").map(h=>h.title_id)??[]);
 const transferred=new Map(data?.handoffs.filter(h=>h.state==="transferred").map(h=>[h.title_id,h.transferred_candidate_id])??[]);
 const entries=useMemo(()=>data?.titles??[],[data]);
 const chosen=entries.filter(t=>selected.has(t.id));
 const visible=entries.filter(t=>filter==="all"||t.state===filter);
 async function act(action:Record<string,unknown>){
  setBusy(true);setError("");setMessage("");
  try{
   const result=await readJson("/api/member/prescreen/shadow",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(action)});
   await refresh();
   if(action.action==="run")setMessage(summaryMessage(result.summary));
   else if(action.action==="handoff"){setMessage("Kniha byla přidána do výběru k předání.");setTab("handoff");}
   else if(action.action==="transfer"){setMessage("Kandidát byl založen. Najdeš jej v evidenci Kandidátů.");setTab("handoff");}
   else if(action.action==="withdraw")setMessage("Kniha byla z výběru vrácena do knihovny.");
   else setMessage("Nové váhy jsou uloženy.");
  }catch(e){setError(e instanceof Error?e.message:"Požadavek se nezdařil");}
  finally{setBusy(false);}
 }
 function changeTab(next:Tab){setTab(next);setError("");setMessage("");if(next==="history")void refreshHistory().catch(e=>setError(String(e.message)));}
 function editor<K extends string>(order:readonly K[],names:Record<K,string>,weights:Record<K,number>,onChange:(v:Record<K,number>)=>void){
  return <div className="ps-weights">
   {order.map(key=><label className="ps-weight" key={key}>
    <span>{names[key]}</span>
    <input aria-label={names[key]+" posuvník"} type="range" min="0" max="100" value={weights[key]} onChange={e=>onChange(rebalancePercentages(weights,key,Number(e.target.value)))}/>
    <input aria-label={names[key]+" procenta"} type="number" min="0" max="100" value={weights[key]} onChange={e=>onChange(rebalancePercentages(weights,key,Number(e.target.value)))}/>
    <span className="ps-unit">%</span>
   </label>)}
   <div className="ps-total">Celkem {order.reduce((n,k)=>n+weights[k],0)} %</div>
  </div>;
 }
 function book(t:Title){
  const status=statusFor(t),queued=selected.has(t.id),candidateId=transferred.get(t.id);
  return <article key={t.id} className="ps-book">
   <div className="ps-book-head"><div><h3>{t.title}</h3><p className="ps-book-author">{t.author}</p></div>
    <span className={"ps-status ps-status-"+status.kind}>{status.label}</span>
   </div>
   <p className="ps-book-meta">{formNames[t.form as PrescreenGenre]??t.form}
    {t.themes.length?" · "+t.themes.map(tag=>themeNames[tag as PrescreenTheme]??tag).join(", "):""}
    {" · První vydání: "}{t.first_published??"nezjištěno"}
    {" · Úmrtí autora: "}{t.author_died??"nezjištěno"}
   </p>
   <p className="ps-book-description">{status.description}</p>
   <div className="ps-actions">
    {candidateId?<Link className="ps-button ps-button-primary" href={"/member/candidates/"+candidateId}>Otevřít kandidáta →</Link>:queued?<button type="button" className="ps-button ps-button-quiet" disabled={busy} onClick={()=>void act({action:"withdraw",titleId:t.id})}>Vrátit do knihovny</button>:
     t.state!=="deferred"?<button type="button" className="ps-button ps-button-primary" disabled={busy} onClick={()=>void act({action:"handoff",titleId:t.id})}>Vybrat k předání</button>:null}
    <a href={t.source_url} target="_blank" rel="noopener noreferrer" className="ps-button ps-button-secondary">Zobrazit zdroj ↗</a>
   </div>
  </article>;
 }
 return <main className="ps-root">
  <header className="ps-header">
   <div><p className="ps-eyebrow">ARTales / Administrace</p><h1>Stínová knihovna</h1>
    <p>Objevuj díla, která stojí za bližší posouzení. Výsledky zůstanou uložené i pro budoucnost.</p></div>
   <span className="ps-version">Bibliografický průzkum · ČR / EU</span>
  </header>
  <nav aria-label="Sekce Prescreenu" className="ps-tabs">
   {([["catalog","Knihovna"],["handoff","Výběr k předání"],["weights","Váhy a strategie"],["history","Historie hledání"]] as const).map(([key,label])=>
    <button type="button" key={key} aria-current={tab===key?"page":undefined} onClick={()=>changeTab(key)} className={"ps-tab"+(tab===key?" ps-tab-current":"")}>{label}{key==="handoff"?" ("+chosen.length+")":""}</button>)}
  </nav>
  {error&&<div role="alert" className="ps-alert ps-alert-error">{error}</div>}
  {message&&<div role="status" className="ps-alert ps-alert-success">{message}</div>}
  {!data&&<div className="ps-panel">Načítám uložené knihy…</div>}
  {tab==="catalog"&&data&&<>
   <section className="ps-panel ps-search">
    <div><h2>Najít další knihy</h2><p>Vyhledávání v Open Library je bez poplatku za dotaz. Nové knihy se uloží i tehdy, když zatím nesplňují právní podmínky.</p></div>
    <div className="ps-search-controls">
     <label>Počet vhodných knih <input type="number" min="1" max="12" value={requested} onChange={e=>setRequested(Number(e.target.value))}/></label>
     <label>První vydání <select value={period} onChange={e=>setPeriod(e.target.value)}>
      <option value="1900">do roku 1900</option><option value="1930">do roku 1930</option>
      <option value="1950">do roku 1950</option><option value="1970">do roku 1970</option>
      <option value="all">Všechna období</option>
     </select></label>
     <button type="button" className="ps-button ps-button-primary" disabled={busy||!Number.isInteger(requested)||requested<1||requested>12} onClick={()=>void act({action:"run",requested,maxYear:period==="all"?null:Number(period)})}>{busy?"Vyhledávám…":"Spustit hledání"}</button>
    </div>
   </section>
   <div className="ps-stats"><div><strong>{entries.length}</strong><span>Zobrazených knih</span></div>
    <div><strong>{entries.filter(t=>t.state==="suggested").length}</strong><span>Předběžně vhodné</span></div>
    <div><strong>{entries.filter(t=>t.state==="review").length}</strong><span>K doplnění</span></div>
    <div><strong>{entries.filter(t=>t.state==="deferred").length}</strong><span>Pro budoucnost</span></div></div>
   <div className="ps-section-heading"><h2>Uložené knihy</h2><label>Filtrovat <select value={filter} onChange={e=>setFilter(e.target.value)}>
    <option value="all">Všechny</option><option value="suggested">Předběžně vhodné</option><option value="review">K doplnění</option><option value="deferred">Pro budoucnost</option>
   </select></label></div>
   <div className="ps-books">{visible.length?visible.map(book):<div className="ps-panel">Zatím tu nejsou žádné knihy odpovídající filtru.</div>}</div>
  </>}
  {tab==="handoff"&&data&&<section className="ps-panel">
   <h2>Výběr k předání</h2>
   <p>Vybrané náměty můžeš převést do trvalé evidence Kandidátů. Open Library je pouze bibliografický tip; žádnou edici ani práva tím neschvaluješ.</p>
   <p><Link className="ps-button ps-button-secondary" href="/member/candidates">Otevřít seznam Kandidátů →</Link></p>
   {chosen.length?<div className="ps-books">{chosen.map(t=><div key={t.id}>{book(t)}<button className="ps-button ps-button-primary" type="button" disabled={busy} onClick={()=>void act({action:"transfer",titleId:t.id})}>Převést na Kandidáta</button></div>)}</div>:<p className="ps-empty">Zatím nemáš vybranou žádnou knihu. V Knihovně zvol „Vybrat k předání“.</p>}
  </section>}
  {tab==="weights"&&forms&&themes&&data&&<section className="ps-panel">
   <h2>Váhy a strategie</h2><p>Nastav poměr literárních forem a žánrů. Ostatní hodnoty se vždy přepočítají tak, aby každá skupina měla 100 %.</p>
   <h3>Literární forma</h3>{editor(PRESCREEN_GENRES,formNames,forms,setForms)}
   <h3>Tematické žánry</h3>{editor(PRESCREEN_THEMES,themeNames,themes,setThemes)}
   <button type="button" className="ps-button ps-button-primary" disabled={busy} onClick={()=>void act({action:"policy",forms,themes,revision:data.policy.revision})}>Uložit strategii</button>
  </section>}
  {tab==="history"&&<section className="ps-panel">
   <h2>Historie hledání</h2><p>Každé hledání zůstává zaznamenané. Pokud se nepodaří získat požadovaný počet vhodných knih, můžeš hledání opakovat.</p>
   {runs.length?runs.map(r=><article key={r.id} className="ps-history"><div className="ps-book-head"><strong>{new Date(r.started_at).toLocaleString("cs-CZ")}</strong><span className={"ps-status "+(r.status==="complete"?"ps-status-ready":"ps-status-review")}>{r.status==="complete"?"Dokončeno":"Částečný výsledek"}</span></div>
    <p>{summaryMessage(r.summary)}</p><p>Požadováno: {r.requested} předběžně vhodných knih.</p>
   </article>):<p className="ps-empty">Zatím nebylo spuštěno žádné hledání.</p>}
  </section>}
  <p className="ps-disclaimer">Předběžný výběr není právním schválením díla. Překlady, ilustrace a konkrétní vydání vyžadují samostatné posouzení.</p>
 </main>;
}
