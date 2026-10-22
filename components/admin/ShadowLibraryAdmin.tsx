"use client";
import {useCallback,useEffect,useState} from "react";
import {rebalancePercentages} from "@/lib/prescreen/shadowPolicy";
import {PRESCREEN_GENRES,type PrescreenGenre,type PrescreenWeights} from "@/lib/prescreen/engine";
import {PRESCREEN_THEMES,type PrescreenTheme,type ThemeWeights} from "@/lib/prescreen/themes";
const formNames:Record<PrescreenGenre,string>={
 prose:"Próza",poetry:"Poezie",drama:"Drama",fairy_tale:"Pohádka",essay:"Esej",other:"Ostatní"};
const themeNames:Record<PrescreenTheme,string>={
 horror:"Horor",romance:"Romantika",detective:"Detektivka",science_fiction:"Sci-fi",
 fantasy:"Fantasy",adventure:"Dobrodružství",humor:"Humor",historical:"Historický",
 mystery:"Záhady",social:"Společenský"};
type Title={id:string;title:string;author:string;form:string;themes:string[];primary_theme:string|null;
 state:string;reason:string;reconsider_year:number|null;first_published:number|null;
 author_died:number|null;source_url:string};
type State={policy:{form_weights:PrescreenWeights;theme_weights:ThemeWeights;revision:number};
 titles:Title[];handoffs:Array<{id:string;title_id:string;state:string}>};
