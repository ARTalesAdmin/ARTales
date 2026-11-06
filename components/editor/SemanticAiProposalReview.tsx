"use client";

import {useEffect,useMemo,useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import type {AiQaSuggestion} from "@/lib/semantic/aiQaProposalEngine";
import {lastSemanticAiQaJob,type QaJobStatus}
 from "@/app/member/semantic/[candidateId]/ai-job-actions";
import {previewSemanticQaBatch} from "@/app/member/semantic/[candidateId]/qa-actions";
import {applyReviewedQaProposals} from "@/app/member/semantic/[candidateId]/qa-proposal-actions";
import type {SemanticRevision} from "@/lib/semantic/model";
import {isSafeWorkTypographyTerm,type QaProposalDecision} from "@/lib/semantic/qaProposalReview";

type Flag={id:string;target_atom_id:string;comment:string;kind:string;status:string};
type Props={
 candidateId:string;revisionSha:string;flags:Flag[];
 onClose:()=>void;onFind:(atomId:string)=>void;
 onPreview:(revision:SemanticRevision)=>void;
 onClearPreview:()=>void;onApplied:(revisionCreated:boolean)=>void;
};
const actionLabel:Record<AiQaSuggestion["action"],string>={
 compact:"Zhuštění sazby",airy:"Vzdušnější sazba",center:"Zarovnání na střed",
 protect_term:"Ochrana výrazu v celém díle",manual_review:"Redakční posouzení bez automatické změny"
};
export default function SemanticAiProposalReview(p:Props){
 const router=useRouter();
 const [job,setJob]=useState<QaJobStatus|null>(null);
 const [loading,setLoading]=useState(true);
 const [index,setIndex]=useState(0);
 const [targetIndex,setTargetIndex]=useState(0);
 const [choices,setChoices]=useState<Record<string,"approve"|"reject">>({});
 const [visitedTargets,setVisitedTargets]=useState<Record<string,string[]>>({});
 const [message,setMessage]=useState("");
 const [saved,setSaved]=useState(false);
 const [pending,startTransition]=useTransition();
 useEffect(()=>{
  let active=true;
  void lastSemanticAiQaJob({candidateId:p.candidateId,revisionSha:p.revisionSha})
   .then(result=>{if(!active)return;
    if(result.ok){setJob(result);setMessage(result.status==="completed"?"":result.message);}
    else setMessage(result.message);
   }).catch(()=>{if(active)setMessage("Návrhy AI není možné načíst.");})
   .finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false;};
 },[p.candidateId,p.revisionSha]);
 const suggestions=useMemo(()=>job?.status==="completed"&&
   !job.appliedRevisionSha?job.suggestions:[],[job]);
 const current=suggestions[index]??null;
 const flag=current?p.flags.find(f=>f.id===current.flagId):null;
 const allDecided=suggestions.length>0&&suggestions.every(s=>choices[s.flagId]);
 const approvalCount=Object.values(choices).filter(c=>c==="approve").length;
 const proposedLayout=suggestions.filter(s=>(["compact","airy","center"].includes(s.action))&&
  p.flags.some(f=>f.id===s.flagId&&f.status==="open"&&
   ["typography","structure"].includes(f.kind)))
  .map(s=>({flagId:s.flagId,action:s.action as "compact"|"airy"|"center"}));
 const approvedLayout=proposedLayout.filter(s=>choices[s.flagId]==="approve");
 const showTarget=(proposal:AiQaSuggestion,atomId:string)=>{
  if(!atomId)return;
  p.onFind(atomId);
  // Opening the first target on proposal navigation is an actual review visit.
  if(proposal.action==="manual_review")
   setVisitedTargets(old=>{
    const known=old[proposal.flagId]??[];
    return known.includes(atomId)?old:{...old,[proposal.flagId]:[...known,atomId]};
   });
 };
 const jumpTo=(next:number)=>{
  if(next<0||next>=suggestions.length)return;
  setIndex(next);setTargetIndex(0);
  const proposed=suggestions[next];const flag=p.flags.find(f=>f.id===proposed.flagId);
  const atom=proposed.targetAtomIds?.[0]??flag?.target_atom_id;
  if(atom)showTarget(proposed,atom);
 };
 const decide=(choice:"approve"|"reject")=>{
  if(!current)return;
  if(choice==="approve"&&current.action==="manual_review"&&current.targetAtomIds.length>1&&
   !current.targetAtomIds.every(id=>(visitedTargets[current.flagId]??[]).includes(id)))return;
  setChoices(old=>({...old,[current.flagId]:choice}));
  if(index<suggestions.length-1)jumpTo(index+1);
 };
 const preview=(approvedOnly:boolean)=>{
  const repairs=approvedOnly?approvedLayout:proposedLayout;
  if(!repairs.length){setMessage("Mezi návrhy nejsou žádné změny sazby k zobrazení.");return;}
  startTransition(async()=>{
   try{
    const result=await previewSemanticQaBatch({
     candidateId:p.candidateId,revisionSha:p.revisionSha,repairs
    });
    setMessage(result.message);
    if(result.ok&&result.revision){
     p.onPreview(result.revision);
     const first=suggestions.find(s=>s.flagId===repairs[0].flagId);
     const found=first?.targetAtomIds?.[0]??p.flags.find(f=>f.id===repairs[0].flagId)?.target_atom_id;
     if(found)p.onFind(found);
    }
   }catch{setMessage("Náhled se nepodařilo připravit. Žádná data se nezměnila.");}
  });
 };
 const apply=()=>{
  if(!job?.jobId||!allDecided||pending)return;
  startTransition(async()=>{
   try{
    const decisions:QaProposalDecision[]=suggestions.map(s=>({
     flagId:s.flagId,choice:choices[s.flagId]
    }));
    const result=await applyReviewedQaProposals({
     candidateId:p.candidateId,revisionSha:p.revisionSha,jobId:job.jobId!,
     decisions
    });
    setMessage(result.message);
    if(result.ok){
     setSaved(true);p.onClearPreview();
     p.onApplied(result.revisionCreated);
     router.refresh();
    }
   }catch{setMessage("Ukládání rozhodnutí se nezdařilo. Před opakováním ověř aktuální revizi.");}
  });
 };
 const targets=current?.targetAtomIds?.length?current.targetAtomIds:
   flag?[flag.target_atom_id]:[];
 const target=targets[Math.min(targetIndex,targets.length-1)];
 const visited=visitedTargets[current?.flagId??""]??[];
 const requiresFullReview=current?.action==="manual_review"&&targets.length>1;
 const canApprove=!requiresFullReview||targets.every(id=>visited.includes(id));
 const firstUnvisitedIndex=requiresFullReview?targets.findIndex(id=>!visited.includes(id)):-1;
 const findTarget=(id:string)=>{
  if(!id||!current)return;
  showTarget(current,id);
 };
 const showMissingTarget=()=>{
  if(firstUnvisitedIndex<0)return;
  setTargetIndex(firstUnvisitedIndex);
  findTarget(targets[firstUnvisitedIndex]);
 };
 return <section className="semantic-reader__proposal-review" aria-label="Revize návrhů AI">
  <div className="semantic-reader__proposal-head">
   <strong>Revize navržených oprav</strong>
   <span>{suggestions.length?Object.keys(choices).length+" / "+suggestions.length+" rozhodnutí":""}</span>
   <button type="button" aria-label="Zavřít revizi návrhů" onClick={p.onClose}>×</button>
  </div>
  {loading?<p>Načítám uložené návrhy AI…</p>:null}
  {!loading&&!suggestions.length?<p>Pro tuto revizi nejsou dostupné schvalovatelné návrhy AI.
   Nejprve označ nálezy a odešli je k opravě. Novou placenou dávku tento panel nespouští.</p>:null}
  {current&&!saved?<div className="semantic-reader__proposal-current">
   <div className="semantic-reader__proposal-nav">
    <button type="button" disabled={index===0||pending} aria-label="Předchozí návrh"
     onClick={()=>jumpTo(index-1)}>←</button>
    <span><strong>Návrh {index+1} / {suggestions.length}</strong></span>
    <button type="button" disabled={index>=suggestions.length-1||pending}
     aria-label="Další návrh" onClick={()=>jumpTo(index+1)}>→</button>
    <button type="button" onClick={()=>{if(target)findTarget(target);}}>
     Najít v textu</button>
   </div>
   <p><strong>{current.action==="protect_term"&&!isSafeWorkTypographyTerm(current.term)
    ?"Ověřit poznámku beze změny textu":actionLabel[current.action]}</strong>
    {current.action==="protect_term"&&current.term?" · "+current.term:""}</p>
   <p className="semantic-reader__proposal-reason">{current.rationale}</p>
   {current.action==="compact"?<p className="semantic-reader__proposal-help">
    Tato oprava mění mezery a odsazení bloku. Není to automatická oprava
    dělení slova v řádku. Ověř výsledek v náhledu.</p>:null}
   {current.action==="manual_review"?<p className="semantic-reader__proposal-help">
    Jde o redakční posouzení. Přijetí znamená, že jsi nález ověřil a
    nevyžaduješ další zásah; nic se nepřepisuje.</p>:null}
   {current.action==="protect_term"&&!isSafeWorkTypographyTerm(current.term)?
    <p className="semantic-reader__proposal-help">Výraz obsahuje interpunkci,
     takže jej nelze uložit jako typografické pravidlo. Přijetí znamená
     výslovné potvrzení, že obsahová poznámka má zůstat beze změny.</p>:null}
   {flag?<p className="semantic-reader__proposal-finding">Nález: {flag.comment}</p>:null}
   {targets.length>1?<div className="semantic-reader__proposal-targets">
    <button type="button" disabled={targetIndex===0}
     onClick={()=>{setTargetIndex(targetIndex-1);findTarget(targets[targetIndex-1]);}}>‹</button>
    <span>Ukázkový blok {targetIndex+1} / {targets.length}</span>
    <button type="button" disabled={targetIndex===targets.length-1}
     onClick={()=>{setTargetIndex(targetIndex+1);findTarget(targets[targetIndex+1]);}}>›</button>
    <small>{requiresFullReview?
     "Prohlédnuto "+visited.length+" / "+targets.length+
     " bloků. Otevři postupně každý blok a zkontroluj ho."
     :"U obecného návrhu musí editor skutečně posoudit nalezená místa."}</small>
    {firstUnvisitedIndex>=0?<button type="button" onClick={showMissingTarget}>
     Zobrazit neprohlédnutý blok ({firstUnvisitedIndex+1}/{targets.length})
    </button>:null}
   </div>:null}
   <div className="semantic-reader__proposal-choice">
    <button type="button" className={choices[current.flagId]==="approve"?"is-selected":""}
     disabled={!canApprove}
     onClick={()=>decide("approve")} aria-pressed={choices[current.flagId]==="approve"}>
     <span aria-hidden="true">✓</span> {current.action==="manual_review"?
      "Prověřeno, bez další změny":"Přijmout"}</button>
    <button type="button" className={choices[current.flagId]==="reject"?"is-rejected":""}
     onClick={()=>decide("reject")} aria-pressed={choices[current.flagId]==="reject"}>
     <span aria-hidden="true">✕</span> Ponechat k opravě</button>
   </div>
   <p className="semantic-reader__proposal-help">Přijetí je redakční rozhodnutí, ne automatické schválení modelem.
    Pokud změnu nechceš, nález zůstane otevřený.</p>
  </div>:null}
  {suggestions.length>0&&!saved?<div className="semantic-reader__proposal-final">
   <button type="button" disabled={!proposedLayout.length||pending}
    onClick={()=>preview(false)}>Zobrazit navrženou sazbu</button>
   <button type="button" disabled={!approvedLayout.length||pending}
    onClick={()=>preview(true)}>Náhled přijatých změn</button>
   <p>{approvalCount} přijato · {Object.values(choices).filter(c=>c==="reject").length} ponecháno ·
    {suggestions.length-Object.keys(choices).length} čeká na rozhodnutí</p>
   <button type="button" className="semantic-reader__proposal-save"
    disabled={!allDecided||pending||!job?.jobId} onClick={apply}>
    {pending?"Ukládám…":"Uložit schválené změny společně"}
   </button>
   <small>Sazební změny vytvoří jednu novou neměnnou revizi.
    Výrazy se ochrání v celém díle. Otevřené problémy se nepovažují za hotové.</small>
  </div>:null}
  {saved?<div className="semantic-reader__proposal-finished">
   <p>Rozhodnutí jsou uložená. Otevři aktuální revizi a zkontroluj změněné bloky.</p>
   <button type="button" onClick={p.onClose}>
    Přejít ke kontrole výsledné revize</button>
  </div>:null}
  {message?<p role="status" aria-live="polite">{message}</p>:null}
 </section>;
}
