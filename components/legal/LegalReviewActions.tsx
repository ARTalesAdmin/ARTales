"use client";
import {useState} from "react";
import type {LegalReviewRun} from "@/lib/legal/reviewHistory";
import {LEGAL_IMAGE_APPROVAL_ENABLED} from "@/lib/legal/featureFlag";
type Decision="approved"|"needs_evidence"|"deferred"|"rejected";
export function LegalReviewActions({candidateId,checks,locked}:{candidateId:string;checks:LegalReviewRun[];locked:boolean}){
 const [chosen,setChosen]=useState(String(checks[0]?.decisionNo??""));
 const [intent,setIntent]=useState<Decision|null>(null);
 const [reason,setReason]=useState("");
 const [includeImages,setIncludeImages]=useState(false);
 const [busy,setBusy]=useState(false);
 const [submitError,setSubmitError]=useState("");
 const selected=checks.find(c=>String(c.decisionNo)===chosen);
 const options:{value:Decision;label:string;disabled?:boolean}[]=[
  {value:"rejected",label:"NE"},
  {value:"approved",label:"ANO bez ilustrací"},
  {value:"approved",label:"ANO s ilustracemi",disabled:!LEGAL_IMAGE_APPROVAL_ENABLED}
 ];
 const imageConflict=!!selected&&intent==="approved"&&includeImages&&
  (!LEGAL_IMAGE_APPROVAL_ENABLED||selected.outcome!=="yes_with_illustrations");
 const blockers=selected?.approvalBlockers??[];
 const blockingMessage= !selected?"Nejprve vyber automatickou kontrolu.":
  blockers.length&&intent==="approved"?"K právnímu schválení chybí: "+blockers.join(", ")+".":
  imageConflict?"Veřejné vydávání převzatých ilustrací zatím není v ARTales podporováno. Použij ANO bez ilustrací. Archiv originálního EPUBu včetně obrázků zůstává soukromý.":
  selected.outcome==="no"&&intent==="approved"?"Automatická kontrola neschválila použití textu. Je nutné doplnit a přezkoumat právní podklady.":"";
 const canConfirm=!!selected&&!!intent&&!busy&&!blockingMessage;
 async function submit(){
  if(!canConfirm||!selected||!intent)return;
  setBusy(true);setSubmitError("");
  try{
   const form=new FormData();
   form.set("source_id",selected.sourceId);
   form.set("decision_no",chosen);
   form.set("verdict",intent);
   form.set("include_illustrations",String(includeImages));
   form.set("rationale",`Redakční rozhodnutí k automatickému právnímu checku #${chosen}: ${intent==="approved"?(includeImages?"ANO s ilustracemi":"ANO bez ilustrací"):"NE"}. ${reason.trim()||"Zjištěné osoby, datace a zdroje zůstávají součástí dohledatelného auditu."}`);
   const res=await fetch(`/member/legal/${candidateId}/decision`,{method:"POST",body:form});
   if(res.ok){window.location.assign(`/member/legal/${candidateId}?ok=1`);return}
   const payload=await res.json().catch(()=>({}));
   const messages:Record<string,string>={
    stale_run:"Mezitím přibyla nová automatická kontrola. Obnov stránku a vyber poslední výsledek.",
    missing_evidence:"Rozhodnutí nebylo uloženo: právní podklady neumožňují zvolenou variantu. U ilustrací je nutné doložit oprávnění pro dané vydání.",
    already_locked:"Zdroj už je uzamčený. Obnov stránku a pokračuj ke snapshotu.",
    cannot_save_decision:"Databáze rozhodnutí nepřijala. Zkontroluj právní podklady a zkus to znovu.",
    invalid_run:"Vybraná kontrola již není platná. Obnov stránku.",
    invalid:"Rozhodnutí obsahuje neplatné nebo neúplné údaje."
   };
   setSubmitError(messages[String(payload.error)]??"Rozhodnutí nebylo uloženo. Záznam v historii nevznikl.");
  }catch{setSubmitError("Spojení selhalo. Rozhodnutí nebylo potvrzeno; ověř historii před dalším pokusem.")}
  finally{setBusy(false)}
 }
 if(locked)return null;
 if(!checks.length)return <section className="ca-card"><h2>Rozhodnutí</h2><p>Nejprve spusť automatický právní check.</p></section>;
 return <section className="ca-card"><h2>Rozhodnutí a návaznost</h2>
  <label>Posouzení <select value={chosen} onChange={e=>{setChosen(e.target.value);setIntent(null);setReason("");setSubmitError("")}}>
   {checks.map(c=><option key={c.decisionNo} value={c.decisionNo}>Kontrola #{c.decisionNo} · {new Date(c.recordedAt).toLocaleString("cs-CZ")} · {c.edition}</option>)}
  </select></label>
  {selected?<p className="ca-hint">{selected.summary} · Automatické posouzení: {selected.outcome==="no"?"Text není způsobilý":selected.outcome==="yes_with_illustrations"?"Text způsobilý, ilustrace vyžadují samostatnou publikační cestu":"Text způsobilý bez veřejného použití ilustrací"}</p>:null}
  <p className="ca-hint">Při schválení bez ilustrací se originální EPUB včetně obrázků archivuje soukromě. Obrázky se jen nepoužijí ve veřejném vydání.</p>
  <div className="ca-actions">{options.map((o,i)=><button key={i} type="button" disabled={o.disabled} aria-disabled={o.disabled||undefined} title={o.disabled?"Zatím nedostupné: schválení obrázků pro veřejné vydání nemá dokončenou publikační cestu.":undefined} className={intent===o.value&&(o.value!=="approved"||includeImages===(i===2))?"ca-btn ca-primary":"ca-btn ca-secondary"} onClick={()=>{if(o.disabled)return;setIntent(o.value);setIncludeImages(i===2);setSubmitError("")}}>{o.label}{o.disabled?" · zatím nedostupné":""}</button>)}</div>
  {intent?<div className="ca-form">
    {blockingMessage?<p role="alert" className="ca-error">{blockingMessage}</p>:null}
    {submitError?<p role="alert" className="ca-error">{submitError}</p>:null}
    <label>Poznámka (nepovinná)<textarea value={reason} onChange={e=>setReason(e.target.value)} rows={2} maxLength={1000} placeholder="Případná doplňující poznámka"/></label><p>Rozhodnutí, autor, datum a zdroje budou uloženy do auditu.</p>
    <div className="ca-actions"><button type="button" className="ca-btn ca-primary" disabled={!canConfirm} onClick={submit}>{busy?"Ukládám…":"Potvrdit rozhodnutí"}</button><button type="button" className="ca-btn ca-secondary" onClick={()=>{setIntent(null);setSubmitError("")}}>Zpět</button></div>
    {!canConfirm&&!busy&&blockingMessage?<p className="ca-hint">Tlačítko je zablokované z uvedeného důvodu. Žádné rozhodnutí se neukládá.</p>:null}
   </div>:null}
 </section>;
}
