"use client";
import {useEffect,useState,useTransition} from "react";
import {enqueueGeneralSemanticQaJob,readSemanticAiQaJob,type QaJobStatus}
 from "@/app/member/semantic/[candidateId]/ai-job-actions";

/** Separate task dialog: discovery only, never free-form mutation of the literary source. */
export default function GeneralQaDialog(p:{
 candidateId:string;revisionSha:string;exampleAtomId:string|null;
 exampleText:string|null;onClose:()=>void;onFindAtom:(id:string)=>void;
}){
 const [instruction,setInstruction]=useState("");
 const [includeExample,setIncludeExample]=useState(Boolean(p.exampleAtomId));
 const [job,setJob]=useState<QaJobStatus|null>(null);
 const [message,setMessage]=useState("");
 const [pending,startTransition]=useTransition();
 useEffect(()=>{
  if(!job?.jobId||!["queued","running"].includes(job.status))return;
  let active=true;
  const interval=setInterval(()=>{
   void readSemanticAiQaJob({jobId:job.jobId!}).then(result=>{
    if(!active||!result.ok)return;
    setJob(result);
    setMessage(result.message);
   }).catch(()=>{if(active)setMessage("Ověření stavu se nepodařilo. Úloha zůstává uložená.");});
  },4000);
  return()=>{active=false;clearInterval(interval);};
 },[job?.jobId,job?.status]);
 const send=()=>{
  if(pending||instruction.trim().length<20)return;
  startTransition(async()=>{
   try{
    const result=await enqueueGeneralSemanticQaJob({
     candidateId:p.candidateId,revisionSha:p.revisionSha,
     instruction:instruction.trim(),
     exampleAtomId:includeExample?p.exampleAtomId:null
    });
    setJob(result.ok?result:null);
    setMessage(result.message);
   }catch{
    setMessage("Odeslání se nepodařilo. Před opakováním zkontroluj stav AI fronty.");
   }
  });
 };
 const matches=[...new Set((job?.suggestions??[]).flatMap(s=>s.targetAtomIds??[]))];
 const done=job?.status==="completed";
 return <div className="semantic-reader__dialog-backdrop" role="presentation"
  onMouseDown={e=>{if(e.target===e.currentTarget)p.onClose();}}>
  <section role="dialog" aria-modal="true" aria-label="Obecná oprava díla"
   className="semantic-reader__dialog">
   <header className="semantic-reader__dialog-title"><h2>Obecná oprava díla</h2>
    <button type="button" onClick={p.onClose} aria-label="Zavřít obecnou opravu">×</button>
   </header>
   <p>Popiš opakovaný problém. AI vyhledá související bloky a navrhne řešení.
    Nález nebude znamenat automatickou změnu literárního textu.</p>
   <label>Co je třeba opravit napříč dílem?
    <textarea rows={5} maxLength={550} value={instruction}
     onChange={e=>setInstruction(e.target.value)}
     placeholder="Například: Vyhledej podobné nevhodné zlomy věty a označ bloky, které vyžadují úpravu sazby."/>
   </label>
   {p.exampleAtomId?<label className="semantic-reader__dialog-example">
    <input type="checkbox" checked={includeExample} onChange={e=>setIncludeExample(e.target.checked)}/>
    Použít právě vybraný blok jako příklad
    <small>{p.exampleText?.slice(0,180)}</small>
   </label>:<p>Ukázkový blok není nutný. Pro přesnější zadání můžeš nejdřív označit jeden příklad v textu.</p>}
   <p className="semantic-reader__dialog-budget">
    <strong>Rozšířený AI rozpočet:</strong> max. 4 800 výstupních tokenů,
    nejvýše 1 200 prověřovaných bloků a 24 návrhů cílů.
    Výstupy i případné opakované pokusy se evidují ve Spotřebě AI.
    Jde o tokenové meze, nikoli garantovaný finanční strop.
   </p>
   <button type="button" onClick={send}
    disabled={pending||instruction.trim().length<20||job?.status==="queued"||job?.status==="running"}>
    {pending?"Odesílám…":"Vyhledat podobné problémy pomocí AI"}
   </button>
   <p role="status" aria-live="polite">{message}</p>
   {done&&<div className="semantic-reader__dialog-results">
    <h3>Výsledky k posouzení ({matches.length} bloků)</h3>
    {job.suggestions.filter(s=>s.targetAtomIds?.length).map(s=><div key={s.flagId}>
     <p>{s.rationale}</p>
     <div className="semantic-reader__dialog-targets">
      {s.targetAtomIds.map(id=><button type="button" key={id}
       onClick={()=>{p.onFindAtom(id);p.onClose();}}>Najít blok {id.slice(-7)}</button>)}
     </div>
    </div>)}
    {!matches.length&&<p>AI nenavrhla konkrétní další bloky. Obecný nález zůstává k redakčnímu posouzení.</p>}
    <p>Hromadné změny textu nejsou automaticky povolené.
     Bezpečné typografické ochrany může editor ověřit v díle;
     ostatní návrhy se posuzují po jednotlivých blocích.</p>
   </div>}
  </section>
 </div>;
}
