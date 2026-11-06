import {notFound} from "next/navigation";
import Link from "next/link";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import SemanticReaderLab from "@/components/editor/SemanticReaderLab";
import {verifySemanticRevision,walkSemanticAtoms} from "@/lib/semantic/compose";
import {detectEditionReviewSignals} from "@/lib/semantic/editionProjection";
import type {SemanticRevision} from "@/lib/semantic/model";
import {SEMANTIC_PIPELINE_ENABLED} from "@/lib/semantic/featureFlag";
import "@/components/editor/editorial-workspace.css";
export const dynamic="force-dynamic";
export default async function EditorialSemanticPreview({params}:{params:Promise<{candidateId:string}>}){
 const {candidateId}=await params;
 if(!SEMANTIC_PIPELINE_ENABLED)notFound();
 const profile=await requireEditorOrAdmin();
 if(!/^[a-f0-9-]{36}$/i.test(candidateId))notFound();
 const db=await createClient();
 const {data,error}=await db.from("candidate_semantic_revisions")
  .select("revision,source_text,revision_sha256,status").eq("candidate_id",candidateId)
  .order("created_at",{ascending:false}).limit(1).maybeSingle();
 if(error||!data||typeof data.source_text!=="string")notFound();
 const {data:candidate}=await db.from("work_candidates")
  .select("proposed_title,proposed_author_name").eq("id",candidateId).maybeSingle();
 const {data:qaFlags,error:qaFlagError}=await db.from("artales_semantic_qa_flags")
  .select("id,revision_sha256,target_atom_id,source_start,source_end,kind,comment,status,created_at,resolution_note")
  .eq("candidate_id",candidateId).eq("revision_sha256",data.revision_sha256)
  .order("created_at",{ascending:true});
 const {data:workRules}=await db.from("artales_work_typography_rules")
  .select("term").eq("candidate_id",candidateId);
 const {data:tasks}=await db.from("artales_editorial_tasks")
  .select("id,kind,status,assigned_to").eq("candidate_id",candidateId)
  .eq("revision_sha256",data.revision_sha256);
 const {data:reviewDecisions,error:reviewError}=await db.from("artales_semantic_change_reviews")
  .select("issue_id,decision,note,reviewed_at").eq("candidate_id",candidateId)
  .eq("revision_sha256",data.revision_sha256);
 const {data:pendingAiJobs,error:pendingAiError}=await db.from("artales_semantic_ai_qa_jobs")
  .select("id").eq("candidate_id",candidateId).eq("revision_sha256",data.revision_sha256)
  .in("status",["queued","running"]).limit(1);
 const qaTask=(tasks??[]).find(t=>t.kind==="text_review"&&
  t.assigned_to===profile.id&&t.status==="claimed");
 const revision=data.revision as SemanticRevision;
 const systemSignals=detectEditionReviewSignals(data.source_text,walkSemanticAtoms(revision.blocks),revision.editorial_exclusions??[]);
 try{verifySemanticRevision(revision,data.source_text);}
 catch{notFound();}
 const openFindings=(qaFlags??[]).filter(x=>x.status==="open").length;
 const activeTasks=(tasks??[]).filter(t=>t.status!=="completed").length;
 const completedTasks=(tasks??[]).filter(t=>t.status==="completed").length;
 return <main>
  <header className="ed-page ed-qa-head" style={{paddingBottom:0}}>
   <nav className="ed-breadcrumb" aria-label="Drobečková navigace">
    <Link href="/member/editorial-pipeline">Redakční práce</Link>
    <span className="ed-breadcrumb__sep">/</span>
    <Link href={"/member/editorial-detail/"+candidateId}>Detail díla</Link>
    <span className="ed-breadcrumb__sep">/</span>
    <span>Textové QA</span>
   </nav>
   <div className="ed-hero">
    <p className="ed-eyebrow">ARTales · Kontrola textu a sazby</p>
    <div className="ed-hero__row">
     <div>
      <h1>{candidate?.proposed_title??"Sémantické QA"}</h1>
      <p className="ed-hero__subtitle">
       {candidate?.proposed_author_name??"Autor díla"} · Označ sporné bloky, přidej poznámky
       a ověř opravy před schválením revize. Originální text se nemění.
      </p>
     </div>
     <div className="ed-hero__actions">
      <Link className="ed-button ed-button--soft" href={"/member/editorial-detail/"+candidateId}>
       ← Karta díla
      </Link>
      <a className="ed-button" href="#editorial-qa-workspace">Přejít ke kontrole ↘</a>
     </div>
    </div>
   </div>
   <div className="ed-stats" aria-label="Stav QA">
    <div className="ed-stat"><strong className="ed-stat__value">{openFindings}</strong>
     <span className="ed-stat__label">Otevřené nálezy</span></div>
    <div className="ed-stat"><strong className="ed-stat__value">{activeTasks}</strong>
     <span className="ed-stat__label">Aktivní úkoly díla</span></div>
    <div className="ed-stat"><strong className="ed-stat__value">{completedTasks}</strong>
     <span className="ed-stat__label">Dokončené úkoly</span></div>
   </div>
  </header>
  <div className="ed-qa-workspace" id="editorial-qa-workspace">
   <SemanticReaderLab revision={revision} original={data.source_text}
    candidateId={candidateId} revisionSha={data.revision_sha256}
    editionTitle={candidate?.proposed_title??"Název čeká na kontrolu"}
    editionAuthor={candidate?.proposed_author_name??"Autor čeká na kontrolu"}
    flags={qaFlags??[]} qaDatabaseReady={!qaFlagError&&!reviewError&&!pendingAiError} aiJobPending={Boolean(pendingAiJobs?.length)||Boolean(pendingAiError)} systemSignals={systemSignals}
    protectedTerms={(workRules??[]).map(x=>x.term)} canCommitBatch={Boolean(qaTask)}
    currentTaskId={qaTask?.id??null} reviewDecisions={reviewDecisions??[]}
   />
  </div>
  <footer className="ed-page ed-qa-footer" id="editorial-actions">
   <div className="ed-card">
    <div className="ed-card__head">
     <div className="ed-card__heading">
      <span className="ed-card__number">✓</span>
      <div><h2>Další kroky redakce</h2>
       <p className="ed-card__lead">QA nález se zapisuje samostatně. Opravená revize se musí znovu ověřit.</p>
      </div>
     </div>
    </div>
    <div className="ed-inline-links">
     <Link className="ed-button" href="/member/editorial-pipeline">Moje redakční úkoly ↗</Link>
     <Link className="ed-button ed-button--soft" href={"/member/editorial-detail/"+candidateId}>
      Autor, kolekce, anotace a obálka ↗
     </Link>
     <Link className="ed-inline-link" href={"/member/snapshot/"+candidateId}>Zdrojový snapshot</Link>
    </div>
    <p className="ed-quiet" style={{marginTop:15}}>Publikace zůstává uzamčená, dokud
     nejsou schváleny všechny povinné kontroly a podklady.</p>
   </div>
  </footer>
 </main>;
}