type Run={id:string;requested:number;status:string;summary:Record<string,unknown>;started_at:string};
async function json(path:string,init?:RequestInit){
 const r=await fetch(path,init);const data=await r.json();
 if(!r.ok)throw Error(data.error??"request_failed");
 return data;
}
export default function ShadowLibraryAdmin(){
 const [state,setState]=useState<State|null>(null);
 const [forms,setForms]=useState<PrescreenWeights|null>(null);
 const [themes,setThemes]=useState<ThemeWeights|null>(null);
 const [requested,setRequested]=useState(5);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [runs,setRuns]=useState<Run[]>([]);
 const [tab,setTab]=useState<"titles"|"settings"|"runs">("titles");
 const load=useCallback(async()=>{
  const data=await json("/api/member/prescreen/shadow");
  setState(data);setForms(data.policy.form_weights);setThemes(data.policy.theme_weights);
 },[]);
 useEffect(()=>{load().catch(e=>setNotice(e.message));},[load]);
 async function execute(body:object){
  setBusy(true);setNotice("");
  try{
   const result=await json("/api/member/prescreen/shadow",{method:"POST",
    headers:{"content-type":"application/json"},body:JSON.stringify(body)});
   await load();
   if("summary" in result){
    setNotice("Hotovo: "+JSON.stringify(result.summary));
   }else setNotice("Uloženo");
  }catch(e){setNotice(e instanceof Error?e.message:"unknown_error");}
  finally{setBusy(false);}
 }
 function weightsEditor<K extends string>(
  names:Record<K,string>,order:readonly K[],weights:Record<K,number>,
  change:(next:Record<K,number>)=>void
 ){
  return <div style={{display:"grid",gap:9}}>
   {order.map(k=><label key={k} style={{display:"grid",gridTemplateColumns:"145px 1fr 75px",gap:12,alignItems:"center"}}>
    <span>{names[k]}</span>
    <input aria-label={names[k]+" posuvník"} type="range" min={0} max={100}
     value={weights[k]} onChange={e=>change(rebalancePercentages(weights,k,Number(e.target.value)))}/>
    <input aria-label={names[k]+" procenta"} type="number" min={0} max={100}
     value={weights[k]} onChange={e=>change(rebalancePercentages(weights,k,Number(e.target.value)))}/>
   </label>)}
   <strong>Celkem: {Object.values(weights).reduce((a,b)=>a+b,0)} %</strong>
  </div>;
 }
 return <main style={{maxWidth:1100,margin:"auto",padding:"25px 22px 80px",lineHeight:1.55}}>
  <h1>Prescreen · Stínová knihovna</h1>
  <p>Levné bibliografické vyhledávání pro ČR/EU. Tato sekce nepotvrzuje autorská práva, nepřidává díla do Readeru a nevytváří kandidáty.</p>
  <nav style={{display:"flex",gap:12,flexWrap:"wrap",margin:"16px 0 24px"}}>
   <button type="button" onClick={()=>setTab("titles")}>Stínová knihovna</button>
   <button type="button" onClick={()=>setTab("settings")}>Váhy a strategie</button>
   <button type="button" onClick={async()=>{setTab("runs");try{
    const d=await json("/api/member/prescreen/shadow?tab=runs");setRuns(d.runs);}
    catch(e){setNotice(String(e));}}}>Historie hledání</button>
  </nav>
  {notice&&<p role="status">{notice}</p>}
  {tab==="settings"&&state&&forms&&themes&&<section>
   <h2>Literární forma</h2>
   {weightsEditor(formNames,PRESCREEN_GENRES,forms,setForms)}
   <h2>Tematické žánry</h2>
   {weightsEditor(themeNames,PRESCREEN_THEMES,themes,setThemes)}
   <p>Každá skupina si při úpravě udržuje součet 100 %. Změny se uloží až po potvrzení.</p>
   <button disabled={busy} type="button" onClick={()=>execute({action:"policy",
    forms,themes,revision:state.policy.revision})}>Uložit strategii</button>
  </section>}
  {tab==="titles"&&<section>
   <h2>Vyhledávání knih</h2>
   <label>Požadovaný počet vhodných titulů (1–12){" "}
    <input type="number" min={1} max={12} value={requested}
     onChange={e=>setRequested(Number(e.target.value))}/>
   </label>{" "}
   <button disabled={busy||!Number.isInteger(requested)||requested<1||requested>12}
    onClick={()=>execute({action:"run",requested})}>Spustit nové hledání</button>
   <h2>Trvalý katalog ({state?.titles.length??0} zobrazených)</h2>
   {state?.titles.length===0&&<p>Zatím nejsou uložené knihy.</p>}
   <div style={{display:"grid",gap:12}}>
    {state?.titles.map(t=><article key={t.id} style={{border:"1px solid #bdbdbd",borderRadius:8,padding:14}}>
     <strong>{t.title}</strong> — {t.author}
     <p>{formNames[t.form as PrescreenGenre]??t.form}
      {" · "}{t.themes.join(", ")||"bez tematického štítku"}
      {" · "}{t.state} ({t.reason})
     </p>
     <p>První vydání {t.first_published??"?"}; úmrtí autora {t.author_died??"?"}
      {t.reconsider_year?"; přezkum od "+t.reconsider_year:""}</p>
     <a href={t.source_url} target="_blank" rel="noreferrer">Katalogový zdroj</a>
     {" "}
     {state.handoffs.some(h=>h.title_id===t.id&&h.state==="queued")?
      <strong> V předávacím seznamu</strong>:
      (t.state==="suggested"||t.state==="review")&&
      <button disabled={busy} type="button" onClick={()=>execute({action:"handoff",titleId:t.id})}>
       Přijmout do předávacího seznamu
      </button>}
    </article>)}
   </div>
  </section>}
  {tab==="runs"&&<section><h2>Historie hledání</h2>
   {runs.length===0&&<p>Žádné uložené běhy.</p>}
   {runs.map(r=><article key={r.id} style={{padding:12,borderBottom:"1px solid #ccc"}}>
    <strong>{new Date(r.started_at).toLocaleString("cs-CZ")} · {r.status}</strong>
    <p>Požadováno: {r.requested} · {JSON.stringify(r.summary)}</p>
   </article>)}
  </section>}
  <p style={{marginTop:30}}>Předávací seznam je pouze evidence pro budoucí integraci. Neaktivuje právní kontrolu ani redakční úkoly.</p>
 </main>;
}
