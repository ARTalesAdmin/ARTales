import Link from "next/link";
import {notFound} from "next/navigation";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {completeSemanticTask,claimSemanticTask,requestSemanticSecondReview} from "./actions";
import {SEMANTIC_PIPELINE_ENABLED} from "@/lib/semantic/featureFlag";
export const dynamic="force-dynamic";
const kindNames:Record<string,string>={
 text_review:"Textové QA",cover_art:"Obálka knihy",work_description:"Anotace díla",
 author_visual:"Vizuál autora",author_bio:"Text profilu autora",
 collection_curation:"Kolekce a zařazení",second_review:"Druhé posouzení",
 proofread:"Korektury (starší úkol)",visual_review:"Vizuální QA (starší úkol)"
};
const statusNames:Record<string,string>={
 open:"Přiděleno",claimed:"Probíhá",returned:"Vráceno",completed:"Dokončeno"
};
export default async function EditorialPipeline(){
 if(!SEMANTIC_PIPELINE_ENABLED)notFound();
 const profile=await requireEditorOrAdmin();
 const db=await createClient();
 const [{data,error},{data:people}]=await Promise.all([
  db.from("artales_editorial_tasks")
    .select("id,candidate_id,revision_sha256,title,status,kind,assigned_to,created_at")
    .order("created_at",{ascending:false}).limit(200),
  db.from("profiles").select("id,display_name").eq("is_active",true)
    .in("role",["admin","editor"])
 ]);
 const roster=(people??[]).filter(p=>p.id&&p.display_name);
 const names=new Map(roster.map(p=>[p.id,p.display_name]));
 const tasks=(data??[]).sort((a,b)=>{
  const mineA=a.assigned_to===profile.id?0:1,mineB=b.assigned_to===profile.id?0:1;
  const doneA=a.status==="completed"?1:0,doneB=b.status==="completed"?1:0;
  return doneA-doneB||mineA-mineB||a.title.localeCompare(b.title);
 });
 const myPending=tasks.filter(t=>t.assigned_to===profile.id&&t.status!=="completed").length;
 return <main style={{margin:"auto",maxWidth:1120,padding:"28px 24px"}}>
  <p><Link href="/member">← Interní zóna</Link></p>
  <h1>Redakční úkoly</h1>
  <p>Moje nedokončené úkoly: <strong>{myPending}</strong>.
     Každá kontrola je samostatný úkol. Připravené práce mají konkrétního vlastníka.</p>
  {error?<p role="alert">Redakční fronta není dostupná.</p>:
   tasks.length===0?<p>Zatím nejsou zadány žádné úkoly.</p>:
   tasks.map(t=>{
    const mine=t.assigned_to===profile.id,canWork=mine,
     waiting=t.status==="open"||t.status==="returned";
    return <article key={t.id} style={{padding:18,border:"1px solid #d9cbb6",borderRadius:12,
      marginBottom:13,background:mine&&t.status!=="completed"?"#fcf6e8":"#faf8f3"}}>
     <h2 style={{fontFamily:"Georgia,serif",marginBottom:7}}>{kindNames[t.kind]??t.kind}</h2>
     <p style={{margin:"4px 0"}}><strong>{t.title}</strong></p>
     <p style={{margin:"4px 0",fontSize:13}}>
       <strong>{statusNames[t.status]??t.status}</strong>{" · "}
       Přiřazeno: {t.assigned_to?(names.get(t.assigned_to)??"Aktivní redaktor"):"Nepřiřazeno"}
       {" · "}Revize {t.revision_sha256.slice(0,12)}
     </p>
     <p><Link href={"/member/semantic/"+t.candidate_id}>Otevřít dílo a QA</Link></p>
     {waiting&&canWork?<form action={claimSemanticTask}>
      <input type="hidden" name="task_id" value={t.id}/>
      <button type="submit">Začít pracovat</button>
     </form>:null}
     {t.status==="claimed"&&canWork?<>
      <form action={completeSemanticTask} style={{display:"grid",gap:8,maxWidth:600}}>
       <input type="hidden" name="task_id" value={t.id}/>
       <label>Výsledek kontroly
        <textarea name="evidence_note" minLength={40} maxLength={4000} required rows={3}
          style={{display:"block",width:"100%"}} placeholder="Zkontrolováno, výsledek a případné důkazy..."/>
       </label>
       <button type="submit">Dokončit tento úkol</button>
      </form>
      {t.kind!=="second_review"?<details style={{marginTop:14}}>
       <summary>Vyžádat kontrolu od jiného editora</summary>
       <form action={requestSemanticSecondReview} style={{display:"grid",gap:8,maxWidth:600,padding:12}}>
        <input type="hidden" name="task_id" value={t.id}/>
        <label>Komu kontrolu předat?
         <select name="reviewer_id" required defaultValue=""
           style={{display:"block",maxWidth:"100%",padding:7}}>
          <option value="" disabled>Vyber dalšího editora</option>
          {roster.filter(p=>p.id!==profile.id).map(p=>
           <option value={p.id} key={p.id}>{p.display_name}</option>)}
         </select>
        </label>
        <label>Proč potřebuješ druhou kontrolu?
         <textarea name="reason" required minLength={40} maxLength={4000} rows={3}
            style={{display:"block",width:"100%"}}/>
        </label>
        <button type="submit">Vytvořit další kontrolu</button>
       </form>
      </details>:null}
     </>:null}
    </article>;
   })}
 </main>;
}
