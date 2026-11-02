import Link from "next/link";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {completeSemanticTask} from "./actions";
export const dynamic="force-dynamic";
export default async function EditorialPipeline(){
 await requireEditorOrAdmin();const db=await createClient();
 const {data,error}=await db.from("artales_editorial_tasks")
  .select("id,candidate_id,revision_sha256,title,status,kind,assigned_to")
  .order("created_at",{ascending:true}).limit(150);
 return <main style={{margin:"auto",maxWidth:1100,padding:"36px 24px"}}>
  <p><Link href="/member">← Redakce</Link></p><h1>Sémantické redakční úkoly</h1>
  {error?<p role="alert">Databázová redakční fronta není připravená.</p>:
  (data??[]).length===0?<p>Žádné úkoly.</p>:(data??[]).map(t=>
  <article key={t.id} style={{padding:20,border:"1px solid #aaa",marginBottom:12}}>
   <h2>{t.title}</h2><p>{t.kind} / {t.status} / revize {t.revision_sha256.slice(0,12)}</p>
   <p><Link href={"/member/semantic/"+t.candidate_id}>Otevřít revizi a porovnání</Link></p>
   {t.status!=="completed"?<form action={completeSemanticTask}>
    <input type="hidden" name="task_id" value={t.id}/>
    <button type="submit">Dokončit kontrolu</button>
   </form>:null}
  </article>)}
 </main>;
}
