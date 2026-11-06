"use client";
import {useEffect,useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {enqueueGeneralSemanticQaJob,adoptGeneralQaTargets,lastGeneralSemanticQaJob,readSemanticAiQaJob,type QaJobStatus}
 from "@/app/member/semantic/[candidateId]/ai-job-actions";

/** Separate task dialog: discovery only, never free-form mutation of the literary source. */
export default function GeneralQaDialog(p:{
 candidateId:string;revisionSha:string;exampleAtomId:string|null;
 exampleText:string|null;onClose:()=>void;onFindAtom:(id:string)=>void;
 getExcerpt:(id:string)=>string;
}){
 const router=useRouter();
 const [instruction,setInstruction]=useState("");
 const [selectedTargets,setSelectedTargets]=useState<string[]>([]);
 const [targetKind,setTargetKind]=useState<"typography"|"structure"|"other">("typography");
 const [includeExample,setIncludeExample]=useState(Boolean(p.exampleAtomId));
 const [job,setJob]=useState<QaJobStatus|null>(null);
 const [message,setMessage]=useState("");
 const [pending,startTransition]=useTransition();
 useEffect(()=>{
  let active=true;
  void lastGeneralSemanticQaJob({candidateId:p.candidateId,revisionSha:p.revisionSha})
   .then(result=>{if(active&&result.ok&&result.jobId){
    setJob(result);setMessage(result.message);
   }}).catch(()=>{});
  return()=>{active=false;};
 },[p.candidateId,p.revisionSha]);
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
    if(result.ok)router.refresh();
   }catch{
    setMessage("Odeslání se nepodařilo. Před opakováním zkontroluj stav AI fronty.");
   }
  });
 };
 const matches=[...new Set((job?.suggestions??[]).flatMap(s=>s.targetAtomIds??[]))];
 const done=job?.status==="completed";
 const adopt=()=>{
  if(!job?.jobId||!selectedTargets.length||pending)return;
  startTransition(async()=>{
   try{
    const result=await adoptGeneralQaTargets({jobId:job.jobId!,targetAtomIds:selectedTargets,kind:targetKind});
    setMessage(result.message);
    if(result.ok)router.refresh();
   }catch{setMessage("Převzetí bloků se nezdařilo; zkontroluj stav nálezů.");}
  });
 };
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
    <h3>Nalezené bloky ({matches.length})</h3>
    <p>Vyber pouze problémy, které chceš řešit. AI ukazuje návrhy,
     nikoli již schválené změny.</p>
    {job?.suggestions?.filter(s=>s.targetAtomIds?.length).map(s=><div key={s.flagId}>
     <p>{s.rationale}</p>
    </div>)}
    {!matches.length?<p>AI nenavrhla další konkrétní bloky.
     Původní zadání zůstává k redakčnímu posouzení.</p>:<>
    <label className="semantic-reader__dialog-selectall">
     <input type="checkbox" checked={selectedTargets.length===matches.length}
      onChange={e=>setSelectedTargets(e.target.checked?matches:[])}/>
     Vybrat všechny navržené bloky
    </label>
    <div className="semantic-reader__dialog-results-list">
     {matches.map(id=><div key={id} className="semantic-reader__dialog-result">
      <label><input type="checkbox" checked={selectedTargets.includes(id)}
       onChange={e=>setSelectedTargets(old=>e.target.checked?[...old,id]:old.filter(x=>x!==id))}/>
       <span>{p.getExcerpt(id).slice(0,150)||"Textový blok"}</span></label>
      <button type="button" onClick={()=>{p.onFindAtom(id);p.onClose();}}>Najít v textu</button>
     </div>)}
    </div>
    <label>Jaký druh problému mají vybrané bloky?
     <select value={targetKind} onChange={e=>setTargetKind(e.target.value as typeof targetKind)}>
      <option value="typography">Sazba a řádky</option>
      <option value="structure">Struktura textu</option>
      <option value="other">Odborné posouzení</option>
     </select>
    </label>
    <button type="button" disabled={pending||!selectedTargets.length} onClick={adopt}>
     Přidat {selectedTargets.length} vybraných bloků do QA
    </button>
    </>}
    <p>Po převzetí můžeš nálezy odeslat k opravě běžnou AI dávkou.
     Úpravy obsahu se samy neprovedou ani nepublikují.</p>
   </div>}
  </section>
 </div>;
}
