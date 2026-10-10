"use client"

import { useState } from "react"
import { evaluateRightsScan, type RightsScanDossier } from "@/lib/rightsScanDossier"

const hash = "a".repeat(64)
const date = "2026-10-10T08:00:00Z"
const base: RightsScanDossier = {
  format:"artales-rights-dossier-v1",candidateId:"synthetic-candidate",sourceId:"synthetic-source",
  editionId:"synthetic-edition",snapshotSetId:"synthetic-capture-v1",targetJurisdiction:"EU_CZ",
  policyVersion:"prototype-v1",scanner:{engine:"fixture-not-real-ai",version:"1",ranAt:date},
  capture:{rawSourceSha256:hash,rawSourceByteLength:1200,rawSourceArchiveRef:"fixture/raw-source",
    capturedAt:"2026-10-10T07:30:00Z",inventoryComplete:true,collectorVersion:"fixture-1"},
  snapshots:[
    {id:"original",kind:"WORK_CONTENT",sourceId:"synthetic-source",editionId:"synthetic-edition",sha256:hash,byteLength:800,capturedAt:date,archiveRef:"fixture/original"},
    {id:"edition",kind:"EDITION_CONTENT",sourceId:"synthetic-source",editionId:"synthetic-edition",sha256:hash,byteLength:100,capturedAt:date,archiveRef:"fixture/edition"},
    {id:"wrapper",kind:"SOURCE_WRAPPER",sourceId:"synthetic-source",editionId:"synthetic-edition",sha256:hash,byteLength:90,capturedAt:date,archiveRef:"fixture/wrapper"},
    {id:"images",kind:"ASSET",sourceId:"synthetic-source",editionId:"synthetic-edition",sha256:hash,byteLength:210,capturedAt:date,archiveRef:"fixture/images"}
  ],
  evidence:[{id:"evidence-text",type:"primary_record",sourceId:"synthetic-source",
    editionId:"synthetic-edition",componentIds:["original"],sourceUri:"https://example.invalid/synthetic-rights",
    archiveRef:"fixture/evidence",sha256:hash,capturedAt:date,jurisdiction:"EU_CZ",
    claim:"Synthetic demonstration of a separately sourced and indexed rights statement."}],
  decisions:[
    {componentId:"original",action:"include",finding:"supported",confidence:"high",
      evidenceIds:["evidence-text"],rationale:"Synthetic supporting source record was found for the literary text."},
    {componentId:"edition",action:"exclude",finding:"unknown",confidence:"low",
      evidenceIds:[],rationale:"Editorial edition-specific additions excluded from this composition.",exclusionMethod:"omit_from_ingest"},
    {componentId:"wrapper",action:"exclude",finding:"unknown",confidence:"low",
      evidenceIds:[],rationale:"Project Gutenberg source wrapper is not part of the literary text.",exclusionMethod:"omit_from_ingest"},
    {componentId:"images",action:"exclude",finding:"unknown",confidence:"low",
      evidenceIds:[],rationale:"Third-party illustrations excluded until separately licensed.",exclusionMethod:"omit_from_ingest"}
  ]
}

const scenarios = [
  {id:"eligible",title:"Text bez cizích doplňků"},
  {id:"illustrations",title:"Chci přidat ilustrace"},
  {id:"dispute",title:"Napadené právo k textu"},
  {id:"incomplete",title:"Neúplný snapshot"}
] as const
type Scenario = (typeof scenarios)[number]["id"]

