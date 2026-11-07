import Link from "next/link";
import {notFound} from "next/navigation";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {SEMANTIC_PIPELINE_ENABLED} from "@/lib/semantic/featureFlag";
import {saveCandidateEditorialField} from "./actions";
import {completeSemanticTask,publishSemanticCandidate} from "@/app/member/editorial-pipeline/actions";
import {assessEditorialRelease} from "@/lib/editorial/releaseReadiness";
import {slugify} from "@/lib/slug";
import CandidateCoverInput from "@/components/editor/CandidateCoverInput";
import CandidateBilingualAnnotationFields from "@/components/editor/CandidateBilingualAnnotationFields";
import "@/components/editor/editorial-workspace.css";

export const dynamic="force-dynamic";
type Metadata={author_id:string|null;collection_id:string|null;work_description_cs:string|null;work_description_en:string|null;
 cover_image_path:string|null;cover_image_alt:string|null;cover_image_caption:string|null};
type Task={id:string;kind:string;status:string;assigned_to:string|null;revision_sha256:string};
const labels:Record<string,string>={
 author:"Autor",collection:"Kolekce",description:"Anotace",cover:"Obálka"
};
function entryStatus(complete:boolean){
 return <span className={"ed-status "+(complete?"ed-status--complete":"")}>
  {complete?"Podklady vyplněny":"Podklady chybí"}
 </span>;
}
export default async function CandidateEditorialDetail({params,searchParams}:{
 params:Promise<{candidateId:string}>;searchParams:Promise<{error?:string;saved?:string;closed?:string;closeout?:string;createdAuthorId?:string;createdCollectionId?:string}>
}){
 if(!SEMANTIC_PIPELINE_ENABLED)notFound();
 const {candidateId}=await params;
 if(!/^[a-f0-9-]{36}$/i.test(candidateId))notFound();
 const me=await requireEditorOrAdmin();
 const db=await createClient();
 const [candidateRes,tasksRes,metadataRes,authorsRes,collectionsRes,revisionRes,
  legalLockRes,snapshotRes,snapshotReviewRes,publicationRes,qaFlagRes,reviewDecisionRes,aiJobsRes]=await Promise.all([
  db.from("work_candidates").select("id,proposed_title,proposed_author_name")
   .eq("id",candidateId).maybeSingle(),
  db.from("artales_editorial_tasks").select("id,kind,status,assigned_to,revision_sha256")
   .eq("candidate_id",candidateId).order("created_at",{ascending:false}),
  db.from("artales_candidate_editorial_metadata")
   .select("author_id,collection_id,work_description_cs,work_description_en,cover_image_path,cover_image_alt,cover_image_caption")
   .eq("candidate_id",candidateId).maybeSingle(),
  db.from("authors").select("id,slug,name,name_en,bio_en,bio_cs,bio,portrait_image_path,portrait_image_alt")
   .order("name").limit(250),
  db.from("collections").select("id,slug,title,title_en,description_cs,description_en").order("title").limit(250),
  db.from("candidate_semantic_revisions").select("revision_sha256,status,image_selection,revision")
   .eq("candidate_id",candidateId).order("created_at",{ascending:false})
   .order("id",{ascending:false}).limit(1).maybeSingle(),
  db.from("candidate_legal_locks").select("decision_no,source_id")
   .eq("candidate_id",candidateId).maybeSingle(),
  db.from("candidate_snapshots").select("sha256,publication_authorized,semantic_ready")
   .eq("candidate_id",candidateId).maybeSingle(),
  db.from("candidate_snapshot_reviews").select("snapshot_sha256,text_correspondence,image_disposition")
   .eq("candidate_id",candidateId).order("reviewed_at",{ascending:false})
   .order("id",{ascending:false}).limit(1).maybeSingle(),
  db.from("artales_semantic_publications").select("candidate_id,work_id")
   .eq("candidate_id",candidateId).maybeSingle(),
  db.from("artales_semantic_qa_flags").select("status").eq("candidate_id",candidateId),
  db.from("artales_semantic_change_reviews").select("revision_sha256,issue_id,decision")
   .eq("candidate_id",candidateId),
  db.from("artales_semantic_ai_qa_jobs").select("status,revision_sha256")
   .eq("candidate_id",candidateId).in("status",["queued","running"])
 ]);
 if(candidateRes.error||!candidateRes.data||tasksRes.error)notFound();
 const tasks=(tasksRes.data??[]) as Task[];
 // Keep the page owner-bound: completed assignments remain visible for status
 // badges, but a non-admin needs at least one active assignment for access.
 // Completed work stays readable to its owner. Edits remain checked by their own RPC.
 if(me.role!=="admin"&&!tasks.some(t=>t.assigned_to===me.id))notFound();
 const candidate=candidateRes.data;
 const err=await searchParams;
 const metadata:Metadata=metadataRes.data??{author_id:null,collection_id:null,work_description_cs:null,work_description_en:null,
  cover_image_path:null,cover_image_alt:null,cover_image_caption:null};
 const authors=authorsRes.data??[];
 const collections=collectionsRes.data??[];
 const author=authors.find(a=>a.id===metadata.author_id);
 const recommendedAuthorId=metadata.author_id??(authors.some(a=>a.id===err.createdAuthorId)?err.createdAuthorId:"");
 const collection=collections.find(c=>c.id===metadata.collection_id);
 const recommendedCollectionId=metadata.collection_id??(collections.some(c=>c.id===err.createdCollectionId)?err.createdCollectionId:"");
 const byKind=(kind:string)=>tasks.find(t=>t.kind===kind);
 const taskStatus=(kind:string)=>{
  const task=byKind(kind);
  if(!task)return null;
  const label=task.status==="completed"?"Dokončeno":
   task.status==="claimed"?"Rozpracováno":
   task.status==="returned"?"Vráceno":
   task.status==="open"?"Přiřazeno":"Nahrazeno";
  return <span className={"ed-status "+(task.status==="completed"?"ed-status--complete":
    task.status==="claimed"?"ed-status--claimed":"")}>Úkol: {label}</span>;
 };
 const authorized=(kind:string)=>me.role==="admin"||
  (byKind(kind)?.assigned_to===me.id&&byKind(kind)?.status==="claimed");
 const canEditAuthor=authorized("author_bio")||authorized("author_visual");
 const canEditCollection=authorized("collection_curation");
 const canEditDescription=authorized("work_description");
 const canEditCover=authorized("cover_art");
 const bioPresent=[author?.bio_en,author?.bio_cs].every(v=>
  (v??"").trim().length>=200&&(v??"").trim().length<=800);
 const portraitPresent=Boolean(author?.portrait_image_path&&
  (author?.portrait_image_alt??"").trim().length>=8);
 const descriptionPresent=[metadata.work_description_cs,metadata.work_description_en].every(v=>
  (v??"").trim().length>=200&&(v??"").trim().length<=800);
 const coverPresent=Boolean(metadata.cover_image_path&&
  (metadata.cover_image_alt??"").trim().length>=8);
 const collectionPresent=Boolean(collection&&
   [collection.description_cs,collection.description_en].every(v=>
    (v??"").trim().length>=200&&(v??"").trim().length<=800));
 const errors:Record<string,string>={
  save_failed:"Uložení se nezdařilo. Zkontroluj oprávnění a aktuální stav.",
  author_name_mismatch:"Vybraný autor neodpovídá autorovi podle námětu. Zkontroluj identitu autora.",
  bilingual_description_required:"Vyplň českou i anglickou anotaci (každou 200–800 znaků).",
  bilingual_required:"Původní jednojazyčné uložení není povolené.",
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
  if(!task||task.assigned_to!==me.id)return null;
  if(task.status==="completed")return <p className="ed-quiet">Úkol je uzavřený a již se nezobrazuje v aktivní práci.</p>;
  if(task.status!=="claimed")return null;
  return <div>
   {ready?<form action={completeSemanticTask}>
    <input type="hidden" name="task_id" value={task.id}/>
    <button className="ed-button ed-button--soft ed-button--compact" type="submit">Dokončit ověřený úkol ✓</button>
   </form>:<p className="ed-quiet">Nejprve doplň a ulož potřebné údaje.</p>}
  </div>;
 };
 const latest=revisionRes.data;
 const currentIssues=Array.isArray(latest?.revision?.review_issues)?
   latest.revision.review_issues.filter((issue:{round?:number})=>issue.round===latest.revision.round):[];
 const decisions=reviewDecisionRes.data??[];
 const legalDecision=legalLockRes.data?await db.from("candidate_legal_decisions")
  .select("verdict,territory").eq("candidate_id",candidateId)
  .eq("source_id",legalLockRes.data.source_id)
  .eq("decision_no",legalLockRes.data.decision_no).maybeSingle():null;
 const releaseState=assessEditorialRelease({
  latestSha:latest?.revision_sha256??null,
  revisionStatus:latest?.status??null,imageSelection:latest?.image_selection??null,
  legalApproved:legalDecision?.data?.verdict==="approved"&&legalDecision.data.territory==="CZ/EU",
  snapshotConfirmed:Boolean(snapshotRes.data&&snapshotReviewRes.data&&
   snapshotRes.data.sha256===snapshotReviewRes.data.snapshot_sha256&&
   snapshotReviewRes.data.text_correspondence==="confirmed"&&
   snapshotReviewRes.data.image_disposition==="exclude_all"),
  published:Boolean(publicationRes.data),tasks,
  openFindings:qaFlagRes.error?null:(qaFlagRes.data??[]).filter(flag=>flag.status==="open").length,
  unacceptedChanges:reviewDecisionRes.error?null:currentIssues.filter(
   (issue:{id:string})=>!decisions.some(d=>d.revision_sha256===latest?.revision_sha256&&
    d.issue_id===issue.id&&d.decision==="accepted")).length,
  pendingAi:Boolean(aiJobsRes.error||(aiJobsRes.data??[]).length>0),
  metadata:{authorId:metadata.author_id,collectionId:metadata.collection_id,
   descriptionCs:metadata.work_description_cs,descriptionEn:metadata.work_description_en,
   coverPath:metadata.cover_image_path,coverAlt:metadata.cover_image_alt},
  author:author?{bioCs:author.bio_cs,bioEn:author.bio_en,
   portraitPath:author.portrait_image_path,portraitAlt:author.portrait_image_alt}:null,
  collection:collection?{descriptionCs:collection.description_cs,
   descriptionEn:collection.description_en}:null
 });
 const sections=[
  {id:"author",label:"Autor",done:Boolean(author)},
  {id:"collection",label:"Kolekce",done:collectionPresent},
  {id:"description",label:"Anotace",done:descriptionPresent},
  {id:"cover",label:"Obálka",done:coverPresent}
 ];
 const completedCount=sections.filter(x=>x.done).length;
 return <main className="ed-page" id="editorial-detail">
  <nav className="ed-breadcrumb" aria-label="Drobečková navigace">
   <Link href="/member/editorial-pipeline">Redakční práce</Link>
   <span className="ed-breadcrumb__sep">/</span>
   <span>{candidate.proposed_title}</span>
  </nav>
  <header className="ed-hero">
   <p className="ed-eyebrow">ARTales · Redakční příprava</p>
   <div className="ed-hero__row">
    <div>
     <h1>{candidate.proposed_title}</h1>
     <p className="ed-hero__subtitle">{candidate.proposed_author_name} · Pracovní karta díla.
      Doplň údaje, které později převezme publikovaná kniha. Každá oblast má vlastní kontrolu.</p>
    </div>
    <div className="ed-hero__actions">
     <Link className="ed-button ed-button--soft" href="/member/editorial-pipeline">← Moje úkoly</Link>
     <Link className="ed-button" href={"/member/semantic/"+candidateId}>Otevřít textové QA ↗</Link>
     <a className="ed-button ed-button--soft" href="#publication-readiness">Stav vydání ↘</a>
    </div>
   </div>
  </header>
  {err.error?<div className="ed-notice ed-notice--error" role="alert">{errors[err.error]??"Uložení se nezdařilo."}</div>:null}
  {err.saved?<div className="ed-notice" role="status">✓ Údaje byly uloženy: {labels[err.saved]??err.saved}.
   {err.closed==="1"?" Odpovídající úkol byl zároveň uzavřen.":""}</div>:null}
  {err.closeout==="pending"?<div className="ed-notice ed-notice--error" role="alert">
   Údaje jsou uložené, ale úkol nebylo možné dokončit. Zkontroluj povinné podklady;
   úkol zůstává rozpracovaný.</div>:null}
  <section className="ed-progress" aria-label="Postup přípravy díla">
   <div className="ed-progress__row"><strong>Příprava díla</strong>
    <span className="ed-progress__count">{completedCount} ze 4 oblastí má vyplněné podklady</span>
   </div>
   <progress value={completedCount} max={4} aria-label="Vyplněná základní metadata"/>
   <p className="ed-quiet" style={{margin:"10px 0 0"}}>Základní metadata může redakce připravovat souběžně.
    Textové QA a schválení vydání jsou samostatné kroky.</p>
   <nav className="ed-progress__links" aria-label="Oblasti karty">
    {sections.map(section=><a key={section.id} href={"#"+section.id}
      data-ready={section.done}>{section.label}{section.done?" · vyplněno":" · čeká"}</a>)}
   </nav>
  </section>
  <section id="publication-readiness" className="ed-card" aria-label="Stav přípravy k publikaci">
   <div className="ed-card__head"><div className="ed-card__heading">
    <span className="ed-card__number">✓</span><div>
     <h2>Vydání díla</h2>
     <p className="ed-card__lead">QA, redakční podklady a závěrečné schválení na jednom místě.</p>
    </div></div>
    <div className="ed-card__statuses">
     <span className={"ed-status "+(releaseState.ready?"ed-status--complete":"")}>
      {publicationRes.data?"Publikováno":releaseState.ready?"Připraveno ke schválení":"Čeká na podklady"}
     </span>
    </div>
   </div>
   <div className="ed-card__body">
    {releaseState.blockers.length?<ul className="ed-release-checklist">
     {releaseState.blockers.map(blocker=><li key={blocker}>{blocker}</li>)}
    </ul>:<p>Všechny evidované podmínky jsou splněné. Před vydáním zkontroluj veřejný náhled.</p>}
    {snapshotRes.data&&!snapshotRes.data.publication_authorized?
     <p className="ed-quiet">Archivní snapshot zatím nemá potvrzení publication_authorized.
      Před vydáním je nutné dokončit nezávislé ověření zdroje.</p>:null}
    {publicationRes.data?<p>Dílo je již v katalogu.</p>:
     me.role==="admin"?<form action={publishSemanticCandidate} className="ed-release-form">
      <input type="hidden" name="candidate_id" value={candidateId}/>
      <input type="hidden" name="revision_sha256" value={latest?.revision_sha256??""}/>
      <p><strong>Veřejná adresa:</strong> /work/{slugify(candidate.proposed_title)}</p>
      <label>Odůvodnění konečného schválení
       <textarea name="reason" rows={3} minLength={30} maxLength={4000} required
        placeholder="Uveď věcný důvod schválení této konkrétní revize."/>
      </label>
      <button className="ed-button" type="submit" disabled={!releaseState.ready||!snapshotRes.data?.publication_authorized}>
       Schválit a publikovat dílo
      </button>
     </form>:<p className="ed-quiet">Zveřejnění potvrzuje pouze administrátor.</p>}
    <p className="ed-quiet">Dokončení posledního úkolu samo publikaci nespouští.</p>
   </div>
  </section>
  <div className="ed-detail-grid">
   <div className="ed-detail-content">
    <section id="author" className="ed-card" aria-labelledby="ed-author-title">
     <div className="ed-card__head">
      <div className="ed-card__heading"><span className="ed-card__number">01</span>
       <div><h2 id="ed-author-title">Autor díla</h2>
        <p className="ed-card__lead">Propoj správného autora, doplň profil a portrét.</p></div>
      </div>
      <div className="ed-card__statuses">{entryStatus(Boolean(author))}</div>
     </div>
     <div className="ed-card__body">
      {canEditAuthor?<form className="ed-card__form" action={saveCandidateEditorialField}>
       <input type="hidden" name="candidate_id" value={candidateId}/>
       <input type="hidden" name="field" value="author"/>
       <label className="ed-label">Autor v katalogu
        <select name="value" defaultValue={recommendedAuthorId} required>
         <option value="" disabled>Vyber autora…</option>
         {authors.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
       </label>
       <button className="ed-button" type="submit">Uložit autora ↗</button>
      </form>:<p className="ed-quiet">Změny může ukládat pověřený editor tohoto úkolu.</p>}
      <div className="ed-inline-links">
       {author?<Link className="ed-inline-link" href={"/member/authors/"+author.slug+"/edit"}>Upravit profil autora ↗</Link>:
       <Link className="ed-inline-link" href={"/member/authors/new?returnTo="+encodeURIComponent("/member/editorial-detail/"+candidateId)}>
        + Založit chybějícího autora</Link>}
      </div>
      <div className="ed-related">
       <div className="ed-related__item">
        <h3>Životopis</h3><div className="ed-card__statuses">{entryStatus(bioPresent)}{taskStatus("author_bio")}</div>
        <p>Česká i anglická biografie autora musí mít každá 200–800 znaků.</p>
        {completeForm("author_bio",Boolean(author)&&bioPresent)}
       </div>
       <div className="ed-related__item">
        <h3>Portrét</h3><div className="ed-card__statuses">{entryStatus(portraitPresent)}{taskStatus("author_visual")}</div>
        <p>V profilu autora nahraj obrázek a doplň alternativní popis.</p>
        {completeForm("author_visual",Boolean(author)&&portraitPresent)}
       </div>
      </div>
     </div>
    </section>
    <section id="collection" className="ed-card" aria-labelledby="ed-collection-title">
     <div className="ed-card__head">
      <div className="ed-card__heading"><span className="ed-card__number">02</span>
       <div><h2 id="ed-collection-title">Zařazení do kolekce</h2>
        <p className="ed-card__lead">Vyber kolekci, do které bude dílo patřit.</p></div>
      </div>
      <div className="ed-card__statuses">{entryStatus(collectionPresent)}{taskStatus("collection_curation")}</div>
     </div>
     <div className="ed-card__body">
      {canEditCollection?<form className="ed-card__form" action={saveCandidateEditorialField}>
       <input type="hidden" name="candidate_id" value={candidateId}/>
       <input type="hidden" name="field" value="collection"/>
       <label className="ed-label">Kolekce díla
        <select name="value" defaultValue={recommendedCollectionId} required>
         <option value="" disabled>Vyber kolekci…</option>
         {collections.map(c=><option key={c.id} value={c.id}>{c.title_en??c.title}</option>)}
        </select>
       </label>
       <button className="ed-button" type="submit">Uložit kolekci ✓</button>
       <small className="ed-help">Dokončení vyžaduje také český i anglický popis kolekce, každý 200–800 znaků.</small>
      </form>:<p className="ed-quiet">Kolekci vybírá pověřený editor.</p>}
      <div className="ed-inline-links">
       {collection?<Link className="ed-inline-link" href={"/member/collections/"+collection.slug+"/edit"}>Upravit kolekci ↗</Link>:
        <Link className="ed-inline-link" href={"/member/collections/new?returnTo="+encodeURIComponent("/member/editorial-detail/"+candidateId)}>+ Vytvořit novou kolekci</Link>}
      </div>
     </div>
    </section>
    <section id="description" className="ed-card" aria-labelledby="ed-description-title">
     <div className="ed-card__head">
      <div className="ed-card__heading"><span className="ed-card__number">03</span>
       <div><h2 id="ed-description-title">Anotace knihy</h2>
        <p className="ed-card__lead">Povinná česká i anglická anotace. Každá 200–800 znaků.</p></div>
      </div>
      <div className="ed-card__statuses">{entryStatus(descriptionPresent)}{taskStatus("work_description")}</div>
     </div>
     <div className="ed-card__body">
      {canEditDescription?<form className="ed-card__form" action={saveCandidateEditorialField}>
       <input type="hidden" name="candidate_id" value={candidateId}/>
       <input type="hidden" name="field" value="description"/>
       <CandidateBilingualAnnotationFields
        initialCs={metadata.work_description_cs??""}
        initialEn={metadata.work_description_en??""}/>
      </form>:<p className="ed-quiet">Anotaci připravuje pověřený editor.</p>}
     </div>
    </section>
    <section id="cover" className="ed-card" aria-labelledby="ed-cover-title">
     <div className="ed-card__head">
      <div className="ed-card__heading"><span className="ed-card__number">04</span>
       <div><h2 id="ed-cover-title">Obálka díla</h2>
        <p className="ed-card__lead">Připrav veřejný vizuál a jeho přístupný popis.</p></div>
      </div>
      <div className="ed-card__statuses">{entryStatus(coverPresent)}{taskStatus("cover_art")}</div>
     </div>
     <div className="ed-card__body">
      {canEditCover?<form className="ed-card__form" action={saveCandidateEditorialField}>
       <input type="hidden" name="candidate_id" value={candidateId}/>
       <input type="hidden" name="field" value="cover"/>
       <CandidateCoverInput candidateId={candidateId}
        initialPath={metadata.cover_image_path??""}
        initialAlt={metadata.cover_image_alt??""}
        initialCaption={metadata.cover_image_caption??""}/>
      </form>:<p className="ed-quiet">Obálku připravuje pověřený editor.</p>}
     </div>
    </section>
   </div>
   <aside className="ed-sidebar" aria-label="Přehled práce">
    <div className="ed-aside-card">
     <p className="ed-eyebrow">Stav přípravy</p>
     <h2>Co ještě zbývá?</h2>
     <ul className="ed-aside-card__list">{sections.map(section=><li key={section.id}>
      <span className="ed-aside-bullet" data-ready={section.done}/>
      <a href={"#"+section.id}>{section.label}{section.done?" · připraveno":" · čeká"}</a>
     </li>)}</ul>
    </div>
    <div className="ed-aside-card">
     <p className="ed-eyebrow">Samostatný krok</p>
     <h2>Textové QA</h2>
     <p>Text, sémantické bloky a opravy se posuzují ve vlastním editoru. Sazba nesmí měnit originální text.</p>
     <Link className="ed-button ed-button--soft" href={"/member/semantic/"+candidateId}>Otevřít QA ↗</Link>
    </div>
    <div className="ed-aside-card">
     <h2>Redakční úkoly</h2>
     <p>Vlastnictví, převzetí a dokončení se evidují samostatně. Uložené údaje jsou podmínkou uzavření úkolu.</p>
     <Link className="ed-inline-link" href="/member/editorial-pipeline">Zpět do redakční fronty ↗</Link>
    </div>
   </aside>
  </div>
 </main>;
}
