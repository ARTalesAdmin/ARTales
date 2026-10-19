"use client";
import {useState} from "react";

type Result = {mode:string; target:number; missing:number; stopReason:string;
  portfolio:{published:number;unclassified:number;classificationComplete:boolean};
  selected:Array<{workKey:string;title:string;author:string;genre:string;
    authorBorn:number|null;authorDied:number|null;firstPublished:number|null;sourceUrl:string}>;
  decisions:Array<{item:{title:string;author:string};outcome:string;reason:string}>;
  errors:string[];exploredGenres:string[]};

export default function RealPrescreenConsole({fixture=false}:{fixture?:boolean}) {
  const [target,setTarget]=useState(5);
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<Result|null>(null);
  const [error,setError]=useState("");
  async function start() {
    setBusy(true);setError("");
    try {
      const r=await fetch("/api/member/prescreen",{method:"POST",
        headers:{"content-type":"application/json"},body:JSON.stringify({target})});
      const data=await r.json();
      if(!r.ok) throw Error(data.error??"prescreen_failed");
      setResult(data as Result);
    }catch(e){setError(e instanceof Error?e.message:"unknown_error");}finally{setBusy(false);}
  }
  function exportJson() {
    if(!result)return;
    const uri=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=uri;a.download="artales-prescreen-preview.json";a.click();
    URL.revokeObjectURL(uri);
  }
  return <main style={{maxWidth:1050,margin:"auto",padding:"35px 22px 75px",lineHeight:1.6}}>
    <h1>Sestavit kandidáty — {fixture?"izolovaná fixture":"skutečná bibliografická rešerše"}</h1>
    <p>{fixture?"Fixture nad fiktivními knihami bez přihlášení.":"Řízený výběr podle žánrových vah a skutečných katalogových záznamů."} Zatím pouze náhled:
      nic se neukládá, nevydává ani nepředává právnímu checkeru.</p>
    <aside style={{padding:16,border:"1px solid #a98342",marginBottom:18}}>
      Žánrová klasifikace současné knihovny dosud není ověřená. Váhy jsou prozatím
      pracovní; prescreen je označuje jako nejisté a nevydává je za skutečnou vyváženost.
    </aside>
    <label style={{display:"block",marginBottom:12}}>Požadovaný počet kandidátů (1–12)
      <input type="number" min={1} max={12} value={target} onChange={e=>setTarget(Number(e.target.value))}
        style={{display:"block",padding:9}}/>
    </label>
    <button className="artales-button-primary" type="button" disabled={busy||target<1||target>12||!Number.isInteger(target)} onClick={start}>
      {busy?"Dohledávám zdroje…":"Sestavit kandidáty"}
    </button>
    {error&&<p role="alert">Chyba: {error}</p>}
    {result&&<section style={{marginTop:22}}>{result.mode==="isolated_fixture"&&<p role="status">Fixture: žádné skutečné účty, drafty ani produkční data.</p>}
      <h2>Výsledek: {result.selected.length} / {result.target}</h2>
      <p>Ověření katalogového zdroje ≠ právní oprávnění. K právnímu checkeru lze
        kandidáty předat až po potvrzení a zajištění jejich persistence.</p>
      <p>Existujících publikovaných děl: {result.portfolio.published}.
        Nezařazených do ověřených žánrů: {result.portfolio.unclassified}.</p>
      <p>Průzkum: {result.exploredGenres.join(", ")}. Zbývá: {result.missing}.
        {result.errors.length?" Některé zdroje nebyly dostupné.":""}</p>
      <button className="artales-button-secondary" type="button" onClick={exportJson}>Stáhnout průkazný návrh JSON</button>
      <div style={{display:"grid",gap:12,marginTop:20}}>
        {result.selected.map(c=><article key={c.workKey} style={{border:"1px solid #d6c8b4",padding:16}}>
          <strong>{c.title}</strong> — {c.author} <span>({c.genre})</span>
          <p>Autor: {c.authorBorn??"?"}–{c.authorDied??"?"} · první vydání: {c.firstPublished??"?"}</p>
          <a href={c.sourceUrl} target="_blank" rel="noreferrer">Katalogový záznam</a>
        </article>)}
      </div>
      <details><summary>Audit rozhodnutí ({result.decisions.length})</summary>
        <ul>{result.decisions.map((d,i)=><li key={i}>{d.item.title} — {d.outcome}: {d.reason}</li>)}</ul>
      </details>
    </section>}
  </main>;
}