export default function RightsScanLab() {
  const [selected,setSelected] = useState<Scenario>("eligible")
  const [challenged,setChallenged] = useState(false)
  const dossier: RightsScanDossier = {
    ...base,
    capture: selected==="incomplete" ? {...base.capture,inventoryComplete:false} : base.capture,
    decisions:base.decisions.map(d =>
      d.componentId==="images"&&selected==="illustrations" ?
      {...d,action:"include",finding:"unknown",confidence:"low",exclusionMethod:undefined} :
      d.componentId==="original"&&(selected==="dispute"||challenged) ?
      {...d,disputeFlag:true} : d)
  }
  const result=evaluateRightsScan(dossier)
  const labels:Record<string,string>={
    invalid_dossier:"Chybná identita právního spisu",missing_text:"Chybí schválený původní text",
    missing_edition_assessment:"Chybí samostatné posouzení edice",
    missing_decision:"Komponenta nemá rozhodnutí",source_capture_incomplete:"Není potvrzena úplnost zachycené verze",
    review_requested:"Rozhodnutí je napadeno – vyžaduje přezkum",
    high_risk_inclusion:"Ilustrace či překlad vyžadují samostatné doložení práv",
    insufficient_evidence:"Nedostatečné právní podklady",unverified_exclusion:"Není doloženo vyloučení komponenty"
  }
  function downloadManifest() {
    const manifest={notice:"DEMONSTRACE – NEOVĚŘENÝ PRÁVNÍ SPIS. Nepotvrzuje práva ani povolení k publikaci.",
      generatedAt:"fixture-2026-10-10",dossier,evaluation:result}
    const blob=new Blob([JSON.stringify(manifest,null,2)],{type:"application/json"})
    const url=URL.createObjectURL(blob)
    const a=document.createElement("a");a.href=url;a.download="artales-pravni-spis-DEMO.json";a.click()
    URL.revokeObjectURL(url)
  }
  const card:React.CSSProperties={border:"1px solid #d7c8b2",borderRadius:10,padding:18}
  return <main style={{maxWidth:1080,margin:"auto",padding:"36px 22px 70px"}}>
    <p style={{fontSize:12,letterSpacing:".1em",opacity:.7}}>ARTales · ukázkový strojový právní sken</p>
    <h1 style={{fontSize:36,margin:"12px 0"}}>Právní spis konkrétní edice</h1>
    <p>Modelový sken oddělených komponent vydání. Důkazy, odkazy i otisky jsou pouze syntetické; stránka neprovádí AI rešerši, nic neukládá ani neposkytuje právní souhlas.</p>
    <div style={{...card,background:"#fff4de",color:"#342818",marginBottom:20}}>
      <strong>DEMO — bez skutečného právního ověření.</strong> Úspěšný výsledek znamená pouze splnění pravidel testovacího manifestu. Publikace je vždy zakázaná.
    </div>
    <div style={{display:"flex",gap:9,flexWrap:"wrap",marginBottom:20}}>
      {scenarios.map(s=><button type="button" key={s.id} aria-pressed={selected===s.id}
        onClick={()=>{setSelected(s.id);setChallenged(false)}}
        style={{...card,cursor:"pointer",padding:12,background:selected===s.id?"#ecdfca":"transparent",color:"inherit"}}>{s.title}</button>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:18}}>
      <section style={card}>
        <h2>Komponenty a rozhodnutí</h2>
        {dossier.snapshots.map(snapshot=>{
          const decision=dossier.decisions.find(d=>d.componentId===snapshot.id)
          return <div key={snapshot.id} style={{borderBottom:"1px solid #ddd",padding:"9px 0"}}>
            <strong>{snapshot.kind}</strong> · {snapshot.id}<p style={{fontSize:13,margin:"4px 0"}}>
            {decision?.action==="include"?"Navrženo zahrnout":decision?.action==="exclude"?"Vyřadit":"Pozastavit"} · {snapshot.byteLength} bajtů</p>
            <small>SHA-256: {snapshot.sha256.slice(0,16)}…</small>
          </div>
        })}
      </section>
      <section style={card}>
        <h2>Výsledek pravidel</h2>
        <p style={{fontSize:18,fontWeight:650}}>
          {result.outcome==="candidate_draft_eligible"?"Modelově připraven ke konceptu":
            result.outcome==="source_blocked"?"Zdroj blokován":"Vyžaduje další kontrolu"}
        </p>
        <p>Navržené součásti: {result.includedSnapshotIds.length} · vyloučené: {result.excludedSnapshotIds.length}</p>
        <p><strong>Publikace:</strong> nikdy tímto skenem</p>
        {result.issues.length>0?<ul>{result.issues.map((i,n)=><li key={n}>{labels[i.code]??i.code}{i.componentId?" ("+i.componentId+")":""}</li>)}</ul>:
          <p>V modelovém manifestu nebyla nalezena strukturální překážka. Skutečné právo k použití musí být teprve prokázáno z archivovaných podkladů.</p>}
        <button type="button" onClick={()=>setChallenged(true)} style={{padding:"10px 15px",marginRight:8}}>
          Napadnout rozhodnutí
        </button>
        <button type="button" onClick={downloadManifest} style={{padding:"10px 15px"}}>
          Stáhnout DEMO manifest (.json)
        </button>
        <p style={{fontSize:12,marginTop:15,opacity:.8}}>Výzva se projeví pouze na této stránce. Export je vzorek struktury spisu, ne úplný archiv snapshotů.</p>
      </section>
    </div>
  </main>
}
