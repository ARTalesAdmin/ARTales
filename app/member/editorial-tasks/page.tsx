import Link from "next/link"
import { requireEditorOrAdmin } from "@/lib/guards"
import { createClient } from "@/lib/supabase/server"
import { claimEditorialTask,returnEditorialTask } from "./actions"

type Props={searchParams:Promise<{error?:string;notice?:string}>}
type Task={id:string;title:string;status:string;kind:string;candidate_id:string|null;work_id:string|null;assignee_user_id:string|null;created_at:string}

export default async function EditorialTasksPage({searchParams}:Props){
 const profile=await requireEditorOrAdmin()
 const params=await searchParams
 const db=await createClient()
 const {data,error}=await db.from("editorial_tasks")
   .select("id,title,status,kind,candidate_id,work_id,assignee_user_id,created_at")
   .in("status",["open","claimed"]).order("created_at",{ascending:true}).limit(100)
 const tasks=(data??[]) as Task[]
 return <main style={{maxWidth:1080,margin:"auto",padding:"42px 24px"}}>
  <p><Link href="/member">← Pracovní nástroje</Link></p>
  <p style={{fontSize:12,letterSpacing:".1em"}}>ARTales · Editor</p>
  <h1>Redakční úkoly</h1>
  <p>Úkoly určené k převzetí a rozpracované položky. Převzetí je atomické: jeden úkol nemohou současně získat dva editoři.</p>
  {params.notice?<p role="status">Stav úkolu byl změněn.</p>:null}
  {params.error?<p role="alert">Úkol se nepodařilo změnit. Mohl jej převzít jiný editor nebo jej nelze zařadit.</p>:null}
  {error?<p role="alert">Redakční fronta není v tomto prostředí dostupná. Je nutná samostatně ověřená databázová migrace.</p>:
    tasks.length===0?<p>Momentálně nejsou žádné otevřené úkoly.</p>:<div style={{display:"grid",gap:12}}>
      {tasks.map(task=><article key={task.id} className="artales-member-panel" style={{padding:20}}>
       <h2 style={{marginTop:0}}>{task.title}</h2>
       <p>{task.status==="open"?"Na rozebrání":"Rozpracováno"} · {task.kind}</p>
       {task.candidate_id?<p><Link href={`/member/candidates/${task.candidate_id}`}>Detail kandidáta</Link></p>:null}
       {task.status==="open"?<form action={claimEditorialTask}>
         <input type="hidden" name="task_id" value={task.id}/>
         <button type="submit" className="artales-button-primary">Převzít úkol</button>
       </form>:<div>
         <p>Převzal: {task.assignee_user_id===profile.id?"Já":"jiný editor"}</p>
         {(task.assignee_user_id===profile.id||profile.role==="admin")?<form action={returnEditorialTask}>
           <input type="hidden" name="task_id" value={task.id}/>
           <button type="submit" className="artales-button-secondary">Vrátit do fronty</button>
         </form>:null}
       </div>}
      </article>)}
    </div>}
 </main>
}
