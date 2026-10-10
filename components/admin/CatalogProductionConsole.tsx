"use client"

import { useState } from "react"
import {
  runSyntheticCatalogBatch, type DemoCatalogBatch,
} from "@/lib/fixtures/catalogBatch"

const money = (value:number) => new Intl.NumberFormat("cs-CZ", {
  style:"currency",currency:"USD",maximumFractionDigits:2,
}).format(value)

const genres: Record<string,string> = {
  prose:"Próza",poetry:"Poezie",drama:"Drama",
  fairy_tale:"Pohádky",essay:"Eseje",other:"Ostatní"
}
const reason: Record<string,string> = {
  not_viable_in_prescreen:"Neperspektivní při levném předběžném skenu",
  prescreen_inconclusive:"Chybějí podklady pro předběžné rozhodnutí",
  prescreen_budget_limit:"Dosažen rozpočet předběžného skenu",
  passed_prescreen:"Prošel předběžným skenem",
  author_diversity_limit:"Omezení počtu titulů od jednoho autora",
  full_scan_budget_limit:"Vyčerpán rozpočet právních skenů",
  full_scan_requested_result_pending:"Právní sken čeká na výsledek",
  rights_or_commercial_use_blocked:"Právní podmínky dané edice nevyhovují",
  commercial_clearance_unproven_or_outdated:"Práva nebo komerční využití nejsou ověřena",
  editorial_budget_limit:"Nedostatek rezervy na redakční práci",
  commercially_plausible_draft_no_publication:"Modelově připraveno pro redakci, nikoliv publikaci",
}
const actions:Record<string,string> = {
  skip:"Přeskočeno",escalate:"K došetření",reviewed:"Předběžně posouzeno",
  accepted_for_editorial:"Do redakční fronty",deferred:"Odloženo",
}
const card:React.CSSProperties={
  background:"var(--artales-paper, #fffdf8)",border:"1px solid #d6c8b4",
  borderRadius:12,padding:20,
}
const label:React.CSSProperties={fontSize:12,fontWeight:700,letterSpacing:".05em",opacity:.7}
const button:React.CSSProperties={
  display:"inline-block",padding:"11px 17px",borderRadius:8,border:"1px solid #83705b",
  background:"#362a22",color:"white",fontWeight:700,cursor:"pointer",
}
const subtle:React.CSSProperties={fontSize:13,opacity:.75}
const outcomeName:Record<string,string>={
  target_reached:"Cílový počet dosažen (modelově)",
  pool_exhausted:"Dostupný seznam nestačí",
  screening_budget:"Rozpočet skenu vyčerpán",
  editorial_budget:"Redakční rozpočet vyčerpán",
}

