"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {requireAdmin,requireEditorOrAdmin} from "@/lib/guards";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function enqueueSemanticReview(form:FormData){
 const actor=await requireAdmin(),candidateId=String(form.get("candidate_id")??"");
 if(!uuid.test(candidateId))redirect("/member/editorial-pipeline?error=invalid");
 const db=await createClient();
 const {data:rev,error}=await db.from("candidate_semantic_revisions")
 .select("revision_sha256").eq("candidate_id",candidateId).order("created_at",{ascending:false}).limit(1).maybeSingle();
 if(error||!rev)redirect("/member/editorial-pipeline?error=missing_revision");
 for(const kind of ["text_review","visual_review","proofread"]){
  const {error:taskError}=await db.from("artales_editorial_tasks").upsert({
   candidate_id:candidateId,revision_sha256:rev.revision_sha256,kind,
   title:kind+" — "+candidateId,created_by:actor.id
  },{onConflict:"candidate_id,revision_sha256,kind",ignoreDuplicates:true});
  if(taskError)redirect("/member/editorial-pipeline?error=enqueue_failed");
 }
 revalidatePath("/member/editorial-pipeline");
 redirect("/member/editorial-pipeline?notice=queued");
}
export async function completeSemanticTask(form:FormData){
 const actor=await requireEditorOrAdmin();
 const taskId=String(form.get("task_id")??"");
 if(!uuid.test(taskId))redirect("/member/editorial-pipeline?error=invalid");
 const db=await createClient();
 const {data,error}=await db.rpc("artales_complete_editorial_task",{p_task_id:taskId});
 if(error||data?.result!=="completed")redirect("/member/editorial-pipeline?error=task_failed");
 void actor;
 revalidatePath("/member/editorial-pipeline");redirect("/member/editorial-pipeline?notice=completed");
}

export async function publishSemanticCandidate(form:FormData){
 await requireAdmin();
 const id=String(form.get("candidate_id")??"");
 const revision=String(form.get("revision_sha256")??"");
 const slug=String(form.get("slug")??"");
 const summary=String(form.get("summary")??"");
 const reason=String(form.get("reason")??"");
 if(!uuid.test(id)||!/^[a-f0-9]{64}$/.test(revision)||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||summary.trim().length<200||
    summary.trim().length>800||reason.trim().length<30)redirect("/member/editorial-pipeline?error=invalid_release");
 const db=await createClient();
 const {data,error}=await db.rpc("artales_publish_semantic_candidate",{
  p_candidate_id:id,p_revision_sha256:revision,p_work_slug:slug,
  p_summary:summary,p_reason:reason
 });
 if(error||data?.result!=="published")redirect("/member/editorial-pipeline?error=release_blocked");
 revalidatePath("/gallery");revalidatePath("/member/editorial-pipeline");
 redirect("/work/"+slug);
}
