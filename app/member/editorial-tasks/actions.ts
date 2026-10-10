"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdmin, requireEditorOrAdmin } from "@/lib/guards"
import { createClient } from "@/lib/supabase/server"

export async function enqueueCandidateReview(formData:FormData):Promise<void>{
 await requireAdmin()
 const id=String(formData.get("candidate_id")??"")
 if(!/^[0-9a-f-]{36}$/i.test(id)) redirect("/member/editorial-tasks?error=invalid")
 const db=await createClient()
 const {data,error}=await db.rpc("create_editorial_task_for_candidate",{p_candidate_id:id})
 if(error||!data||!["queued_for_review","already_queued"].includes(data.result))
   redirect("/member/editorial-tasks?error=blocked")
 revalidatePath("/member/editorial-tasks")
 redirect("/member/editorial-tasks?notice=queued")
}

export async function claimEditorialTask(formData:FormData):Promise<void>{
 await requireEditorOrAdmin()
 const id=String(formData.get("task_id")??"")
 if(!/^[0-9a-f-]{36}$/i.test(id)) redirect("/member/editorial-tasks?error=invalid")
 const db=await createClient()
 const {data,error}=await db.rpc("claim_editorial_task",{p_task_id:id})
 if(error||data?.result!=="claimed") redirect("/member/editorial-tasks?error=unavailable")
 revalidatePath("/member/editorial-tasks")
 redirect("/member/editorial-tasks?notice=claimed")
}

export async function returnEditorialTask(formData:FormData):Promise<void>{
 await requireEditorOrAdmin()
 const id=String(formData.get("task_id")??"")
 if(!/^[0-9a-f-]{36}$/i.test(id)) redirect("/member/editorial-tasks?error=invalid")
 const db=await createClient()
 const {data,error}=await db.rpc("return_editorial_task",{p_task_id:id})
 if(error||data?.result!=="returned") redirect("/member/editorial-tasks?error=unavailable")
 revalidatePath("/member/editorial-tasks")
 redirect("/member/editorial-tasks?notice=returned")
}
