import {notFound} from "next/navigation";
import Link from "next/link";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import SemanticReaderLab from "@/components/editor/SemanticReaderLab";
import {verifySemanticRevision} from "@/lib/semantic/compose";
import {enqueueSemanticReview,publishSemanticCandidate} from "@/app/member/editorial-pipeline/actions";
import type {SemanticRevision} from "@/lib/semantic/model";
export const dynamic="force-dynamic";
export default async function EditorialSemanticPreview({params}:{params:Promise<{candidateId:string}>}){
 const {candidateId}=await params;
 await requireEditorOrAdmin();
 if(!/^[a-f0-9-]{36}$/i.test(candidateId))notFound();
 const db=await createClient();
 const {data,error}=await db.from("candidate_semantic_revisions")
  .select("revision,source_text,revision_sha256,status").eq("candidate_id",candidateId)
  .order("created_at",{ascending:false}).limit(1).maybeSingle();
 if(error||!data||typeof data.source_text!=="string")notFound();
 const revision=data.revision as SemanticRevision;
 try{verifySemanticRevision(revision,data.source_text);}
 catch{notFound();}
 return <main><section style={{maxWidth:900,margin:"20px auto",padding:16}}>
 <h1>Sémantická redakce</h1>
 <p>Revize je interní až do schválení textu, vizuálu a korektur. Všechny
 obrazové součásti EPUBu zůstávají jen v soukromém archivním originálu.</p>
 <form action={enqueueSemanticReview}><input type="hidden" name="candidate_id" value={candidateId}/>
  <button type="submit">Založit tři revizní úkoly</button></form>
 <p><Link href="/member/editorial-pipeline">Redakční fronta a stav kontrol</Link></p>
 <details><summary>Publikovat přesně tuto revizi po dokončení kontrol</summary>
  <form action={publishSemanticCandidate}>
   <input type="hidden" name="candidate_id" value={candidateId}/>
   <input type="hidden" name="revision_sha256" value={data.revision_sha256}/>
   <p><label>Veřejný slug <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100}/></label></p>
   <p><label>Redakční anotace (200–800 znaků)<textarea name="summary" required minLength={200} maxLength={800} rows={5}/></label></p>
   <p><label>Zdůvodnění vydání (min. 30 znaků)<textarea name="reason" required minLength={30} maxLength={4000} rows={4}/></label></p>
   <button type="submit">Publikovat po ověření všech bran</button>
  </form></details>
 </section>
 <p style={{margin:"20px"}}><Link href={`/member/snapshot/${candidateId}`}>← Snapshot</Link>
  {" · "}<strong>{data.status}</strong> · {data.revision_sha256.slice(0,12)}</p>
  <SemanticReaderLab revision={revision} original={data.source_text}/></main>;
}
