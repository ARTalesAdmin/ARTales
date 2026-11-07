"use client";
import {useEffect,useRef,useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import type {SemanticReviewIssue} from "@/lib/semantic/model";
import {decideSemanticChange,finishSemanticQaReview}
 from "@/app/member/semantic/[candidateId]/qa-actions";

type Decision={issue_id:string;decision:string;note:string|null;reviewed_at:string};
type Props={
 candidateId:string;revisionSha:string;taskId:string|null;
 issues:SemanticReviewIssue[];decisions:Decision[];
 openFindings:number;aiJobPending:boolean;databaseReady:boolean;
 onFind:(atomId:string)=>void;getExcerpt:(atomId:string)=>string;
 onClose:()=>void;onFinished:()=>void;
};

/** The editable verdict stays beside the original and corrected text.
 * One explicit server-persisted decision removes one item from the pending queue. */
export default function SemanticReviewBar(p:Props){
 const router=useRouter();
 const [index,setIndex]=useState(0);
 const [returnOpen,setReturnOpen]=useState(false);
 const [returnNote,setReturnNote]=useState("");
 const [feedback,setFeedback]=useState("");
 const [pending,startTransition]=useTransition();
 const focusedId=useRef<string|null>(null);
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
  p.openFindings>0?p.openFindings+" otevřených nálezů":null,
  unreviewed.length>0?unreviewed.length+" změn čeká na rozhodnutí":null,
  returned.length>0?returned.length+" vrácených změn vyžaduje opravu":null,
  p.aiJobPending?"AI stále zpracovává opravy":null
 ].filter((x):x is string=>Boolean(x));
 // Focus the real edited block when the dock opens or the pending item changes.
 // The ref prevents a focus loop when the parent redraws after scrolling.
 useEffect(()=>{
  if(!current||focusedId.current===current.id)return;
  focusedId.current=current.id;
  p.onFind(current.target_atom_id);
 },[current?.id,p.onFind]);
 const navigate=(next:number)=>{
  if(next<0||next>=unreviewed.length)return;
  setIndex(next);setReturnOpen(false);setReturnNote("");setFeedback("");
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
   }catch{setFeedback("Rozhodnutí se nepodařilo uložit. Ověř stav a zkus to znovu.");}
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
   }catch{setFeedback("Dokončení QA se nezdařilo; úkol zůstává otevřený.");}
  });
 };
 const excerpt=current?p.getExcerpt(current.target_atom_id):"";
 return <aside className="semantic-reader__review-bar" aria-label="Kontrola změn vedle textu">
  <header className="semantic-reader__review-head">
   <div><strong>Kontrola opravených bloků</strong>
    <small>{accepted.length} přijato · {unreviewed.length} čeká
     {returned.length?" · "+returned.length+" vráceno":""}</small></div>
   <button type="button" onClick={p.onClose} aria-label="Zavřít kontrolu">×</button>
  </header>
  {current?<div className="semantic-reader__review-active">
   <nav className="semantic-reader__review-nav" aria-label="Procházení neověřených změn">
    <button type="button" disabled={pending||index===0}
     onClick={()=>navigate(index-1)} aria-label="Předchozí změna">←</button>
    <span>Změna {index+1} / {unreviewed.length}</span>
    <button type="button" disabled={pending||index>=unreviewed.length-1}
     onClick={()=>navigate(index+1)} aria-label="Další změna">→</button>
    <button type="button" className="semantic-reader__review-find"
     onClick={()=>p.onFind(current.target_atom_id)}>Ukázat blok v textu</button>
   </nav>
   <p className="semantic-reader__review-reason">{current.reason}</p>
   {excerpt?<div className="semantic-reader__review-excerpt">
    <small>Právě posuzovaný blok · úplný blok je zvýrazněn ve čtečce</small>
    <p>{excerpt}</p>
   </div>:null}
   <div className="semantic-reader__review-actions">
    <button className="semantic-reader__review-accept" type="button" disabled={pending}
     onClick={()=>decide("accepted")}>✓ Přijmout</button>
    <button type="button" disabled={pending} aria-expanded={returnOpen}
     onClick={()=>setReturnOpen(v=>!v)}>✕ Vrátit s poznámkou</button>
   </div>
   {returnOpen?<div className="semantic-reader__review-return">
    <label>Co je ještě potřeba změnit?
     <textarea rows={3} minLength={15} maxLength={4000}
      placeholder="Popiš konkrétní problém, který ještě vidíš v označeném bloku."
      value={returnNote} onChange={e=>setReturnNote(e.target.value)}/>
    </label>
    <button type="button" disabled={pending||returnNote.trim().length<15}
     onClick={()=>decide("returned")}>Odeslat k opravě</button>
   </div>:null}
   <small className="semantic-reader__review-guidance">
    Přijetí se uloží ihned a blok zmizí z fronty. Vrácení vyžaduje konkrétní poznámku.
   </small>
  </div>:<p className="semantic-reader__review-done">
   {p.issues.length?"Všechny opravené bloky byly posouzeny.":"Pro tuto revizi nejsou žádné opravené bloky k posouzení."}
  </p>}
  <div className="semantic-reader__review-footer">
   {blockers.length?<p className="semantic-reader__review-blockers" role="status">
    Zbývá: {blockers.join(" · ")}</p>:<p className="semantic-reader__review-blockers">
    Vše je zkontrolováno. Můžeš uzavřít textové QA.</p>}
   <button type="button" className="semantic-reader__review-finish"
    disabled={!canFinish} onClick={finish}>Dokončit celé QA</button>
  </div>
  <details className="semantic-reader__review-legend">
   <summary>Jak poznám stavy v textu?</summary>
   <p><span className="semantic-reader__review-dot semantic-reader__review-dot--finding"/> Nález k opravě ·
    <span className="semantic-reader__review-dot semantic-reader__review-dot--pending"/> Změna k ověření ·
    <span className="semantic-reader__review-dot semantic-reader__review-dot--accepted"/> Potvrzeno ·
    <span className="semantic-reader__review-dot semantic-reader__review-dot--selected"/> Výběr</p>
  </details>
  {feedback?<p role="status" className="semantic-reader__review-feedback" aria-live="polite">{feedback}</p>:null}
 </aside>;
}
