import {notFound} from "next/navigation";
import Link from "next/link";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import SemanticReaderLab from "@/components/editor/SemanticReaderLab";
import {verifySemanticRevision,walkSemanticAtoms} from "@/lib/semantic/compose";
import {publishSemanticCandidate} from "@/app/member/editorial-pipeline/actions";
import type {SemanticRevision} from "@/lib/semantic/model";
import {SEMANTIC_PIPELINE_ENABLED} from "@/lib/semantic/featureFlag";
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
 const {data:tasks}=await db.from("artales_editorial_tasks")
  .select("id,kind,status,assigned_to").eq("candidate_id",candidateId)
  .eq("revision_sha256",data.revision_sha256);
 const revision=data.revision as SemanticRevision;
 const atoms=walkSemanticAtoms(revision.blocks);
 const {data:visuals}=await db.from("artales_semantic_images").select("id,anchor_atom_id,storage_path,provenance,caption")
   .eq("candidate_id",candidateId).eq("revision_sha256",data.revision_sha256)
   .order("approved_at",{ascending:true});
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
    canApplyLayoutFix={profile.role==="admin"}/>
  <section id="editorial-actions" style={{maxWidth:900,margin:"32px auto",padding:"20px 24px",
    border:"1px solid #d9cfbf",borderRadius:12,background:"#faf7f0"}}>
   <h2>Redakční proces a návaznosti</h2>
   <p>Úkoly jsou založeny systémem. Nevyřešené nálezy musí projít opravou nebo zdůvodněným uzavřením. Publikace zůstává oddělená od redakčního QA.</p>
 <h3>Automatické redakční úkoly</h3>
 <p>Úkoly vznikají při uložení sémantické revize. Editor je pouze přijímá,
 kontroluje a uzavírá. Otevřené nálezy brání dokončení kontroly i publikaci.</p>
 <p>{tasks?.length??0} ze 3 kontrol založeno. {tasks?.filter(t=>t.status==="completed").length??0} dokončeno.</p>
 <p><Link href="/member/editorial-pipeline" className="ca-btn">Přejít do redakční fronty</Link></p>
 <details><summary>Ilustrace v sémantickém vydání</summary>
  <p>Originální EPUB zůstává soukromý. Originální ilustraci lze použít jen při doloženém
   právním schválení; vlastní kresbu lze přidat samostatně.</p>
  <p>Zařazené obrázky: {visuals?.length??0}</p>
  <form action={"/api/member/semantic/"+candidateId+"/image"} method="post" encType="multipart/form-data">
   <p><label>Obrázek (PNG, JPEG nebo WEBP; maximálně 5 MB)
    <input type="file" accept="image/png,image/jpeg,image/webp" name="image" required/></label></p>
   <p><label>Provenience<select name="provenance" defaultValue="original_art">
     <option value="original_art">Vlastní nebo oprávněně vytvořený vizuál</option>
     <option value="approved_original">Právně schválená původní ilustrace z EPUBu</option>
   </select></label></p>
   <p><label>Umístit za textový blok<select name="anchor_atom_id" required>
    {atoms.map(a=><option value={a.id} key={a.id}>{a.raw.trim().slice(0,90)||a.id}</option>)}
   </select></label></p>
   <p><label>Popisek <input name="caption" maxLength={300}/></label></p>
   <p><label>Právní a vizuální důkazy (100–4000 znaků)<textarea name="rights_note" minLength={100} maxLength={4000} rows={5} required/></label></p>
   <button type="submit" style={{padding:"10px 15px",borderRadius:8}}>Zařadit a ověřit ilustraci</button>
  </form>
 </details>
 <details><summary>Publikovat přesně tuto revizi po dokončení kontrol</summary>
  <form action={publishSemanticCandidate}>
   <input type="hidden" name="candidate_id" value={candidateId}/>
   <input type="hidden" name="revision_sha256" value={data.revision_sha256}/>
   <p><label>Veřejný slug <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100}/></label></p>
   <p><label>Redakční anotace (200–800 znaků)<textarea name="summary" required minLength={200} maxLength={800} rows={5}/></label></p>
   <p><label>Zdůvodnění vydání (min. 30 znaků)<textarea name="reason" required minLength={30} maxLength={4000} rows={4}/></label></p>
   <button type="submit" style={{padding:"11px 17px",borderRadius:8}}>2. Publikovat po schválení všech kontrol</button>
  </form></details>

  </section></main>;
}
