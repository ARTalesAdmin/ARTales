"use client";
import {useState} from "react";
type Title={workKey:string;title:string;author:string;genre:string;authorBorn:number|null;authorDied:number|null;firstPublished:number|null;sourceUrl:string};
type Run={selected:Title[];target:number;missing:number;errors:string[];boundedBy:string|null;searched:number;warning:string;decisions:Array<{item:Title;outcome:string;reason:string}>};
export default function LiveBatchPreview(){
 const [target,setTarget]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [run,setRun]=useState<Run|null>(null),[chosen,setChosen]=useState<string[]>([]);
 const [accepted,setAccepted]=useState<Title[]>([]);
 async function search(){
  setBusy(true);setError("");setRun(null);setChosen([]);
  try{
   const r=await fetch("/api/fixture/prescreen/batch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({target})});
   const data=await r.json();if(!r.ok)throw Error(data.error??"lookup_failed");
   setRun(data);
  }catch(e){setError(e instanceof Error?e.message:"lookup_failed");}finally{setBusy(false);}
 }
 function approve(){
  if(!run)return;
  setAccepted(old=>{
   const m=new Map(old.map(t=>[t.workKey,t]));
   for(const t of run.selected)if(chosen.includes(t.workKey))m.set(t.workKey,t);
   return [...m.values()];
  });
  setChosen([]);
 }
 return <section style={{maxWidth:980,margin:"26px auto",padding:22,border:"2px solid #aa8c52",lineHeight:1.65}}>
  <h2>Živý prescreen — jeden až pět skutečných titulů</h2>
  <p>Dotazy probíhají do Open Library. Literární váhy a kontrolní knihovna jsou testovací. Žádný výsledek se neukládá do produkční databáze.</p>
  <label>Počet <input type="number" min={1} max={5} value={target} onChange={e=>setTarget(Number(e.target.value))} style={{width:60,margin:10}}/></label>
  <button type="button" disabled={busy||!Number.isInteger(target)||target<1||target>5} onClick={search}>{busy?"Hledám v katalogu…":"Sestavit skutečné kandidáty"}</button>
  {error&&<p role="alert">Chyba: {error}</p>}
  {run&&<div aria-live="polite"><h3>Výsledek {run.selected.length} / {run.target}</h3>
   <p>Prohlédnuto {run.searched} bibliografických záznamů. {run.missing?"Nedostatek výsledků: "+run.missing+". ":""}{run.boundedBy??""}</p>
   {run.errors.length>0&&<p>Upozornění: {run.errors.join(", ")}</p>}
   {run.selected.map(t=><article key={t.workKey} style={{padding:12,borderBottom:"1px solid #bbb"}}>
    <label><input type="checkbox" checked={chosen.includes(t.workKey)} onChange={e=>setChosen(old=>e.target.checked?[...old,t.workKey]:old.filter(k=>k!==t.workKey))}/> <strong>{t.title}</strong> — {t.author}</label>
    <div>Forma: {t.genre}; autor {t.authorBorn??"?"}–{t.authorDied??"?"}; vydáno: {t.firstPublished??"?"}</div>
    <a href={t.sourceUrl} target="_blank" rel="noreferrer">Zdroj v Open Library</a>
   </article>)}
   {run.selected.length>0&&<button type="button" disabled={chosen.length===0} onClick={approve}>Potvrdit do testovací kandidátní fronty ({chosen.length})</button>}
   <p style={{fontSize:13}}>{run.warning}</p>
   <details><summary>Audit ({run.decisions.length})</summary>{run.decisions.map((d,i)=><div key={i}>{d.item.title}: {d.outcome} ({d.reason})</div>)}</details>
  </div>}
  <h3>Testovací kandidátní fronta ({accepted.length})</h3>
  <p>Uchována pouze v otevřené stránce; při obnovení zmizí. Není skutečnou databázovou frontou.</p>
  {accepted.map(t=><p key={t.workKey}>{t.title} — {t.author}</p>)}
 </section>;
}