export default function CatalogProductionConsole(){
  const [target,setTarget]=useState("5")
  const [budget,setBudget]=useState("30")
  const [result,setResult]=useState<DemoCatalogBatch|null>(null)
  const [error,setError]=useState<string|null>(null)
  const [ran,setRan]=useState(false)

  function run(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault()
    const count=Number(target),usd=Number(budget)
    if(!Number.isInteger(count)||count<1||count>12||!Number.isFinite(usd)||usd<1||usd>2000){
      setError("Zadej 1–12 titulů a testovací rozpočet 1–2 000 USD.")
      return
    }
    try{
      const date=new Date()
      const batch=runSyntheticCatalogBatch(count,usd,date.toISOString().slice(0,10),date.toISOString())
      setResult(batch);setError(null);setRan(true)
    }catch{
      setError("Testovací dávku se nepodařilo spočítat.")
    }
  }
  function download(){
    if(!result)return
    const report={
      warning:"SYNTHETICKÁ UKÁZKA — žádné skutečné právní ověření, vytvořené dílo ani vydaná platba.",
      scope:"editorial_demo",runAt:result.runAt,requestedBudgetUsd:result.costLimitUsd,
      candidates:result.candidates,plan:result.plan,cohortSizes:result.cohortSizes,
    }
    const blob=new Blob([JSON.stringify(report,null,2)],{type:"application/json"})
    const url=URL.createObjectURL(blob)
    const a=document.createElement("a")
    a.href=url;a.download="ARTales-testovaci-katalogova-davka.json";a.click()
    URL.revokeObjectURL(url)
  }
  const p=result?.plan
  const issueCount=p?.decisions.filter(d=>d.action==="escalate").length??0
  const missed=p?Math.max(0,p.requested-p.qualified.length):0
  return <main style={{maxWidth:1150,padding:"38px 22px 80px",margin:"auto",lineHeight:1.6}}>
    <p style={{fontSize:12,letterSpacing:".11em",textTransform:"uppercase",opacity:.7}}>
      ARTales · Administrace · Katalog
    </p>
    <h1 style={{fontFamily:"Georgia,serif",fontSize:"clamp(30px,4vw,43px)",lineHeight:1.17,margin:"10px 0"}}>
      Dávka titulů
    </h1>
    <p style={{maxWidth:790}}>Zadej cíl a rozpočet. Ukázka projde seznam kandidátů, předběžně je posoudí, použije modelový právní spis a vybere tituly pro redakční zpracování.</p>
    <aside style={{...card,background:"#fff1d8",color:"#33271c",marginBottom:20}}>
      <strong>TESTOVACÍ REŽIM — žádné reálné AI, práva ani databázové zápisy.</strong>
      <p style={{margin:"6px 0 0",fontSize:14}}>Spuštění pracuje pouze s fiktivními tituly v prohlížeči. Nezakládá kandidáty v Supabase, neúčtuje rozpočet, neposílá redakční úkoly a nikdy nic nepublikuje. Toto je funkční simulace orchestrátoru před napojením na skutečné zdroje.</p>
    </aside>

    <form onSubmit={run} style={{...card,marginBottom:20}}>
      <div style={{display:"flex",alignItems:"flex-end",flexWrap:"wrap",gap:18}}>
        <label style={{display:"grid",gap:7,flex:"1 1 180px"}}>
          <span style={label}>Počet titulů pro redakci</span>
          <input type="number" min="1" max="12" step="1" value={target}
            onChange={e=>setTarget(e.target.value)} required
            style={{padding:"11px 12px",border:"1px solid #b9aa95",borderRadius:7,fontSize:16}}/>
        </label>
        <label style={{display:"grid",gap:7,flex:"1 1 180px"}}>
          <span style={label}>Celkový zkušební rozpočet (USD)</span>
          <input type="number" min="1" max="2000" step=".01" value={budget}
            onChange={e=>setBudget(e.target.value)} required
            style={{padding:"11px 12px",border:"1px solid #b9aa95",borderRadius:7,fontSize:16}}/>
        </label>
        <button type="submit" style={button}>Spustit testovací dávku</button>
      </div>
      {error?<p role="alert" style={{color:"#9c2a23"}}>{error}</p>:null}
      <p style={{...subtle,margin:"12px 0 0"}}>
        Zkušební politika: 10 % na předvýběr, 25 % na skeny, 65 % rezerva pro redakci;
        nejvýše jeden titul od autora a preference různých žánrů. Částky jsou fiktivní.
      </p>
    </form>

    {!ran||!p||!result?<section style={{...card,textAlign:"center",padding:32}}>
      <h2 style={{marginTop:0}}>Dávka ještě nebyla spuštěna</h2>
      <p>Po spuštění uvidíš kandidáty, důvody rozhodnutí, kvalifikované tituly, rozpočtový přehled a návrh doplnění seznamu.</p>
    </section>:<>
      <section style={{...card,marginBottom:20}} aria-label="Výsledek dávky">
        <div style={{display:"flex",flexWrap:"wrap",alignItems:"baseline",justifyContent:"space-between",gap:12}}>
          <div>
            <p style={label}>VÝSLEDEK BĚHU · SYNTHETICKÉ ÚDAJE</p>
            <h2 style={{margin:"3px 0 8px"}}>{outcomeName[p.stopReason]}</h2>
          </div>
          <button type="button" onClick={download} style={{...button,background:"transparent",color:"inherit"}}>
            Stáhnout testovací zprávu JSON
          </button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:14}}>
          <Metric title="K redakci (model)" value={p.qualified.length+" / "+p.requested}/>
          <Metric title="Prověřených kandidátů" value={result.candidates.length.toString()}/>
          <Metric title="Případy k došetření" value={String(issueCount)}/>
          <Metric title="Modelové skeny" value={money(p.fullScanSpentUsd)}/>
          <Metric title="Redakční rezerva" value={money(p.editorialReservedUsd)}/>
        </div>
        <p style={{...subtle,marginBottom:0}}>
          Předvýběr: {money(p.prescreenSpentUsd)} · skeny: {money(p.fullScanSpentUsd)} ·
          rezervováno pro redakci: {money(p.editorialReservedUsd)} ·
          limit: {money(result.costLimitUsd)}.
          Vše bez skutečného utracení peněz.
        </p>
        {missed>0?<p style={{fontWeight:650,marginBottom:0}}>
          Zbývá naplnit {missed} {missed===1?"titul":"titulů"}.
          {p.refillRequested?" Politika doporučuje doplnit seznam kandidátů.":" Aktuální rozpočet/politika další sken nepovoluje."}
        </p>:null}
      </section>
      <section style={{marginBottom:22}}>
        <h2>Navrženo redakci ({p.qualified.length})</h2>
        {p.qualified.length===0?<div style={card}>Žádný kandidát neprošel všemi modelovými podmínkami a rozpočtem.</div>:
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(275px,1fr))",gap:12}}>
            {p.qualified.map(q=><article key={q.candidateId} style={card}>
              <p style={label}>NAVRŽENÝ KONCEPT · {genres[q.genre]}</p>
              <h3 style={{fontSize:21,margin:"3px 0 0"}}>{q.title}</h3>
              <p style={subtle}>{q.author}</p>
              <p style={{fontSize:14,marginBottom:4}}><strong>Práva v modelu:</strong> text ano, ilustrace ne, překlad ne</p>
              <p style={{fontSize:14,marginTop:4}}><strong>Doporučení:</strong> {q.recommendationReason}</p>
              <p style={subtle}>Přiřazení: {q.assignment==="shared_inbox"?"Společná redakční fronta (návrh)":q.assignment} · rezerva {money(q.estimatedEditorialCostUsd)}</p>
              <p style={{...subtle,marginBottom:0}}>Spis: {q.dossierRef} · Snapshot: {q.sourceSnapshotSetId}</p>
            </article>)}
          </div>}
      </section>
      <section style={{...card,marginBottom:20}}>
        <h2 style={{marginTop:0}}>Výběr kandidátů a chronologie</h2>
        <p style={subtle}>
          Simulace vytvořila {result.cohortSizes.length} {result.cohortSizes.length===1?"kohortu":"kohorty"}:
          {result.cohortSizes.map((c,i)=>" "+(i+1)+".: "+c+" kandidátů").join("; ")}.
          Při rozšíření se stav a rozpočet testovacího seznamu přepočítaly; žádná cena nebyla účtována opakovaně.
        </p>
        <details>
          <summary style={{cursor:"pointer",fontWeight:700}}>Zobrazit jednotlivá rozhodnutí ({p.decisions.length})</summary>
          <div style={{display:"grid",gap:9,paddingTop:13}}>
            {p.decisions.map((d,i)=><div key={d.candidateId+"-"+i} style={{
              display:"grid",gridTemplateColumns:"minmax(160px,2fr) minmax(110px,1fr)",
              gap:8,borderBottom:"1px solid #e4d9c8",paddingBottom:8}}>
              <div><strong>{d.title}</strong><p style={{...subtle,margin:"3px 0"}}>
                {reason[d.reason]??d.reason}
              </p></div>
              <div style={{fontSize:13,textAlign:"right"}}>
                <strong>{actions[d.action]??d.action}</strong>
                <div style={subtle}>{money(d.prescreenCostUsd+d.fullScanCostUsd)} sken</div>
              </div>
            </div>)}
          </div>
        </details>
      </section>
      <section style={{...card,marginBottom:12}}>
        <h2 style={{marginTop:0}}>Předání k redakci</h2>
        <p>{p.qualified.length} modelových titulů je určeno pro společnou frontu. Nejde zatím o skutečné úkoly ani nově vytvořená díla v databázi.</p>
        <button disabled style={{...button,opacity:.4,cursor:"not-allowed"}} type="button">
          Uložit a předat redakci (zatím nepřipojeno)
        </button>
        <p style={{...subtle,marginBottom:0}}>Další integrace: ověřené právo ke komerčnímu využití, auditní DB zápis, idempotentní dávka a role editorů. K publikaci je vyžadována samostatná brána.</p>
      </section>
    </>}
  </main>
}

function Metric({title,value}:{title:string,value:string}){
  return <div style={{padding:"13px 14px",border:"1px solid #e1d4be",borderRadius:9}}>
    <p style={{fontSize:12,opacity:.7,margin:0}}>{title}</p>
    <strong style={{fontSize:23}}>{value}</strong>
  </div>
}
