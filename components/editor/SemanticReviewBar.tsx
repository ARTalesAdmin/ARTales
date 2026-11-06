"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import type {SemanticReviewIssue} from "@/lib/semantic/model";
import {decideSemanticChange,finishSemanticQaReview}
 from "@/app/member/semantic/[candidateId]/qa-actions";

type Decision={issue_id:string;decision:string;note:string|null;reviewed_at:string};
type Props={
 candidateId:string;revisionSha:string;taskId:string|null;
 issues:SemanticReviewIssue[];decisions:Decision[];
 openFindings:number;aiJobPending:boolean;databaseReady:boolean;
 onFind:(atomId:string)=>void;onClose:()=>void;onFinished:()=>void;
};

/** Source-anchored, one-at-a-time review; no metadata or literary text mutation. */
export default function SemanticReviewBar(p:Props){
 const router=useRouter();
 const [index,setIndex]=useState(0);
 const [returnOpen,setReturnOpen]=useState(false);
 const [returnNote,setReturnNote]=useState("");
 const [feedback,setFeedback]=useState("");
 const [pending,startTransition]=useTransition();
 const decisions=new Map(p.decisions.map(d=>[d.issue_id,d]));
 const unreviewed=p.issues.filter(i=>!decisions.has(i.id));
 const accepted=p.issues.filter(i=>decisions.get(i.id)?.decision==="accepted");
 const returned=p.issues.filter(i=>decisions.get(i.id)?.decision==="returned");
 const current=unreviewed[Math.min(index,Math.max(0,unreviewed.length-1))]??null;
 const canFinish=p.databaseReady&&Boolean(p.taskId)&&!pending&&
  p.openFindings===0&&unreviewed.length===0&&returned.length===0&&!p.aiJobPending;
 const blockers=[
  !p.databaseReady?"Nelze ověřit data QA":null,
  !p.taskId?"QA úkol není převzatý":null,
  p.openFindings>0?`${p.openFindings} nevyřešených nálezů`:null,
  unreviewed.length>0?`${unreviewed.length} změn k ověření`:null,
  returned.length>0?`${returned.length} vrácených změn čeká na nové opravy`:null,
  p.aiJobPending?"AI právě zpracovává opravy":null
 ].filter((x):x is string=>Boolean(x));
 const navigate=(next:number)=>{
  if(next<0||next>=unreviewed.length)return;
  setIndex(next);setReturnOpen(false);setReturnNote("");
  p.onFind(unreviewed[next].target_atom_id);
 };
 const decide=(decision:"accepted"|"returned")=>{
  if(!current||pending)return;
  const issueId=current.id;
  startTransition(async()=>{
   try{
    const result=await decideSemanticChange({
     candidateId:p.candidateId,revisionSha:p.revisionSha,issueId,
     decision,note:decision==="returned"?returnNote:""
    });
    setFeedback(result.message);
    if(result.ok){
     setReturnOpen(false);setReturnNote("");setIndex(0);
     const next=unreviewed.find(issue=>issue.id!==issueId);
     if(next)p.onFind(next.target_atom_id);
     router.refresh();
    }
   }catch{setFeedback("Rozhodnutí se nepodařilo uložit; zkus znovu až po ověření stavu.");}
  });
 };
 const finish=()=>{
  if(!canFinish||!p.taskId)return;
  startTransition(async()=>{
   try{
    const result=await finishSemanticQaReview({
     candidateId:p.candidateId,revisionSha:p.revisionSha,taskId:p.taskId!
    });
    setFeedback(result.message);
    if(result.ok){p.onFinished();router.refresh();}
   }catch{setFeedback("Dokončení QA se nezdařilo. Úkol zůstává otevřený.");}
  });
 };
 return <section className="semantic-reader__review-bar" aria-label="Kontrola provedených oprav">
  <div className="semantic-reader__review-head">
   <strong>Kontrola opravených bloků</strong>
   <span>{accepted.length} z {p.issues.length} potvrzeno</span>
   <button type="button" onClick={p.onClose} aria-label="Ukončit režim kontroly oprav">×</button>
  </div>
  {current?<div className="semantic-reader__review-active">
   <div className="semantic-reader__review-nav">
    <button type="button" disabled={pending||index===0} onClick={()=>navigate(index-1)}
     aria-label="Předchozí neověřená změna">←</button>
    <span>K ověření {Math.min(index+1,unreviewed.length)} / {unreviewed.length}</span>
    <button type="button" disabled={pending||index>=unreviewed.length-1}
     onClick={()=>navigate(index+1)} aria-label="Další neověřená změna">→</button>
    <button type="button" className="semantic-reader__review-find"
     onClick={()=>p.onFind(current.target_atom_id)}>Najít v textu</button>
   </div>
   <p className="semantic-reader__review-reason">{current.reason}</p>
   <div className="semantic-reader__review-actions">
    <button className="semantic-reader__review-accept" type="button" disabled={pending}
     onClick={()=>decide("accepted")}>✓ Oprava je v pořádku</button>
    <button type="button" disabled={pending} aria-expanded={returnOpen}
     onClick={()=>setReturnOpen(v=>!v)}>Vrátit k opravě</button>
   </div>
   {returnOpen?<div className="semantic-reader__review-return">
    <label>Co je ještě potřeba opravit?
     <textarea rows={2} minLength={15} maxLength={4000}
      placeholder="Popiš konkrétní problém, který přetrvává."
      value={returnNote} onChange={e=>setReturnNote(e.target.value)}/>
    </label>
    <button type="button" disabled={pending||returnNote.trim().length<15}
     onClick={()=>decide("returned")}>Potvrdit vrácení</button>
   </div>:null}
  </div>:<p className="semantic-reader__review-done">
   {p.issues.length?"Všechny provedené změny jsou posouzené.":"Zatím není uložena žádná opravná revize."}
  </p>}
  <div className="semantic-reader__review-footer">
   <span className="semantic-reader__review-blockers">
    {blockers.length?`Pro dokončení zbývá: ${blockers.join(" · ")}`
      :"Všechny podmínky pro dokončení QA jsou splněné."}
   </span>
   <button type="button" className="semantic-reader__review-finish"
    disabled={!canFinish} onClick={finish}>Dokončit celé QA</button>
  </div>
  <p className="semantic-reader__review-key">
   <span><i className="semantic-reader__review-dot semantic-reader__review-dot--finding"/> Nález k opravě</span>
   <span><i className="semantic-reader__review-dot semantic-reader__review-dot--pending"/> Změna k ověření</span>
   <span><i className="semantic-reader__review-dot semantic-reader__review-dot--accepted"/> Potvrzeno</span>
   <span><i className="semantic-reader__review-dot semantic-reader__review-dot--selected"/> Tvůj výběr</span>
  </p>
  {feedback?<p role="status" className="semantic-reader__review-feedback" aria-live="polite">{feedback}</p>:null}
 </section>;
}
