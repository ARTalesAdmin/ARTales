"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {requireAdmin,requireEditorOrAdmin} from "@/lib/guards";
import {SEMANTIC_PIPELINE_ENABLED} from "@/lib/semantic/featureFlag";
import {slugify} from "@/lib/slug";
import {notFound} from "next/navigation";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function completeSemanticTask(form:FormData){
 if(!SEMANTIC_PIPELINE_ENABLED)notFound();
 const actor=await requireEditorOrAdmin();
 const taskId=String(form.get("task_id")??"");
 if(!uuid.test(taskId))redirect("/member/editorial-pipeline?error=invalid");
 const db=await createClient();
 const note=String(form.get("evidence_note")??"").trim();
 if(note.length<40||note.length>4000)redirect("/member/editorial-pipeline?error=review_note_required");
 const {data,error}=await db.rpc("artales_complete_editorial_task",{p_task_id:taskId,p_note:note});
 if(error||data?.result!=="completed")redirect("/member/editorial-pipeline?error=task_failed");
 void actor;
 revalidatePath("/member/editorial-pipeline");revalidatePath("/member","layout");redirect("/member/editorial-pipeline?notice=completed");
}

export async function publishSemanticCandidate(form:FormData){
 if(!SEMANTIC_PIPELINE_ENABLED)notFound();
 await requireAdmin();
 const id=String(form.get("candidate_id")??"");
 const revision=String(form.get("revision_sha256")??"");
 const db=await createClient();
 const {data:candidate}=await db.from("work_candidates").select("proposed_title")
   .eq("id",id).maybeSingle();
 const slug=slugify(candidate?.proposed_title??"");
 const summary=String(form.get("summary")??"");
 const reason=String(form.get("reason")??"");
 if(!uuid.test(id)||!/^[a-f0-9]{64}$/.test(revision)||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||summary.trim().length<200||
    summary.trim().length>800||reason.trim().length<30)redirect("/member/editorial-pipeline?error=invalid_release");
 const {data,error}=await db.rpc("artales_publish_semantic_candidate",{
  p_candidate_id:id,p_revision_sha256:revision,p_work_slug:slug,
  p_summary:summary,p_reason:reason
 });
 if(error||data?.result!=="published")redirect("/member/editorial-pipeline?error=release_blocked");
 revalidatePath("/gallery");revalidatePath("/member/editorial-pipeline");
 redirect("/work/"+slug);
}

export async function claimSemanticTask(form:FormData){
 if(!SEMANTIC_PIPELINE_ENABLED)notFound();
 await requireEditorOrAdmin();const id=String(form.get("task_id")??"");
 if(!uuid.test(id))redirect("/member/editorial-pipeline?error=invalid");
 const db=await createClient();
 const {data,error}=await db.rpc("artales_claim_editorial_task",{p_task_id:id});
 if(error||data?.result!=="claimed")redirect("/member/editorial-pipeline?error=unavailable");
 revalidatePath("/member/editorial-pipeline");revalidatePath("/member","layout");
 redirect("/member/editorial-pipeline?notice=claimed");
}

export async function requestSemanticSecondReview(form:FormData){
 if(!SEMANTIC_PIPELINE_ENABLED)notFound();
 await requireEditorOrAdmin();
 const taskId=String(form.get("task_id")??"");
 const reviewerId=String(form.get("reviewer_id")??"");
 const reason=String(form.get("reason")??"").trim();
 if(!uuid.test(taskId)||!uuid.test(reviewerId)||reason.length<40||reason.length>4000)
  redirect("/member/editorial-pipeline?error=reason_required");
 const db=await createClient();
 const {data,error}=await db.rpc("artales_request_semantic_second_review",{
  p_task_id:taskId,p_note:reason,p_reviewer_id:reviewerId
 });
 if(error||data?.result!=="requested")
  redirect("/member/editorial-pipeline?error=second_review_failed");
 revalidatePath("/member/editorial-pipeline");
 revalidatePath("/member","layout");
 redirect("/member/editorial-pipeline?notice=second_review_requested");
}


function refreshEditorialQueue(){
 revalidatePath("/member/editorial-pipeline");
 revalidatePath("/member","layout");
}
export async function releaseEditorialTask(form:FormData){
 if(!SEMANTIC_PIPELINE_ENABLED)notFound();
 await requireEditorOrAdmin();
 const id=String(form.get("task_id")??"");
 const reason=String(form.get("reason")??"").trim();
 if(!uuid.test(id)||reason.length<20||reason.length>1000)
  redirect("/member/editorial-pipeline?error=invalid_release_reason");
 const db=await createClient();
 const {data,error}=await db.rpc("artales_release_editorial_task",{
  p_task_id:id,p_reason:reason
 });
 if(error||data?.result!=="released")
  redirect("/member/editorial-pipeline?error=release_failed");
 refreshEditorialQueue();
 redirect("/member/editorial-pipeline?notice=released");
}
export async function reassignEditorialTask(form:FormData){
 if(!SEMANTIC_PIPELINE_ENABLED)notFound();
 await requireAdmin();
 const id=String(form.get("task_id")??"");
 const assignee=String(form.get("assignee_id")??"");
 const reason=String(form.get("reason")??"").trim();
 if(!uuid.test(id)||!uuid.test(assignee)||reason.length<20||reason.length>1000)
  redirect("/member/editorial-pipeline?error=invalid_reassignment");
 const db=await createClient();
 const {data,error}=await db.rpc("artales_reassign_editorial_task",{
  p_task_id:id,p_new_assignee:assignee,p_reason:reason
 });
 if(error||data?.result!=="reassigned")
  redirect("/member/editorial-pipeline?error=reassignment_failed");
 refreshEditorialQueue();
 redirect("/member/editorial-pipeline?notice=reassigned");
}
