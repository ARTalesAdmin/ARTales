import Link from "next/link";
import {notFound} from "next/navigation";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {
 claimSemanticTask,completeSemanticTask,requestSemanticSecondReview,
 releaseEditorialTask,reassignEditorialTask,completeMethodologyReview
} from "./actions";
import {SEMANTIC_PIPELINE_ENABLED} from "@/lib/semantic/featureFlag";
import {resolveEditorialHelp} from "@/app/member/editorial-help/actions";

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
 methodology_conclusion_required:"Závěr revize metodiky musí obsahovat alespoň 25 znaků.",
 methodology_review_failed:"Revize metodiky nebyla dokončena.",
 evidence_missing:"Úkol nemá uložené všechny potřebné údaje. Otevři příslušnou sekci a oprav je.",
};
type Props={searchParams:Promise<{error?:string;notice?:string}>};
export default async function EditorialPipeline({searchParams}:Props){
 if(!SEMANTIC_PIPELINE_ENABLED)notFound();
 const profile=await requireEditorOrAdmin();
 const isAdmin=profile.role==="admin";
 const db=await createClient();
 const [{data,error},{data:people},{data:helpRequests},{data:capabilities},{data:revisions},{data:events}]=await Promise.all([
  db.from("artales_editorial_tasks")
   .select("id,candidate_id,revision_sha256,title,status,kind,assigned_to,created_at,completed_at,completed_by")
   .order("created_at",{ascending:false}).limit(500),
  db.from("profiles").select("id,display_name").eq("is_active",true).in("role",["admin","editor"]),
  db.from("artales_editorial_escalations")
   .select("id,context_path,subject,details,status,assigned_to,created_by,created_at")
   .order("created_at",{ascending:false}).limit(100),
  db.from("artales_editorial_capabilities").select("profile_id,kind").eq("profile_id",profile.id),
  db.from("candidate_semantic_revisions").select("candidate_id,revision_sha256,created_at")
   .order("created_at",{ascending:false}).limit(500),
  isAdmin?db.from("artales_editorial_events").select("task_id,actor_id,action,occurred_at")
   .order("occurred_at",{ascending:false}).limit(1000):Promise.resolve({data:[]})
 ]);
 const {data:methodologyReviews}=isAdmin?await db.from("artales_editorial_methodology_reviews")
  .select("id,month_start,due_date,status,created_at,conclusion")
  .order("month_start",{ascending:false}).limit(12):{data:[]};
 const {data:qaDecisions}=isAdmin?await db.from("artales_semantic_change_reviews")
  .select("decision,reviewed_at").order("reviewed_at",{ascending:false}).limit(500):{data:[]};
 const query=await searchParams;
 const roster=(people??[]).filter(p=>p.id&&p.display_name);
 const names=new Map(roster.map(p=>[p.id,p.display_name]));
 const eligible=new Set((capabilities??[]).map(x=>x.kind));
 const currentRevisions=new Map<string,string>();
 for(const rev of revisions??[])
  if(!currentRevisions.has(rev.candidate_id))currentRevisions.set(rev.candidate_id,rev.revision_sha256);
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
 const pending=mine.length+waitingHelp.length;
 const completedBy=new Map<string,Record<string,number>>();
 for(const t of finished){
  const who=t.completed_by??"unknown";
  const kinds=completedBy.get(who)??{};
  kinds[t.kind]=(kinds[t.kind]??0)+1;
  completedBy.set(who,kinds);
 }
 const recentChanges=(events??[]).filter(e=>["claimed","returned","reassigned","completed"].includes(e.action)).slice(0,20);
 function taskCard(t:Task,mode:"mine"|"available"|"admin"){
  const canClaim=(mode==="mine"||mode==="available")&&["open","returned"].includes(t.status);
  return <article key={t.id} style={{padding:16,border:"1px solid var(--border, #d9cbb6)",borderRadius:12,marginBottom:12}}>
   <strong>{kindNames[t.kind]??t.kind}</strong>
   <p>{t.title}</p>
   <p style={{fontSize:13}}>
    {t.status==="claimed"?"Rozpracováno":t.status==="returned"?"Vráceno do fronty":"Připraveno"}
    {" · "}{t.assigned_to?names.get(t.assigned_to)??"Přiřazený editor":"Volný úkol"}
    {" · "}Revize {t.revision_sha256.slice(0,12)}
   </p>
   <p><Link href={["text_review","second_review","proofread","visual_review"].includes(t.kind)
     ?"/member/semantic/"+t.candidate_id
     :"/member/editorial-detail/"+t.candidate_id+"#"+(
      t.kind==="cover_art"?"cover":
      t.kind==="collection_curation"?"collection":
      t.kind==="work_description"?"description":"author"
     )}>
    {["text_review","second_review","proofread","visual_review"].includes(t.kind)
      ?"Otevřít text a QA":"Otevřít místo úkolu"}
   </Link></p>
   {canClaim?<form action={claimSemanticTask}>
    <input type="hidden" name="task_id" value={t.id}/>
    <button type="submit">{mode==="available"?"Převzít tento úkol":"Začít pracovat"}</button>
   </form>:null}
   {mode==="mine"&&t.status==="claimed"?<>
    {["proofread","second_review","visual_review"].includes(t.kind)?<form action={completeSemanticTask}
     style={{display:"grid",gap:8,maxWidth:600,marginTop:12}}>
     <input type="hidden" name="task_id" value={t.id}/>
     <label>Výsledek kontroly
      <textarea name="evidence_note" minLength={40} maxLength={4000} required rows={3}
       style={{display:"block",width:"100%"}}/>
     </label>
     <button type="submit">Dokončit ověřenou kontrolu</button>
    </form>:t.kind==="text_review"?
    <p>QA se dokončuje po posouzení jednotlivých změn přímo v sémantickém editoru.</p>:
    <p>Dokončení vyžaduje skutečně uložené údaje v redakčním detailu díla.</p>}
    {t.kind!=="second_review"?<details style={{marginTop:12}}>
     <summary>Požádat o druhé posouzení</summary>
     <form action={requestSemanticSecondReview} style={{display:"grid",gap:8,maxWidth:600,padding:12}}>
      <input type="hidden" name="task_id" value={t.id}/>
      <label>Další editor
       <select name="reviewer_id" required defaultValue="">
        <option value="" disabled>Vyber editora</option>
        {roster.filter(p=>p.id!==profile.id).map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}
       </select>
      </label>
      <label>Důvod<textarea name="reason" required minLength={40} maxLength={4000} rows={3}/></label>
      <button type="submit">Vyžádat další kontrolu</button>
     </form>
    </details>:null}
   </>:null}
   {mode==="mine"&&["text_review","work_description","author_bio","second_review","proofread"].includes(t.kind)?
    <details style={{marginTop:12}}>
     <summary>Uvolnit tento úkol pro dalšího editora</summary>
     <form action={releaseEditorialTask} style={{display:"grid",gap:8,maxWidth:600,padding:12}}>
      <input type="hidden" name="task_id" value={t.id}/>
      <label>Důvod předání<textarea name="reason" required minLength={20} maxLength={1000} rows={2}/></label>
      <button type="submit">Vrátit do společné fronty</button>
     </form>
    </details>:null}
   {isAdmin&&t.status!=="completed"&&roster.length>1?<details style={{marginTop:12}}>
    <summary>Administrátorsky přeřadit</summary>
    <form action={reassignEditorialTask} style={{display:"grid",gap:8,maxWidth:600,padding:12}}>
     <input type="hidden" name="task_id" value={t.id}/>
     <label>Nový vlastník<select name="assignee_id" required defaultValue="">
      <option value="" disabled>Vyber způsobilého editora</option>
      {roster.filter(p=>p.id!==t.assigned_to).map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}
     </select></label>
     <label>Důvod<textarea name="reason" required minLength={20} maxLength={1000} rows={2}/></label>
     <button type="submit">Přeřadit a zaznamenat</button>
    </form>
   </details>:null}
  </article>;
 }
 return <main style={{margin:"auto",maxWidth:1100,padding:"24px"}}>
  <p><Link href="/member">← Interní zóna</Link></p>
  <h1>Redakční práce</h1>
  <p>Moje nedokončené úkoly: <strong>{pending}</strong>.
   Úkol patří jedinému editorovi; volnou práci lze bezpečně převzít.</p>
  {query.error?<p role="alert">{errorMessages[query.error]??"Akci se nepodařilo dokončit."}</p>:null}
  {query.notice?<p role="status">Změna úkolu byla zaznamenána: {query.notice}.</p>:null}
  {error?<p role="alert">Redakční úkoly nejsou dostupné.</p>:null}
  <section aria-label="Moje práce"><h2>Moje práce ({mine.length})</h2>
   {mine.length?mine.map(t=>taskCard(t,"mine")):<p>Nemáš žádnou rozpracovanou práci.</p>}
  </section>
  {waitingHelp.length?<section><h2>Žádosti o pomoc ({waitingHelp.length})</h2>
   {waitingHelp.map(h=><article key={h.id} style={{padding:12,marginBottom:8}}>
    <strong>{h.subject}</strong><p>{h.details}</p>
    <p><Link href={h.context_path}>Otevřít místo problému</Link></p>
    {isAdmin?<form action={resolveEditorialHelp}>
     <input type="hidden" name="id" value={h.id}/>
     <label>Vyřešení<textarea required minLength={20} maxLength={4000} name="note" rows={2}/></label>
     <button type="submit">Vyřešit eskalaci</button>
    </form>:null}
   </article>)}
  </section>:null}
  <section id="dalsi-titul" aria-label="Volná práce">
   <h2>Chci zpracovat další titul ({available.length})</h2>
   <p>Nabízejí se jen volné úkoly, které odpovídají tvým kompetencím.
    Převzetí je jednorázové a nelze získat úkol jiného editora.</p>
   {available.length?available.map(t=>taskCard(t,"available")):<p>Žádný další vhodný titul není momentálně volný.</p>}
  </section>
  {isAdmin?<section aria-label="Kontrolované učení ARTales" style={{marginTop:24}}>
    <h2>Kontrolované učení a revize metodiky</h2>
    <p>Jednou měsíčně vzniká úkol garanta. Z logů posoudíš opakující se nálezy
     a přijetí či vrácení oprav. Žádná metodika se automaticky nemění.</p>
    <p>Posouzení jednotlivých změn: {(qaDecisions??[]).filter(x=>x.decision==="accepted").length} přijatých,
     {" "}{(qaDecisions??[]).filter(x=>x.decision==="returned").length} vrácených
     (z posledních 500 záznamů).</p>
    {(methodologyReviews??[]).map(review=><article key={review.id}
      style={{padding:16,border:"1px solid #c8b79b",borderRadius:10,margin:"12px 0"}}>
      <h3>Revize metodiky · {review.month_start}</h3>
      <p>Termín {review.due_date} · {review.status==="open"?"Čeká na garanta":"Dokončeno"}</p>
      {review.status==="open"?<form action={completeMethodologyReview}
        style={{display:"grid",gap:8,maxWidth:650}}>
       <input type="hidden" name="review_id" value={review.id}/>
       <label>Závěr kontroly a přijaté změny metodiky
        <textarea name="conclusion" required minLength={25} maxLength={4000} rows={4}
         placeholder="Co se opakovalo, jaké máme důkazy a co přijmeme nebo odmítneme…"/>
       </label>
       <button type="submit">Potvrdit dokončení revize metodiky</button>
      </form>:<p>{review.conclusion}</p>}
     </article>)}
   </section>:null}
  {isAdmin?<section aria-label="Přehled garanta">
   <h2>Garant: celé redakční vytížení</h2>
   <p>Další přidělené úkoly: {others.length}. Dokončené evidované úkoly: {finished.length}.</p>
   <h3>Dokončená práce podle editora a druhu</h3>
   {completedBy.size?<table><thead><tr><th>Editor</th><th>Dokončené úkoly</th><th>Druhy</th></tr></thead>
    <tbody>{[...completedBy.entries()].map(([person,byKind])=>
     <tr key={person}><td>{names.get(person)??"Neznámý"}</td>
      <td>{Object.values(byKind).reduce((a,b)=>a+b,0)}</td>
      <td>{Object.entries(byKind).map(([k,n])=>`${kindNames[k]??k}: ${n}`).join("; ")}</td>
     </tr>)}</tbody></table>:<p>Zatím nejsou evidovány dokončené úkoly.</p>}
   <h3>Úkoly ostatních editorů</h3>
   {others.map(t=>taskCard(t,"admin"))}
   <h3>Poslední události</h3>
   {recentChanges.length?<ul>{recentChanges.map((e,i)=><li key={e.task_id+"-"+e.occurred_at+"-"+i}>
    {names.get(e.actor_id)??"Editor"}: {e.action} ({new Date(e.occurred_at).toLocaleString("cs-CZ")})
   </li>)}</ul>:<p>Žádné události zatím nejsou.</p>}
  </section>:null}
 </main>;
}
