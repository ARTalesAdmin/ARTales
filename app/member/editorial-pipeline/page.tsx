import Link from "next/link";
import {notFound} from "next/navigation";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {getEditorialPeople} from "@/lib/editorial/staffDirectory";
import {
 claimSemanticTask,completeSemanticTask,requestSemanticSecondReview,
 releaseEditorialTask,reassignEditorialTask
} from "./actions";
import {SEMANTIC_PIPELINE_ENABLED} from "@/lib/semantic/featureFlag";
import {resolveEditorialHelp} from "@/app/member/editorial-help/actions";
import "@/components/editor/editorial-workspace.css";

export const dynamic="force-dynamic";
type Task={id:string;candidate_id:string;revision_sha256:string;title:string;
 status:string;kind:string;assigned_to:string|null;created_at:string;completed_by:string|null;completed_at:string|null};
const kindNames:Record<string,string>={
 text_review:"Textové QA",cover_art:"Obálka",work_description:"Anotace",
 author_visual:"Vizuál autora",author_bio:"Profil autora",
 collection_curation:"Kolekce",second_review:"Druhé posouzení",
 proofread:"Korektury",visual_review:"Vizuální QA"
};
const errorMessages:Record<string,string>={
 unavailable:"Úkol již není volný nebo není určen tobě. Aktualizuj seznam.",
 release_failed:"Úkol se nepodařilo vrátit do společné fronty.",
 reassignment_failed:"Přeřazení nebylo povoleno nebo úkol již změnil stav.",
 invalid_release_reason:"Pro uvolnění úkolu uveď důvod (20 až 1 000 znaků).",
 invalid_reassignment:"Vyber způsobilého editora a uveď důvod (20 až 1 000 znaků).",
 task_failed:"Úkol nelze dokončit. Ověř nevyřešené QA nálezy.",
 evidence_missing:"Úkol nemá uložené všechny potřebné údaje. Otevři příslušnou sekci a oprav je.",
};
type Props={searchParams:Promise<{error?:string;notice?:string}>};
export default async function EditorialPipeline({searchParams}:Props){
 if(!SEMANTIC_PIPELINE_ENABLED)notFound();
 const profile=await requireEditorOrAdmin();
 const isAdmin=profile.role==="admin";
 const db=await createClient();
 const [{data,error},people,{data:helpRequests},{data:capabilities},{data:revisions},{data:events},{data:candidates}]=await Promise.all([
  db.from("artales_editorial_tasks")
   .select("id,candidate_id,revision_sha256,title,status,kind,assigned_to,created_at,completed_at,completed_by")
   .order("created_at",{ascending:false}).limit(500),
  getEditorialPeople(),
  db.from("artales_editorial_escalations")
   .select("id,context_path,subject,details,status,assigned_to,created_by,created_at")
   .order("created_at",{ascending:false}).limit(100),
  db.from("artales_editorial_capabilities").select("profile_id,kind").eq("profile_id",profile.id),
  db.from("candidate_semantic_revisions").select("candidate_id,revision_sha256,created_at")
   .order("created_at",{ascending:false}).limit(500),
  isAdmin?db.from("artales_editorial_events").select("task_id,actor_id,action,occurred_at")
   .order("occurred_at",{ascending:false}).limit(1000):Promise.resolve({data:[]}),
  db.from("work_candidates").select("id,proposed_title,proposed_author_name")
   .order("updated_at",{ascending:false}).limit(500)
 ]);
 const query=await searchParams;
 const roster=people.filter(p=>p.id&&p.display_name&&p.is_active&&
  ["admin","editor"].includes(p.role));
 const names=new Map(people.filter(p=>p.id&&p.display_name)
  .map(p=>[p.id,p.display_name!]));
 const eligible=new Set((capabilities??[]).map(x=>x.kind));
 const currentRevisions=new Map<string,string>();
 for(const rev of revisions??[])
  if(!currentRevisions.has(rev.candidate_id))currentRevisions.set(rev.candidate_id,rev.revision_sha256);
 const candidateNames=new Map((candidates??[]).map(c=>[c.id,c]));
 const workingCandidates=[...currentRevisions.keys()].map(id=>({
  id,candidate:candidateNames.get(id),tasks:(data??[]).filter(t=>t.candidate_id===id)
 })).filter(entry=>entry.candidate)
 .sort((a,b)=>String(a.candidate?.proposed_title??"").localeCompare(
  String(b.candidate?.proposed_title??""),"cs"));
 const tasks=(data??[]) as Task[];
 const isCurrent=(t:Task)=>t.kind!=="text_review"||
  currentRevisions.get(t.candidate_id)===t.revision_sha256;
 const active=tasks.filter(t=>t.status!=="completed"&&isCurrent(t));
 const mine=active.filter(t=>t.assigned_to===profile.id);
 const available=active.filter(t=>t.assigned_to===null
   &&["open","returned"].includes(t.status)&&(isAdmin||eligible.has(t.kind)));
 const others=isAdmin?active.filter(t=>t.assigned_to!==null&&t.assigned_to!==profile.id):[];
 const finished=tasks.filter(t=>t.status==="completed");
 const help=(helpRequests??[]).filter(h=>h.assigned_to===profile.id);
 const waitingHelp=help.filter(h=>h.status==="open");
 const completedBy=new Map<string,Record<string,number>>();
 for(const t of finished){
  // Show the editor who owned and performed the work; completion actor is
  // separately recorded in the immutable task event history.
  const who=t.assigned_to??t.completed_by??"unknown";
  const kinds=completedBy.get(who)??{};
  kinds[t.kind]=(kinds[t.kind]??0)+1;
  completedBy.set(who,kinds);
 }
 const recentChanges=(events??[]).filter(e=>["claimed","returned","reassigned","completed"].includes(e.action)).slice(0,20);

 const taskHref=(t:Task)=>["text_review","second_review","proofread","visual_review"].includes(t.kind)
  ?"/member/semantic/"+t.candidate_id
  :"/member/editorial-detail/"+t.candidate_id+"#"+(
   t.kind==="cover_art"?"cover":t.kind==="collection_curation"?"collection":
   t.kind==="work_description"?"description":"author"
  );
 const actionName=(t:Task)=>["text_review","second_review","proofread","visual_review"].includes(t.kind)
  ?"Otevřít kontrolu ↗":t.kind==="cover_art"?"Otevřít obálku ↗":
   t.kind==="collection_curation"?"Přiřadit kolekci ↗":
   t.kind==="work_description"?"Upravit anotaci ↗":"Otevřít autora ↗";
 const stateName=(t:Task)=>t.status==="claimed"?"Rozpracováno":
  t.status==="returned"?"Vráceno":t.status==="completed"?"Dokončeno":"Připraveno";
 function taskCard(t:Task,mode:"mine"|"available"|"admin"){
  const canClaim=(mode==="mine"||mode==="available")&&["open","returned"].includes(t.status);
  const isClaimed=t.status==="claimed";
  const isText=t.kind==="text_review";
  const isMetadata=["cover_art","collection_curation","work_description","author_bio","author_visual"].includes(t.kind);
  return <article key={t.id}
   className={"ed-task "+(mode==="mine"?"ed-task--mine":mode==="available"?"ed-task--available":"")}>
   <div className="ed-task__top">
    <div>
     <span className="ed-task__category">{kindNames[t.kind]??t.kind}</span>
     <h3>{t.title}</h3>
     <p className="ed-task__meta">
      {t.assigned_to?names.get(t.assigned_to)??"Pověřený editor":"Volný úkol"}
      {" · "}{t.kind==="text_review"?"Kontrola sémantické revize":"Příprava knihy"}
     </p>
    </div>
    <span className={"ed-status "+(isClaimed?"ed-status--claimed":"")}>{stateName(t)}</span>
   </div>
   <div className="ed-task__bottom">
    <p className="ed-task__hint">
     {isText?"Zkontroluj sazbu a nálezy. Případné opravy se před vydáním znovu ověřují.":
       isMetadata?"Otevři odpovídající oblast a ulož skutečný výsledek. Potvrzení hlídá systém.":
       "Výsledek kontroly zaznamenej po dokončení práce."}
    </p>
    <div className="ed-task__actions">
     {canClaim?<form action={claimSemanticTask}>
      <input type="hidden" name="task_id" value={t.id}/>
      <button className="ed-button" type="submit">{mode==="available"?"Převzít úkol":"Začít pracovat"}</button>
     </form>:null}
     <Link className={"ed-button "+(canClaim?"ed-button--soft":"")}
      href={taskHref(t)}>{actionName(t)}</Link>
    </div>
   </div>
   {mode==="mine"&&isClaimed&&["proofread","second_review","visual_review"].includes(t.kind)?
    <details className="ed-disclosure">
     <summary>Dokončení kontroly</summary>
     <div className="ed-disclosure__body">
      <form className="ed-form-grid" action={completeSemanticTask}>
       <input type="hidden" name="task_id" value={t.id}/>
       <label>Výsledek kontroly
        <textarea name="evidence_note" minLength={40} maxLength={4000} required rows={3}
         placeholder="Co bylo ověřeno a s jakým výsledkem?"/>
       </label>
       <button className="ed-button" type="submit">Dokončit kontrolu ✓</button>
      </form>
     </div>
    </details>:null}
   {mode==="mine"&&isClaimed&&isText?
    <p className="ed-quiet" style={{margin:"11px 0 0"}}>Textové QA dokončíš po kontrole změn v sémantickém editoru.</p>:null}
   {mode==="mine"&&["text_review","work_description","author_bio","second_review","proofread"].includes(t.kind)?
    <details className="ed-disclosure">
     <summary>Potřebuji úkol předat</summary>
     <div className="ed-disclosure__body">
      <form className="ed-form-grid" action={releaseEditorialTask}>
       <input type="hidden" name="task_id" value={t.id}/>
       <label>Důvod předání
        <textarea name="reason" required minLength={20} maxLength={1000} rows={2}/>
       </label>
       <button className="ed-button ed-button--soft" type="submit">Vrátit do společné fronty</button>
      </form>
     </div>
    </details>:null}
   {mode==="mine"&&isClaimed&&t.kind!=="second_review"?
    <details className="ed-disclosure">
     <summary>Požádat o druhé posouzení</summary>
     <div className="ed-disclosure__body">
      <form className="ed-form-grid" action={requestSemanticSecondReview}>
       <input type="hidden" name="task_id" value={t.id}/>
       <label>Další editor
        <select name="reviewer_id" required defaultValue="">
         <option value="" disabled>Vyber editora…</option>
         {roster.filter(p=>p.id!==profile.id).map(p=><option value={p.id} key={p.id}>{p.display_name}</option>)}
        </select>
       </label>
       <label>Důvod nové kontroly
        <textarea name="reason" required minLength={40} maxLength={4000} rows={3}/>
       </label>
       <button className="ed-button ed-button--soft" type="submit">Požádat o kontrolu</button>
      </form>
     </div>
    </details>:null}
   {isAdmin&&t.status!=="completed"&&roster.length>1?
    <details className="ed-disclosure">
     <summary>Přeřadit úkol</summary>
     <div className="ed-disclosure__body">
      <form className="ed-form-grid" action={reassignEditorialTask}>
       <input type="hidden" name="task_id" value={t.id}/>
       <label>Nový vlastník
        <select name="assignee_id" required defaultValue="">
         <option value="" disabled>Vyber editora…</option>
         {roster.filter(p=>p.id!==t.assigned_to).map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}
        </select>
       </label>
       <label>Důvod přeřazení
        <textarea name="reason" required minLength={20} maxLength={1000} rows={2}/>
       </label>
       <button className="ed-button ed-button--soft" type="submit">Přeřadit a zaznamenat</button>
      </form>
     </div>
    </details>:null}
  </article>;
 }
 return <main className="ed-page">
  <nav className="ed-breadcrumb" aria-label="Drobečková navigace">
   <Link href="/member">Interní zóna</Link><span className="ed-breadcrumb__sep">/</span>
   <span>Redakční práce</span>
  </nav>
  <header className="ed-hero">
   <p className="ed-eyebrow">ARTales · Redakční studio</p>
   <div className="ed-hero__row">
    <div>
     <h1>Moje redakční práce</h1>
     <p className="ed-hero__subtitle">Jeden přehled všech kroků od převzetí knihy po schválení.
      Otevři přiřazený úkol, nebo si vyber další volnou práci. Změny se průběžně evidují.</p>
    </div>
    <div className="ed-hero__actions">
     <a className="ed-button" href="#dalsi-titul">Chci zpracovat další titul ↘</a>
    </div>
   </div>
  </header>
  <div className="ed-stats" aria-label="Přehled redakční práce">
   <div className="ed-stat"><strong className="ed-stat__value">{mine.length}</strong>
    <span className="ed-stat__label">Moje aktivní úkoly</span></div>
   <div className="ed-stat"><strong className="ed-stat__value">{available.length}</strong>
    <span className="ed-stat__label">Volné úkoly pro mě</span></div>
   <div className="ed-stat"><strong className="ed-stat__value">{waitingHelp.length}</strong>
    <span className="ed-stat__label">Žádosti o pomoc</span></div>
  </div>
  <section id="rozpracovana-dila" className="ed-section" aria-label="Redakční díla">
   <div className="ed-section__head"><div>
    <h2 className="ed-section__title">Redakční díla</h2>
    <p className="ed-section__description">Trvalý přehled připravovaných titulů. Nezmizí po dokončení posledního úkolu.</p>
   </div></div>
   <div className="ed-task-grid">
    {workingCandidates.filter(entry=>isAdmin||entry.tasks.some(t=>t.assigned_to===profile.id))
      .map(entry=><article className="ed-task" key={entry.id}>
       <div className="ed-task__top">
        <div><h3>{entry.candidate?.proposed_title}</h3>
         <p className="ed-task__meta">{entry.candidate?.proposed_author_name}</p></div>
        <span className="ed-status">
         {entry.tasks.some(t=>t.status==="open"||t.status==="claimed"||t.status==="returned")
          ?"V přípravě":"Redakční úkoly dokončeny"}
        </span>
       </div>
       <div className="ed-task__bottom">
        <p className="ed-task__hint">QA, ostatní podklady a stav vydání na jednom místě.</p>
        <div className="ed-task__actions">
         <Link className="ed-button" href={"/member/editorial-detail/"+entry.id}>
          Otevřít kartu díla ↗
         </Link>
        </div>
       </div>
      </article>)}
   </div>
  </section>
  <nav className="ed-jump-nav" aria-label="Sekce redakční práce">
   <a href="#moje-prace">Moje práce</a>
   <a href="#dalsi-titul">Volné úkoly</a>
   {waitingHelp.length?<a href="#zadosti">Žádosti o pomoc</a>:null}
   {isAdmin?<a href="#prehled-garanta">Přehled garanta</a>:null}
  </nav>
  {query.error?<div className="ed-notice ed-notice--error" role="alert">
   {errorMessages[query.error]??"Akci se nepodařilo dokončit."}</div>:null}
  {query.notice?<div className="ed-notice" role="status">
   ✓ Změna úkolu byla zaznamenána.</div>:null}
  {error?<div className="ed-notice ed-notice--error" role="alert">Redakční úkoly nejsou dostupné.</div>:null}
  <section id="moje-prace" className="ed-section" aria-labelledby="ed-mine-title">
   <div className="ed-section__head">
    <div><h2 className="ed-section__title" id="ed-mine-title">Moje práce</h2>
     <p className="ed-section__description">Úkoly, které máš aktuálně na starosti.</p></div>
    <span className="ed-count">{mine.length}</span>
   </div>
   {mine.length?<div className="ed-task-grid">{mine.map(t=>taskCard(t,"mine"))}</div>:
    <p className="ed-empty">Aktuálně nemáš žádný rozpracovaný úkol. Vyber si další práci z nabídky níže.</p>}
  </section>
  {waitingHelp.length?<section id="zadosti" className="ed-section">
   <div className="ed-section__head"><h2 className="ed-section__title">Žádosti o pomoc</h2>
    <span className="ed-count">{waitingHelp.length}</span></div>
   {help.map(h=><article key={h.id} className="ed-request">
    <h3>{h.subject}</h3>
    <p>{h.details}</p>
    <Link className="ed-button ed-button--soft ed-button--compact" href={h.context_path}>Otevřít místo problému ↗</Link>
    {h.status==="open"&&isAdmin?<details className="ed-disclosure">
     <summary>Uzavřít vyřešenou žádost</summary>
     <div className="ed-disclosure__body">
      <form className="ed-form-grid" action={resolveEditorialHelp}>
       <input type="hidden" name="id" value={h.id}/>
       <label>Výsledek řešení
        <textarea required minLength={20} maxLength={4000} name="note" rows={3}/>
       </label>
       <button className="ed-button" type="submit">Potvrdit vyřešení ✓</button>
      </form>
     </div>
    </details>:null}
   </article>)}
  </section>:null}
  <section id="dalsi-titul" className="ed-section">
   <div className="ed-section__head">
    <div><h2 className="ed-section__title">Chci zpracovat další titul</h2>
     <p className="ed-section__description">Jen dostupná práce podle tvých kompetencí. Převzetí je výhradní a evidované.</p></div>
    <span className="ed-count">{available.length}</span>
   </div>
   {available.length?<div className="ed-task-grid">{available.map(t=>taskCard(t,"available"))}</div>:
    <p className="ed-empty">Teď není volný žádný vhodný úkol. Práci již převzatou kolegyní nelze převzít bez předání.</p>}
  </section>
  {isAdmin?<section id="prehled-garanta" className="ed-section">
   <div className="ed-section__head">
    <div><h2 className="ed-section__title">Přehled redakce</h2>
     <p className="ed-section__description">Ostatní přidělené úkoly, historie a výsledky. Přeřazení je auditované.</p></div>
    <span className="ed-count">{others.length} přiřazených</span>
   </div>
   {others.length?<div className="ed-task-grid">{others.map(t=>taskCard(t,"admin"))}</div>:
    <p className="ed-empty">Ostatní editorky nemají aktivní přidělené úkoly.</p>}
   <div className="ed-section" style={{marginTop:22}}>
    <div className="ed-section__head"><h3 className="ed-section__title">Dokončená práce</h3>
     <span className="ed-count">{finished.length}</span></div>
    {completedBy.size?<div className="ed-table-wrap"><table className="ed-table">
     <thead><tr><th>Editor</th><th>Hotovo</th><th>Druhy práce</th></tr></thead>
     <tbody>{[...completedBy.entries()].map(([person,byKind])=>
      <tr key={person}><td>{names.get(person)??"Neznámý"}</td>
       <td>{Object.values(byKind).reduce((a,b)=>a+b,0)}</td>
       <td>{Object.entries(byKind).map(([k,n])=>`${kindNames[k]??k}: ${n}`).join(" · ")}</td></tr>)}</tbody>
    </table></div>:<p className="ed-empty">Zatím nejsou evidované dokončené úkoly.</p>}
   </div>
   <details className="ed-disclosure">
    <summary>Poslední redakční události</summary>
    <div className="ed-disclosure__body">
     {recentChanges.length?<ol className="ed-log">{recentChanges.map((e,i)=>
      <li key={e.task_id+"-"+e.occurred_at+"-"+i}>
       {names.get(e.actor_id)??"Editor"} · {e.action} · {new Date(e.occurred_at).toLocaleString("cs-CZ")}
      </li>)}</ol>:<p className="ed-quiet">Žádné události nejsou evidované.</p>}
    </div>
   </details>
  </section>:null}
 </main>;
}
