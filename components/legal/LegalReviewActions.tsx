"use client";
import {useState} from "react";
import type {LegalReviewRun} from "@/lib/legal/reviewHistory";
type Decision="approved"|"needs_evidence"|"deferred"|"rejected";
export function LegalReviewActions({candidateId,checks,locked}:{candidateId:string;checks:LegalReviewRun[];locked:boolean}){
 const [chosen,setChosen]=useState(String(checks[0]?.decisionNo??""));
 const [intent,setIntent]=useState<Decision|null>(null);
 const [reason,setReason]=useState("");
 const [busy,setBusy]=useState(false);
 const selected=checks.find(c=>String(c.decisionNo)===chosen);
 const options:{value:Decision;label:string}[]=[{value:"approved",label:"Schválit"},{value:"needs_evidence",label:"Dořešit"},{value:"deferred",label:"Odložit"},{value:"rejected",label:"Vyřadit"}];
 const requiresReason=intent!==null&&intent!=="approved";
 const canConfirm=!!selected&&!!intent&&!busy&&(!requiresReason||reason.trim().length>=15)&&!(intent==="approved"&&selected.approvalBlockers.length>0);
 async function submit(){
  if(!canConfirm||!selected||!intent)return;
  setBusy(true);
  try{
   const form=new FormData();
   form.set("source_id",selected.sourceId);
   form.set("decision_no",chosen);
   form.set("verdict",intent);
   form.set("rationale",intent==="approved"?`Editor potvrzuje právní prověření konkrétní edice na základě kontroly #${chosen} a doložených zdrojových podkladů.`:reason.trim());
   const res=await fetch(`/member/legal/${candidateId}/decision`,{method:"POST",body:form});
   if(res.ok){window.location.assign(`/member/legal/${candidateId}?ok=1`);return}
   const payload=await res.json().catch(()=>({}));
   window.alert(payload.error==="stale_run"?"Mezitím přibyla nová kontrola. Obnov stránku.":"Rozhodnutí nelze uložit. Zkontroluj podklady a zkus to znovu.");
  }catch{window.alert("Nepodařilo se uložit rozhodnutí.")}
  finally{setBusy(false)}
 }
 if(locked)return null;
 if(!checks.length)return <section className="ca-card"><h2>Rozhodnutí</h2><p>Nejprve spusť automatický právní check.</p></section>;
 return <section className="ca-card"><h2>Rozhodnutí a návaznost</h2>
  <label>Posouzení <select value={chosen} onChange={e=>{setChosen(e.target.value);setIntent(null);setReason("")}}>
   {checks.map(c=><option key={c.decisionNo} value={c.decisionNo}>Kontrola #{c.decisionNo} · {new Date(c.recordedAt).toLocaleString("cs-CZ")} · {c.edition}</option>)}
  </select></label>
  {selected?<p className="ca-hint">{selected.summary}</p>:null}
  <div className="ca-actions">{options.map(o=><button key={o.value} type="button" className={intent===o.value?"ca-btn ca-primary":"ca-btn ca-secondary"} onClick={()=>setIntent(o.value)}>{o.label}</button>)}</div>
  {intent?<div className="ca-form">
    {intent==="approved"&&selected?.approvalBlockers.length?<p role="alert" className="ca-error">Schválení zatím blokují nedoložené údaje: {selected.approvalBlockers.join(", ")}. Tato kontrola nemůže být schválena pouhým kliknutím.</p>:null}
    {requiresReason?<label>Důvod rozhodnutí<textarea value={reason} onChange={e=>setReason(e.target.value)} rows={2} maxLength={5000} placeholder="Stručné odůvodnění (alespoň 15 znaků)" required/></label>:<p>Potvrzením stvrzuješ prověření podkladů ke konkrétnímu zdroji.</p>}
    <div className="ca-actions"><button type="button" className="ca-btn ca-primary" disabled={!canConfirm} onClick={submit}>{busy?"Ukládám…":"Potvrdit rozhodnutí"}</button><button type="button" className="ca-btn ca-secondary" onClick={()=>setIntent(null)}>Zpět</button></div>
   </div>:null}
 </section>;
}
