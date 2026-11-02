import {notFound} from "next/navigation";
import Link from "next/link";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import SemanticReaderLab from "@/components/editor/SemanticReaderLab";
import {verifySemanticRevision,walkSemanticAtoms} from "@/lib/semantic/compose";
import {enqueueSemanticReview,publishSemanticCandidate} from "@/app/member/editorial-pipeline/actions";
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
 <form action={enqueueSemanticReview}><input type="hidden" name="candidate_id" value={candidateId}/>
  <button type="submit">Založit tři revizní úkoly</button></form>
 <p><Link href="/member/editorial-pipeline">Redakční fronta a stav kontrol</Link></p>
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
   <button type="submit">Zařadit a ověřit ilustraci</button>
  </form>
 </details>
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
