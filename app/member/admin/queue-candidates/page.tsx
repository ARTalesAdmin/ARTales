import Link from "next/link"
import { requireAdmin } from "@/lib/guards"
import { createClient } from "@/lib/supabase/server"
import { enqueueCandidateReview } from "@/app/member/editorial-tasks/actions"

type C={id:string;proposed_title:string;proposed_author_name:string;status:string;rights_status:string;matched_work_id:string|null}
export default async function QueueCandidatePage(){
 await requireAdmin()
 const db=await createClient()
 const {data,error}=await db.from("work_candidates").select("id,proposed_title,proposed_author_name,status,rights_status,matched_work_id")
   .in("status",["ready","accepted"]).eq("rights_status","clear").is("matched_work_id",null)
   .order("priority",{ascending:false}).limit(40)
 return <main style={{maxWidth:1000,margin:"auto",padding:"44px 25px"}}>
  <p><Link href="/member/admin/dashboard">← Admin přehled</Link></p>
  <h1>Předání kandidátů editorům</h1>
  <p>Pilotní krok: kandidát musí projít kontrolou před zařazením do fronty. Zařazení není právní clearance, vznik díla ani publikace.</p>
  <p><Link href="/member/editorial-tasks">Otevřít redakční frontu</Link></p>
  {error?<p role="alert">Kandidátní tabulky tu ještě nejsou nasazené. Nejdříve je potřeba kontrolovaná migrace v testovací databázi.</p>:
    !(data??[]).length?<p>Žádný vhodný kandidát k posouzení.</p>:
    <div style={{display:"grid",gap:10}}>{((data??[]) as C[]).map(c=><article className="artales-member-panel" style={{padding:18}} key={c.id}>
      <h2 style={{marginTop:0}}>{c.proposed_title}</h2><p>{c.proposed_author_name} · {c.status}</p>
      <form action={enqueueCandidateReview}>
        <input type="hidden" name="candidate_id" value={c.id}/>
        <button className="artales-button-primary">Předat k redakčnímu posouzení</button>
      </form>
    </article>)}</div>}
 </main>
}
