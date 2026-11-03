import {notFound} from "next/navigation";
import Link from "next/link";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import SemanticReaderLab from "@/components/editor/SemanticReaderLab";
import {verifySemanticRevision} from "@/lib/semantic/compose";
import type {SemanticRevision} from "@/lib/semantic/model";
import {SEMANTIC_PIPELINE_ENABLED} from "@/lib/semantic/featureFlag";
export const dynamic="force-dynamic";
export default async function EditorialSemanticPreview({params}:{params:Promise<{candidateId:string}>}){
 const {candidateId}=await params;
 if(!SEMANTIC_PIPELINE_ENABLED)notFound();
 await requireEditorOrAdmin();
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
 const revision=data.revision as SemanticRevision;
 try{verifySemanticRevision(revision,data.source_text);}
 catch{notFound();}
 return <main><section style={{maxWidth:900,margin:"20px auto",padding:16}}>
 <h1>Sémantická redakce</h1>
 <p>Revize je interní až do schválení textu, vizuálu a korektur. Všechny
 obrazové součásti EPUBu zůstávají jen v soukromém archivním originálu.</p>
 <p><Link href={"/member/snapshot/"+candidateId}>← Zpět na Snapshot</Link></p>
 <p>Nejprve zkontrolujte literární text, sazbu a případné vizuální nedostatky.
 Po dokončení QA pokračujte akcemi pod náhledem.</p>
 </section>
 <p style={{margin:"20px"}}><Link href={`/member/snapshot/${candidateId}`}>← Snapshot</Link>
  {" · "}<strong>{data.status}</strong> · {data.revision_sha256.slice(0,12)}</p>
  <SemanticReaderLab revision={revision} original={data.source_text}
    candidateId={candidateId} revisionSha={data.revision_sha256}
    editionTitle={candidate?.proposed_title??"Název čeká na kontrolu"}
    editionAuthor={candidate?.proposed_author_name??"Autor čeká na kontrolu"}
    flags={qaFlags??[]} qaDatabaseReady={!qaFlagError}
    protectedTerms={(workRules??[]).map(x=>x.term)}
    />
  <section id="editorial-actions" style={{maxWidth:900,margin:"28px auto",padding:"20px 24px",
    border:"1px solid #d9cfbf",borderRadius:12,background:"#faf7f0"}}>
   <h2>Stav práce</h2>
   <p>Toto je jedna kontrola textu. Zápis nálezu ji neuzavírá;
      každá oprava se následně ověří v QA.</p>
   <p>Aktivních úkolů díla: {tasks?.filter(t=>t.status!=="completed").length??0}.
      Dokončeno: {tasks?.filter(t=>t.status==="completed").length??0}.</p>
   <p><Link href="/member/editorial-pipeline">Přejít na vlastní úkoly a dokončení kontroly</Link></p>
   <p>Obálka, anotace, autor a kolekce jsou oddělené úkoly.
      Publikační akce se neukazuje před dokončením všech povinností.</p>
  </section></main>;
}
