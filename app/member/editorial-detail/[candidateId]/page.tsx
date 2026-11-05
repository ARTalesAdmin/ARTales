import Link from "next/link";
import {notFound} from "next/navigation";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {SEMANTIC_PIPELINE_ENABLED} from "@/lib/semantic/featureFlag";
import {saveCandidateEditorialField} from "./actions";
import {completeSemanticTask} from "@/app/member/editorial-pipeline/actions";
import CandidateCoverInput from "@/components/editor/CandidateCoverInput";

export const dynamic="force-dynamic";
type Metadata={author_id:string|null;collection_id:string|null;work_description:string|null;
 cover_image_path:string|null;cover_image_alt:string|null;cover_image_caption:string|null};
type Task={id:string;kind:string;status:string;assigned_to:string|null};
const labels:Record<string,string>={
 author:"Autor",collection:"Kolekce",description:"Anotace",cover:"Obálka"
};
function entryStatus(complete:boolean){
 return <span style={{fontSize:13,color:complete?"#166534":"#9a3412"}}>
  {complete?"Údaje vyplněny":"Čeká na doplnění"}
 </span>;
}
export default async function CandidateEditorialDetail({params,searchParams}:{
 params:Promise<{candidateId:string}>;searchParams:Promise<{error?:string;saved?:string;closed?:string;createdAuthorId?:string}>
}){
 if(!SEMANTIC_PIPELINE_ENABLED)notFound();
 const {candidateId}=await params;
 if(!/^[a-f0-9-]{36}$/i.test(candidateId))notFound();
 const me=await requireEditorOrAdmin();
 const db=await createClient();
 const [candidateRes,tasksRes,metadataRes,authorsRes,collectionsRes]=await Promise.all([
  db.from("work_candidates").select("id,proposed_title,proposed_author_name")
   .eq("id",candidateId).maybeSingle(),
  db.from("artales_editorial_tasks").select("id,kind,status,assigned_to")
   .eq("candidate_id",candidateId).in("status",["open","claimed","returned"]),
  db.from("artales_candidate_editorial_metadata")
   .select("author_id,collection_id,work_description,cover_image_path,cover_image_alt,cover_image_caption")
   .eq("candidate_id",candidateId).maybeSingle(),
  db.from("authors").select("id,slug,name,name_en,bio_en,bio_cs,bio,portrait_image_path,portrait_image_alt")
   .order("name").limit(250),
  db.from("collections").select("id,slug,title,title_en").order("title").limit(250)
 ]);
 if(candidateRes.error||!candidateRes.data||tasksRes.error)notFound();
 const tasks=(tasksRes.data??[]) as Task[];
 if(me.role!=="admin"&&!tasks.some(t=>t.assigned_to===me.id))notFound();
 const candidate=candidateRes.data;
 const err=await searchParams;
 const metadata:Metadata=metadataRes.data??{author_id:null,collection_id:null,work_description:null,
  cover_image_path:null,cover_image_alt:null,cover_image_caption:null};
 const authors=authorsRes.data??[];
 const collections=collectionsRes.data??[];
 const author=authors.find(a=>a.id===metadata.author_id);
 const recommendedAuthorId=metadata.author_id??(authors.some(a=>a.id===err.createdAuthorId)?err.createdAuthorId:"");
 const collection=collections.find(c=>c.id===metadata.collection_id);
 const byKind=(kind:string)=>tasks.find(t=>t.kind===kind);
 const authorized=(kind:string)=>me.role==="admin"||
  (byKind(kind)?.assigned_to===me.id&&byKind(kind)?.status==="claimed");
 const canEditAuthor=authorized("author_bio")||authorized("author_visual");
 const canEditCollection=authorized("collection_curation");
 const canEditDescription=authorized("work_description");
 const canEditCover=authorized("cover_art");
 const bioPresent=[author?.bio_en,author?.bio_cs,author?.bio].some(v=>(v??"").trim().length>=40);
 const portraitPresent=Boolean(author?.portrait_image_path&&
  (author?.portrait_image_alt??"").trim().length>=8);
 const descriptionPresent=Boolean((metadata.work_description??"").trim().length>=200);
 const coverPresent=Boolean(metadata.cover_image_path&&
  (metadata.cover_image_alt??"").trim().length>=8);
 const collectionPresent=Boolean(collection);
 const errors:Record<string,string>={
  save_failed:"Uložení se nezdařilo. Zkontroluj oprávnění a aktuální stav.",
  author_name_mismatch:"Vybraný autor neodpovídá autorovi podle námětu. Zkontroluj identitu autora.",
  select_record:"Vyber existující záznam.",unknown_author:"Autor neexistuje.",
  unknown_collection:"Kolekce neexistuje.",description_required:"Anotace musí mít 200–800 znaků.",
  cover_required:"Nahraj platnou obálku a vyplň alternativní text.",
  cover_asset_missing:"Soubor obálky nebyl nalezen v úložišti.",
  not_claimed:"Nejdřív převezmi odpovídající úkol.",invalid_input:"Neplatné údaje.",
  evidence_missing:"Chybí ověřené údaje nebo uložený soubor. Úkol zůstává otevřený.",
  qa_in_reader:"Dokončení textového QA probíhá v sémantickém editoru."
 };
 const completeForm=(kind:string,ready:boolean)=>{
  const task=byKind(kind);
  if(!task||task.assigned_to!==me.id||task.status!=="claimed")return null;
  return <div style={{marginTop:10}}>
   {ready?<form action={completeSemanticTask}>
    <input type="hidden" name="task_id" value={task.id}/>
    <button type="submit">Uzavřít úkol po kontrole uložených údajů</button>
   </form>:<p>Úkol nelze dokončit, dokud nejsou povinné údaje uložené.</p>}
  </div>;
 };
 return <main style={{maxWidth:990,margin:"24px auto",padding:"0 20px",lineHeight:1.6}}>
  <p><Link href="/member/editorial-pipeline">← Redakční úkoly</Link></p>
  <h1>Redakční detail · {candidate.proposed_title}</h1>
  <p>Autor podle námětu: {candidate.proposed_author_name}. Záznamy níže jsou pracovní
   metadata kandidáta; zveřejnění je až samostatný schvalovací krok.</p>
  {err.error?<p role="alert">{errors[err.error]??"Uložení se nezdařilo."}</p>:null}
  {err.saved?<p role="status">Údaje byly uloženy: {labels[err.saved]??err.saved}.
   {err.closed==="1"?" Odpovídající úkol je dokončený.":""}</p>:null}
  <section aria-label="Stav díla" style={{margin:"24px 0",padding:16,border:"1px solid #ddd"}}>
   <h2>Postup přípravy díla</h2>
   <p>QA a sémantická sazba se kontrolují samostatně. Ostatní položky lze připravit souběžně.</p>
   <p>{[metadata.author_id,metadata.collection_id,descriptionPresent,coverPresent].filter(Boolean).length} / 4 základních vazeb vyplněno</p>
   <progress max={4} value={[metadata.author_id,metadata.collection_id,descriptionPresent,coverPresent].filter(Boolean).length}
    aria-label="Základní metadata díla"/>
   <p><Link href={"/member/semantic/"+candidateId}>Otevřít textové QA a sémantický editor</Link></p>
  </section>

  <section id="author" style={{borderTop:"1px solid #ddd",padding:"20px 0"}}>
   <h2>Autor a jeho údaje {entryStatus(Boolean(author))}</h2>
   {canEditAuthor?<form action={saveCandidateEditorialField} style={{display:"grid",gap:10}}>
    <input type="hidden" name="candidate_id" value={candidateId}/>
    <input type="hidden" name="field" value="author"/>
    <label>Propojit s existujícím autorem
     <select name="value" defaultValue={recommendedAuthorId} required>
      <option value="" disabled>Vyber autora</option>
      {authors.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
     </select>
    </label>
    <button type="submit">Uložit vazbu na autora</button>
   </form>:<p>Úpravu provádí pověřený editor příslušného úkolu.</p>}
   <p>{author?<Link href={"/member/authors/"+author.slug+"/edit"}>Otevřít profil autora</Link>:
    <Link href={"/member/authors/new?returnTo="+encodeURIComponent("/member/editorial-detail/"+candidateId)}>
     Založit chybějícího autora</Link>}</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:18}}>
    <div><h3>Profil autora {entryStatus(bioPresent)}</h3>
     <p>Ulož biografii v profilu autora; alespoň jedna jazyková verze musí mít 40 znaků.</p>
     {completeForm("author_bio",Boolean(author)&&bioPresent)}
    </div>
    <div><h3>Vizuál autora {entryStatus(portraitPresent)}</h3>
     <p>V profilu autora nahraj portrét a vyplň alternativní popis.</p>
     {completeForm("author_visual",Boolean(author)&&portraitPresent)}
    </div>
   </div>
  </section>

  <section id="collection" style={{borderTop:"1px solid #ddd",padding:"20px 0"}}>
   <h2>Zařazení do kolekce {entryStatus(collectionPresent)}</h2>
   {canEditCollection?<form action={saveCandidateEditorialField} style={{display:"grid",gap:10}}>
    <input type="hidden" name="candidate_id" value={candidateId}/>
    <input type="hidden" name="field" value="collection"/>
    <label>Kolekce
     <select name="value" defaultValue={metadata.collection_id??""} required>
      <option value="" disabled>Vyber kolekci</option>
      {collections.map(c=><option key={c.id} value={c.id}>{c.title_en??c.title}</option>)}
     </select>
    </label>
    <button type="submit">Uložit kolekci a ověřit dokončení úkolu</button>
   </form>:<p>Kolekci přiřazuje pověřený editor.</p>}
   <p>{collection?<Link href={"/member/collections/"+collection.slug+"/edit"}>Otevřít kolekci</Link>:
    <Link href="/member/collections/new">Založit novou kolekci</Link>}</p>

  </section>

  <section id="description" style={{borderTop:"1px solid #ddd",padding:"20px 0"}}>
   <h2>Anotace díla {entryStatus(descriptionPresent)}</h2>
   {canEditDescription?<form action={saveCandidateEditorialField} style={{display:"grid",gap:10}}>
    <input type="hidden" name="candidate_id" value={candidateId}/>
    <input type="hidden" name="field" value="description"/>
    <label>Originální text anotace (200–800 znaků)
     <textarea name="value" required minLength={200} maxLength={800} rows={6}
      defaultValue={metadata.work_description??""}/>
    </label>
    <button type="submit">Uložit anotaci a ověřit dokončení úkolu</button>
   </form>:<p>Anotaci připravuje pověřený editor.</p>}

  </section>

  <section id="cover" style={{borderTop:"1px solid #ddd",padding:"20px 0"}}>
   <h2>Obálka knihy {entryStatus(coverPresent)}</h2>
   {canEditCover?<form action={saveCandidateEditorialField} style={{display:"grid",gap:10}}>
    <input type="hidden" name="candidate_id" value={candidateId}/>
    <input type="hidden" name="field" value="cover"/>
    <CandidateCoverInput candidateId={candidateId}
     initialPath={metadata.cover_image_path??""} initialAlt={metadata.cover_image_alt??""}
     initialCaption={metadata.cover_image_caption??""}/>
   </form>:<p>Obálku připravuje pověřený editor.</p>}

  </section>
  <p><Link href="/member/editorial-pipeline">← Zpět k přiděleným úkolům</Link></p>
 </main>;
}
