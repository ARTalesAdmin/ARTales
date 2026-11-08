"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {notFound} from "next/navigation";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {SEMANTIC_PIPELINE_ENABLED} from "@/lib/semantic/featureFlag";

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fields=["author","collection","description","cover"] as const;
export async function saveCandidateEditorialField(form:FormData){
 if(!SEMANTIC_PIPELINE_ENABLED)notFound();
 await requireEditorOrAdmin();
 const candidateId=String(form.get("candidate_id")??"");
 const field=String(form.get("field")??"");
 if(!uuid.test(candidateId)||!fields.some(f=>f===field))notFound();
 const value=String(form.get("value")??"").trim();
 const descriptionCs=String(form.get("description_cs")??"").trim();
 const descriptionEn=String(form.get("description_en")??"").trim();
 const alt=String(form.get("alt")??"").trim();
 const caption=String(form.get("caption")??"").trim();
 if(value.length>4000||alt.length>350||caption.length>500||
    descriptionCs.length>800||descriptionEn.length>800)
  redirect("/member/editorial-detail/"+candidateId+"?error=invalid_input");
 const db=await createClient();
 const {data,error}=field==="description"?
  await db.rpc("artales_save_candidate_bilingual_description",{
   p_candidate_id:candidateId,p_description_cs:descriptionCs,p_description_en:descriptionEn
  }):
  await db.rpc("artales_save_candidate_editorial_field",{
   p_candidate_id:candidateId,p_field:field,p_value:value,p_alt:alt||null,p_caption:caption||null
  });
 if(error||data?.result!=="saved")
  redirect("/member/editorial-detail/"+candidateId+"?error="+encodeURIComponent(
   typeof data?.result==="string"?data.result:"save_failed"));
 // One save is enough for the single-field tasks. The independent database
 // completion trigger must verify durable evidence before it accepts the task.
 const kinds=field==="author"?["author_bio","author_visual"]:
  field==="collection"?["collection_curation"]:
  field==="description"?["work_description"]:
  field==="cover"?["cover_art"]:[];
 if(kinds.length){
  const actor=await requireEditorOrAdmin();
  const {data:owned,error:lookupError}=await db.from("artales_editorial_tasks")
   .select("id,kind").eq("candidate_id",candidateId)
   .eq("assigned_to",actor.id).eq("status","claimed").in("kind",kinds);
  if(lookupError)redirect("/member/editorial-detail/"+candidateId+"?saved="+encodeURIComponent(field)+"&closeout=pending");
  let closed=0,failed=0;
  for(const task of owned??[]){
   // Every closeout is validated by the production evidence trigger, not JSX.
   const note="Redakční úkol "+task.kind+
    " dokončen automaticky po uložení podkladů a databázovém ověření editorovy práce.";
   const {data:completed,error:finishError}=await db.rpc("artales_complete_editorial_task",{
    p_task_id:task.id,p_note:note
   });
   if(finishError||completed?.result!=="completed")failed++;
   else closed++;
  }
  revalidatePath("/member/editorial-detail/"+candidateId);
  revalidatePath("/member/editorial-pipeline");revalidatePath("/member","layout");
  if(failed>0)redirect("/member/editorial-detail/"+candidateId+"?saved="+encodeURIComponent(field)+"&closeout=pending");
  if(closed>0)redirect("/member/editorial-detail/"+candidateId+"?saved="+encodeURIComponent(field)+"&closed=1");
 }
 revalidatePath("/member/editorial-detail/"+candidateId);
 revalidatePath("/member/editorial-pipeline");
 redirect("/member/editorial-detail/"+candidateId+"?saved="+encodeURIComponent(field));
}

/** Reassign from the permanent candidate work card. No access is gained by
 * rendering the form: the existing audited RPC enforces admin and capability. */
export async function reassignCandidateTask(form:FormData){
 if(!SEMANTIC_PIPELINE_ENABLED)notFound();
 const actor=await requireEditorOrAdmin();
 if(actor.role!=="admin")notFound();
 const candidateId=String(form.get("candidate_id")??"");
 const taskId=String(form.get("task_id")??"");
 const assigneeId=String(form.get("assignee_id")??"");
 const reason=String(form.get("reason")??"").trim();
 if(!uuid.test(candidateId))notFound();
 const back="/member/editorial-detail/"+candidateId;
 if(!uuid.test(taskId)||!uuid.test(assigneeId)||
    reason.length<20||reason.length>1000)
  redirect(back+"?error=invalid_assignment#tasks");
 const db=await createClient();
 const {data:task,error:readError}=await db.from("artales_editorial_tasks")
  .select("candidate_id,status").eq("id",taskId).maybeSingle();
 if(readError||!task||task.candidate_id!==candidateId||
    ["completed","superseded"].includes(task.status))
  redirect(back+"?error=assignment_unavailable#tasks");
 const {data,error}=await db.rpc("artales_reassign_editorial_task",{
  p_task_id:taskId,p_new_assignee:assigneeId,p_reason:reason
 });
 if(error||data?.result!=="reassigned")
  redirect(back+"?error=assignment_unavailable#tasks");
 revalidatePath(back);
 revalidatePath("/member/editorial-pipeline");
 redirect(back+"?assigned=1#tasks");
}
