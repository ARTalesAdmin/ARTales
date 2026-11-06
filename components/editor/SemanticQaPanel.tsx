"use client";
import {useEffect,useMemo,useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import type {AiQaSuggestion} from "@/lib/semantic/aiQaProposalEngine";
import {enqueueSemanticAiQaJob,lastSemanticAiQaJob,readSemanticAiQaJob,type QaJobStatus} from "@/app/member/semantic/[candidateId]/ai-job-actions";
import {commitSemanticQaBatch,previewSemanticQaBatch,resolveSemanticQaFlag,saveWorkTypographyRule,
  decideSemanticChange,finishSemanticQaReview,
  submitSemanticQaFlag,type EditorialBatchAction} from "@/app/member/semantic/[candidateId]/qa-actions";
import type {SemanticRevision,SemanticReviewIssue} from "@/lib/semantic/model";
export type SemanticQaFlag={
 id:string;revision_sha256:string;target_atom_id:string;
 source_start:number;source_end:number;kind:string;comment:string;
 status:"open"|"resolved";created_at:string;resolution_note:string|null;
};
type SystemSignal={atomId:string;sourceStart:number;reason:string;kind:"source_ambiguity"};
type Props={candidateId:string;revisionSha:string;selectedAtomId:string|null;
 selectedText:string|null;flags:SemanticQaFlag[];onSelect:(atomId:string)=>void;
 readonly?:boolean;databaseReady:boolean;onSaved:()=>void;systemSignals:SystemSignal[];
 canCommitBatch:boolean;onPreview:(revision:SemanticRevision)=>void;
 currentTaskId:string|null;currentChangeIssues:SemanticReviewIssue[];
 reviewDecisions:{issue_id:string;decision:string;note:string|null;reviewed_at:string}[]};
const kinds=[{value:"text",label:"Text"},{value:"typography",label:"Sazba a řádky"},
 {value:"structure",label:"Struktura"},{value:"image",label:"Vizuál"},
 {value:"other",label:"Jiné"}];
export default function SemanticQaPanel(p:Props){
 const router=useRouter();
 const [kind,setKind]=useState("typography");
 const [comment,setComment]=useState("");
 const [resolutions,setResolutions]=useState<Record<string,string>>({});
 const [feedback,setFeedback]=useState("");
 const [aiSuggestions,setAiSuggestions]=useState<AiQaSuggestion[]>([]);
 const [job,setJob]=useState<QaJobStatus|null>(null);
 const [returnNotes,setReturnNotes]=useState<Record<string,string>>({});
 const [repairs,setRepairs]=useState<Record<string,EditorialBatchAction|"">>({});
 const example=p.flags.find(f=>f.status==="open"&&f.kind==="typography")?.comment
  .match(/["„“]([\p{L}-]{2,50})["„“]/u)?.[1]??"";
 const [term,setTerm]=useState(example);
 const [pending,startTransition]=useTransition();
 const open=p.flags.filter(f=>f.status==="open");
 const selected=p.flags.filter(f=>f.target_atom_id===p.selectedAtomId);
 const options=useMemo(()=>open.map(f=>({flag:f,action:repairs[f.id]??""})),[open,repairs]);
 const ready=options.filter(x=>x.action);
 const submit=(atomId:string,entryKind:string,entryComment:string)=>{
  if(pending)return;
  startTransition(async()=>{
   const result=await submitSemanticQaFlag({
    candidateId:p.candidateId,revisionSha:p.revisionSha,atomId,
    kind:entryKind,comment:entryComment
   });
   setFeedback(result.message);
   if(result.ok){setComment("");router.refresh();}
  });
 };
 const resolve=(id:string)=>{
  startTransition(async()=>{
   const result=await resolveSemanticQaFlag({
    candidateId:p.candidateId,flagId:id,resolutionNote:resolutions[id]??""
   });
   setFeedback(result.message);
   if(result.ok)router.refresh();
  });
 };
 const acceptAiSuggestions=(suggestions:AiQaSuggestion[])=>{
   setAiSuggestions(suggestions);
   // Layout fixes are recorded by the authorized job; any remaining proposals
   // can be previewed or corrected by the assigned QA editor.
   const next:Record<string,EditorialBatchAction|"">={};
   for(const suggestion of suggestions){
    if(["compact","airy","center"].includes(suggestion.action))
     next[suggestion.flagId]=suggestion.action as EditorialBatchAction;
   }
   setRepairs(next);
   const proposedTerm=suggestions.find(x=>x.action==="protect_term"&&x.term)?.term;
   if(proposedTerm)setTerm(proposedTerm);
 };
 useEffect(()=>{
   let active=true;
   void lastSemanticAiQaJob({candidateId:p.candidateId,revisionSha:p.revisionSha})
    .then(result=>{if(active&&result.ok){
      setJob(result);
      if(result.status==="completed"){
       if(result.appliedRevisionSha)router.refresh();
       else acceptAiSuggestions(result.suggestions);
      }
    }});
   return ()=>{active=false;};
   // Only restore the job for the exact loaded source revision.
   // eslint-disable-next-line react-hooks/exhaustive-deps
 },[p.candidateId,p.revisionSha]);
 useEffect(()=>{
   if(!job?.jobId||!["queued","running"].includes(job.status))return;
   let active=true;
   const interval=setInterval(()=>{
    void readSemanticAiQaJob({jobId:job.jobId!}).then(result=>{
     if(!active||!result.ok)return;
     setJob(result);
     if(result.status==="completed"){
      if(result.appliedRevisionSha)router.refresh();
      else {
       acceptAiSuggestions(result.suggestions);
       if(result.suggestions.some(s=>s.action==="protect_term"))router.refresh();
      }
     }
     if(result.status==="failed")setFeedback(result.message);
    });
   },4000);
   return ()=>{active=false;clearInterval(interval);};
   // Intentionally restart polling only when the active job identity/status changes.
   // eslint-disable-next-line react-hooks/exhaustive-deps
 },[job?.jobId,job?.status]);
 const requestAi=()=>{
   startTransition(async()=>{
     const queued=await enqueueSemanticAiQaJob({
       candidateId:p.candidateId,revisionSha:p.revisionSha
     });
     if(queued.ok){
      setJob(queued);
      if(queued.status==="completed"){
       if(queued.appliedRevisionSha)router.refresh();
       else acceptAiSuggestions(queued.suggestions);
      }
      setFeedback(queued.message);
      return;
     }
     // Missing worker configuration is a hard stop. Never fall back to a
     // foreground provider request or create a second billable attempt.
     setFeedback(queued.message);
   });
 };
 const preview=()=>{
  startTransition(async()=>{
   const result=await previewSemanticQaBatch({
    candidateId:p.candidateId,revisionSha:p.revisionSha,
    repairs:ready.map(x=>({flagId:x.flag.id,action:x.action as EditorialBatchAction}))
   });
   setFeedback(result.message);
   if(result.ok&&result.revision)p.onPreview(result.revision);
  });
 };
 const protect=()=>{
  startTransition(async()=>{
   const result=await saveWorkTypographyRule({candidateId:p.candidateId,term});
   setFeedback(result.message);
   if(result.ok)router.refresh();
  });
 };
 const batch=()=>{
  startTransition(async()=>{
   const result=await commitSemanticQaBatch({
    candidateId:p.candidateId,revisionSha:p.revisionSha,
    repairs:ready.map(x=>({flagId:x.flag.id,action:x.action as EditorialBatchAction}))
   });
   setFeedback(result.message);
   if(result.ok){setRepairs({});router.refresh();}
  });
 };
 const decide=(issueId:string,decision:"accepted"|"returned")=>{
   startTransition(async()=>{
    const result=await decideSemanticChange({
     candidateId:p.candidateId,revisionSha:p.revisionSha,
     issueId,decision,note:decision==="returned"?returnNotes[issueId]??"":""
    });
    setFeedback(result.message);
    if(result.ok)router.refresh();
   });
 };
 const finish=()=>{
   if(!p.currentTaskId)return;
   startTransition(async()=>{
    const result=await finishSemanticQaReview({
     candidateId:p.candidateId,revisionSha:p.revisionSha,taskId:p.currentTaskId!
    });
    setFeedback(result.message);
    if(result.ok){p.onSaved();router.refresh();}
   });
 };
 const verdictById=new Map(p.reviewDecisions.map(d=>[d.issue_id,d]));
 const unreviewed=p.currentChangeIssues.filter(issue=>verdictById.get(issue.id)?.decision!=="accepted");
 const canFinish=p.databaseReady&&Boolean(p.currentTaskId)&&!pending&&open.length===0&&unreviewed.length===0&&
  job?.status!=="queued"&&job?.status!=="running";
 const unaddressedSignals=p.systemSignals.filter(s=>
   !p.flags.some(f=>f.target_atom_id===s.atomId&&f.status==="open"));
 return <aside className="semantic-qa-panel" aria-label="Redakční nálezy a opravy">
  <div className="semantic-qa-panel__heading"><h2>QA nálezy</h2>
   <span>{open.length} otevřených · {p.flags.length-open.length} uzavřených</span></div>
  {!p.databaseReady?<p role="alert">Databázová QA evidence není dostupná. Opravy nelze bezpečně uložit.</p>:null}
  <p>Výběrem diamantové značky zvolíš blok v obou panelech. Opětovným kliknutím ho odznačíš.</p>
  {p.selectedAtomId?<div className="semantic-qa-panel__selection">
   <strong>Vybraný blok</strong><p>{p.selectedText?.slice(0,240)??p.selectedAtomId}</p>
   <small>{selected.length} nálezů pro tento blok</small>
  </div>:<p className="semantic-qa-panel__selection">Vyber problémový blok.</p>}
  {unaddressedSignals.length>0?<section className="semantic-qa-panel__signals">
   <h3><span aria-hidden="true">◆</span> Automaticky označené nejasnosti</h3>
   {unaddressedSignals.map(s=><div key={s.atomId}>
    <p>{s.reason}</p>
    <button type="button" onClick={()=>p.onSelect(s.atomId)}>Najít v textu</button>
    <button type="button" disabled={pending||!p.databaseReady}
     onClick={()=>submit(s.atomId,"structure",
       "Sporná ediční poznámka: potřebuji rozhodnout, zda patří do vlastního vydání ARTales.")}>
     Převzít k redakčnímu posouzení</button>
   </div>)}
  </section>:null}
  {p.selectedAtomId&&p.databaseReady&&!p.readonly?
   <form onSubmit={e=>{e.preventDefault();submit(p.selectedAtomId!,kind,comment);}}
    className="semantic-qa-panel__form">
    <label>Druh problému<select value={kind} onChange={e=>setKind(e.target.value)}>
     {kinds.map(k=><option key={k.value} value={k.value}>{k.label}</option>)}
    </select></label>
    <label>Co je třeba opravit?<textarea value={comment} minLength={15} maxLength={4000}
     rows={3} onChange={e=>setComment(e.target.value)}
     placeholder="Napiš, co je špatně. Způsob opravy není nutné vymýšlet."/>
    </label>
    <button type="submit" disabled={pending||comment.trim().length<15}>
     Uložit nález a pokračovat</button>
   </form>:null}
  <section className="semantic-qa-panel__fast-rule">
   <h3>Rychlá oprava pro celé dílo</h3>
   <p>Chránit slovo či jméno před dělením ve všech výskytech. Jde jen o sazbu:
     archiv i SHA textu zůstanou beze změny. Výsledek je potřeba vizuálně ověřit.</p>
   <label>Výraz<input type="text" value={term} maxLength={80}
     placeholder="Raymond" onChange={e=>setTerm(e.target.value)}/></label>
   <button type="button" disabled={pending||!p.databaseReady||term.trim().length<2}
     onClick={protect}>Použít na celé dílo</button>
  </section>
  <section className="semantic-qa-panel__batch">
   <h3>AI návrh oprav</h3>
   <p>ARTales AI zpracuje otevřené nálezy a bezpečné opravy sazby provede sama.
    Jména a názvy chrání před zalomením bez zásahu do originálního textu.
    Výsledek editor zkontroluje; nejisté nálezy zůstanou otevřené.</p>
   <button type="button" disabled={pending||!p.databaseReady||!p.currentTaskId||open.length<1||open.length>25||job?.status==="queued"||job?.status==="running"}
    onClick={requestAi}>Předat {open.length} nálezů do fronty ARTales AI</button>
   {job?.jobId?<div role="status" aria-live="polite">
     <p><strong>Fronta ARTales AI · ARTales</strong>: {job.message}</p>
     {job.status==="completed"?<progress max={100} value={100} aria-label="Opravná dávka dokončena"/>:
      job.status==="queued"||job.status==="running"?
      <progress aria-label="Zpracovávání oprav v AI frontě"/>:null}
     {job.appliedRevisionSha?<p>Nová opravná revize {job.appliedRevisionSha.slice(0,12)} byla uložena.
       Otevřené QA ji zobrazí k opakované kontrole v této seanci.</p>:null}
     {job.status==="queued"||job.status==="running"?
      <p>Úloha je trvale evidovaná. Můžeš počkat zde, nebo okno zavřít.
       Po návratu se načte výsledek stejné revize. Délku zpracování nelze spolehlivě odhadnout.</p>:null}
    </div>:null}
   {aiSuggestions.length?<div style={{marginTop:12}}>
    <h4>Návrhy ke schválení</h4>
    {aiSuggestions.map(s=><p key={s.flagId}>
     <strong>{s.action==="manual_review"?"Nutná ruční kontrola":s.action==="protect_term"?
      "Ochrana výrazu: "+s.term:"Návrh: "+s.action}</strong>
     {" — "}{s.rationale}
    </p>)}
   </div>:null}
  </section>
  {p.currentChangeIssues.length>0?<section className="semantic-qa-panel__batch">
    <h3>Ověření opravených bloků</h3>
    <p>Opravené bloky jsou vyznačeny tyrkysově, aktivní výběr zlatě.
     Každá změna vyžaduje samostatné rozhodnutí. Přijetí nepotřebuje komentář.</p>
    <p>Ověřeno {p.currentChangeIssues.length-unreviewed.length} / {p.currentChangeIssues.length}</p>
    <progress max={p.currentChangeIssues.length}
     value={p.currentChangeIssues.length-unreviewed.length} aria-label="Kontrola změněných bloků"/>
    {p.currentChangeIssues.map(issue=>{
      const verdict=verdictById.get(issue.id);
      return <div className="semantic-qa-panel__review" key={issue.id}>
       <button type="button" onClick={()=>p.onSelect(issue.target_atom_id)}>Zobrazit změněný blok</button>
       <p>{issue.reason}</p>
       <p><strong>{verdict?.decision==="accepted"?"Přijato":
         verdict?.decision==="returned"?"Vráceno k opravě":"Čeká na rozhodnutí"}</strong></p>
       {verdict?.note?<p className="semantic-qa-panel__review-note">{verdict.note}</p>:null}
       {!verdict&&p.currentTaskId&&p.databaseReady?<div className="semantic-qa-panel__review-actions">
         <button type="button" disabled={pending} onClick={()=>decide(issue.id,"accepted")}
          aria-label="Přijmout tuto opravu">✓ Přijmout</button>
         <details><summary>✕ Vrátit s poznámkou</summary>
          <label>Co ještě opravit?
           <textarea required minLength={15} maxLength={4000}
            value={returnNotes[issue.id]??""}
            onChange={e=>setReturnNotes(v=>({...v,[issue.id]:e.target.value}))}/>
          </label>
          <button type="button" disabled={pending||(returnNotes[issue.id]?.trim().length??0)<15}
           onClick={()=>decide(issue.id,"returned")}>Vrátit tuto opravu</button>
         </details>
       </div>:null}
      </div>;
    })}
   </section>:null}
  {p.currentTaskId?<section className="semantic-qa-panel__batch">
   <h3>Dokončení textového QA</h3>
   {open.length>0?<p>První nebo opakovaná kontrola nalezla {open.length} nedořešených problémů.
    Předat je do opravy a následně projít změny v téže seanci.</p>:
    unreviewed.length>0?<p>Nejprve výslovně přijmi všechny opravené bloky,
     případně je vrať s poznámkou.</p>:
    <p>Všechny nálezy i opravy jsou posouzené. Přijetím se úkol uzavře
     a uvolní navazující redakční práci.</p>}
   <button type="button" disabled={!canFinish} onClick={finish}>✓ Přijmout QA a dokončit úkol</button>
  </section>:null}
  <h3>Seznam nálezů</h3>
  {p.flags.length===0?<p>Zatím bez redakčních nálezů.</p>:
   <div className="semantic-qa-panel__flags">{p.flags.map(f=><article key={f.id}
     className={"semantic-qa-panel__flag"+(f.status==="open"?" semantic-qa-panel__flag--open":"")}>
    <div><strong>{kinds.find(k=>k.value===f.kind)?.label??f.kind}</strong>
     {" · "}{f.status==="open"?"Čeká na opravu":"Uzavřeno"}
     <button type="button" onClick={()=>p.onSelect(f.target_atom_id)}>Najít blok</button></div>
    <p>{f.comment}</p>
    {f.status==="resolved"?<small>{f.resolution_note}</small>:
     <div className="semantic-qa-panel__form">
      {["typography","structure","other"].includes(f.kind)?
       <label>Volitelná oprava v jedné společné revizi
        <select value={repairs[f.id]??""}
         onChange={e=>setRepairs(v=>({...v,[f.id]:e.target.value as EditorialBatchAction|""}))}>
         <option value="">Zatím neřešit dávkově</option>
         {f.kind==="typography"||f.kind==="structure"?<>
          <option value="compact">Zmenšit mezery</option>
          <option value="airy">Zvětšit mezery</option>
          <option value="center">Zarovnat na střed</option>
         </>:null}
         {f.kind==="structure"||f.kind==="other"?
          <option value="exclude_note">Vyřadit ediční poznámku z vydání</option>:null}
        </select>
       </label>:null}
      <details><summary>Zdůvodněně uzavřít bez úpravy</summary>
       <label>Vysvětlení po kontrole
        <textarea rows={2} minLength={30} maxLength={4000} value={resolutions[f.id]??""}
         onChange={e=>setResolutions(s=>({...s,[f.id]:e.target.value}))}/></label>
       <button type="button" disabled={pending||(resolutions[f.id]?.trim().length??0)<30}
        onClick={()=>resolve(f.id)}>Uzavřít s důkazem</button>
      </details>
     </div>}
   </article>)}</div>}
  {ready.length>0?<section className="semantic-qa-panel__batch">
   <p>Bezpečný okamžitý náhled změn formátování lze vykreslit ještě před uložením.
      Text, pořadí ani zdrojové kotvy se nemění.</p>
   <button type="button" disabled={pending||!p.databaseReady} onClick={preview}>
    Zobrazit opravenou sazbu bez uložení
   </button>
   {p.canCommitBatch?<>
   <p>Vybráno {ready.length} oprav. Uloží se najednou jako jediná neměnná revize,
    vznikne právě jeden nový textový QA úkol pro stejného editora.</p>
   <button type="button" disabled={pending||!p.databaseReady} onClick={batch}>
    Provést {ready.length} oprav a vytvořit novou revizi
   </button></>:null}
  </section>:null}
  {!p.canCommitBatch&&ready.length>0?<p>Opravu lze uložit pouze vlastníkovi právě převzatého QA úkolu;
    případně požádej garanta o přiřazení práce.</p>:null}
  <p role="status" aria-live="polite">{feedback}</p>
  <small>Semantické změny, které nelze provést bezpečným pravidlem,
   zůstávají otevřené pro další odbornou opravu. Nikdy se automaticky neoznačí za hotové.</small>
 </aside>;
}
