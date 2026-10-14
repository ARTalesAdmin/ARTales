"use server";
import {randomUUID} from "node:crypto";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {getServerSupabaseConnection} from "@/lib/supabase/connectionIsolation";
import {composeFromCapturedDbA} from "@/lib/semantic/dbAComponentBridge";
import {recomposeSemanticLayout,walkSemanticAtoms} from "@/lib/semantic/compose";
import {decodeSignedPilotSource,selfPilotAllowed,serializeSignedDraft} from "@/lib/semantic/selfPilotDraft";
import {verifySignedReadback} from "@/lib/semantic/verifySignedReadback";
import type {SemanticReviewIssue} from "@/lib/semantic/model";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const path=(slug:string)=>"/member/works/"+slug+"/semantic";
function safePilot(actorId:string){
 const conn=getServerSupabaseConnection();
 return selfPilotAllowed({actorId,configuredActorId:process.env.ARTALES_SEMANTIC_SELF_PILOT_ADMIN_ID,
  deployment:process.env.VERCEL_ENV??process.env.NEXT_PUBLIC_VERCEL_ENV,
  connectionEnabled:conn.enabled,connectionReason:conn.reason});
}
export async function enqueueSelfPilot(form:FormData):Promise<void>{
 const actor=await requireAdmin();
 const slug=String(form.get("slug")??"");
 const work=String(form.get("work")??"");
 const snapshot=String(form.get("snapshot")??"");
 if(!safePilot(actor.id)||!uuid.test(work)||!uuid.test(snapshot)||!/^[a-z0-9-]{3,140}$/.test(slug))
  redirect("/member/editorial-tasks?error=blocked");
 const db=await createClient();
 const {data,error}=await db.rpc("enqueue_semantic_v2_self_pilot",{
  p_work_id:work,p_source_snapshot_id:snapshot,p_request_id:randomUUID()});
 if(error||data?.result!=="queued_for_review"&&data?.result!=="already_queued")
  redirect(path(slug)+"?error=enqueue");
 revalidatePath(path(slug));
 redirect(path(slug)+"?notice=queued");
}
export async function saveOwnSemanticDraft(form:FormData):Promise<void>{
 const actor=await requireAdmin();
 const slug=String(form.get("slug")??"");
 const work=String(form.get("work")??"");
 const parent=String(form.get("parent")??"");
 if(!safePilot(actor.id)||!uuid.test(work)||!/^[a-z0-9-]{3,140}$/.test(slug)||parent!==""&&!uuid.test(parent))
  redirect("/member/editorial-tasks?error=blocked");
 const db=await createClient();
 const {data:source,error:sourceError}=await db.rpc("get_semantic_v2_self_source",{p_work_id:work});
 if(sourceError||source?.result!=="ready")redirect(path(slug)+"?error=source");
 let revision;
 let sourceDetails;
 try{
  sourceDetails=decodeSignedPilotSource(source,{work_id:work,slug});
  const initial=composeFromCapturedDbA(sourceDetails);
  const {data:current,error:readError}=await db.rpc("get_semantic_v2_editor_state",{p_work_id:work});
  if(readError||!current||current.result!=="not_started"&&current.result!=="ready")
   throw Error("Cannot verify head");
  if(current.result==="not_started"){
   if(parent)throw Error("Unexpected parent");
   revision=initial.revision;
  }else{
   const signed=verifySignedReadback(current,{work_id:work,slug});
   if(parent!==signed.draft_id||!signed.pending_issue)throw Error("No authorized return");
   revision=recomposeSemanticLayout(signed.revision,signed.pending_issue as SemanticReviewIssue,initial.original_raw);
  }
  const payload=serializeSignedDraft(revision);
  const {data:written,error:writeError}=await db.rpc("stage_semantic_v2_draft",{
   p_work_id:work,p_source_snapshot_id:sourceDetails.snapshot_id,
   p_component_id:sourceDetails.component_id,
   p_serialized_payload:payload.serialized,p_expected_sha256:payload.sha256,
   p_parent_draft_id:parent||null,p_request_id:randomUUID()});
  if(writeError||written?.result!=="saved_draft"&&written?.result!=="already_saved")
   throw Error("Signed draft refused");
  const {data:check,error:checkError}=await db.rpc("get_semantic_v2_editor_state",{p_work_id:work});
  if(checkError||check?.result!=="ready")throw Error("Readback missing");
  const verified=verifySignedReadback(check,{work_id:work,slug});
  if(verified.revision.revision_sha256!==payload.sha256||
    verified.source_snapshot_id!==sourceDetails.snapshot_id)throw Error("Readback digest mismatch");
 }catch{
  redirect(path(slug)+"?error=save");
 }
 revalidatePath(path(slug));
 redirect(path(slug)+"?notice=saved");
}

/** Editorial text QA only; this NEVER authorizes publication or reader cutover. */
export async function approveOwnAliceTextQa(form:FormData):Promise<void>{
 const actor=await requireAdmin();
 const slug=String(form.get("slug")??"");
 const work=String(form.get("work")??"");
 const draft=String(form.get("draft")??"");
 const digest=String(form.get("digest")??"");
 if(!safePilot(actor.id)||slug!=="alices-adventures-in-wonderland"||
   !uuid.test(work)||!uuid.test(draft)||!/^[a-f0-9]{64}$/.test(digest))
  redirect("/member/editorial-tasks?error=blocked");
 const db=await createClient();
 const {data:current,error:readError}=await db.rpc("get_semantic_v2_editor_state",{p_work_id:work});
 if(readError||current?.result!=="ready")redirect(path(slug)+"?error=qa");
 let signed;
 try{signed=verifySignedReadback(current,{work_id:work,slug});}
 catch{redirect(path(slug)+"?error=qa");}
 if(signed.draft_id!==draft||signed.revision.revision_sha256!==digest||signed.pending_issue)
  redirect(path(slug)+"?error=qa");
 const {data:decision,error}=await db.rpc("approve_semantic_v2_revision",{
  p_work_id:work,p_draft_id:draft,p_revision_sha256:digest,
  p_reason:"Vlastní textová QA importovaného díla Alenka, bez publikace.",
  p_request_id:randomUUID()
 });
 if(error||decision?.result!=="approved_editorial_only"||
  decision.publication_allowed!==false)redirect(path(slug)+"?error=qa");
 const {data:receipt,error:receiptError}=await db.rpc("get_semantic_v2_editor_approval",{p_work_id:work});
 if(receiptError||receipt?.result!=="approved_editorial_only"||
  receipt.draft_id!==draft||receipt.revision_sha256!==digest||
  receipt.publication_allowed!==false)redirect(path(slug)+"?error=qa");
 revalidatePath(path(slug));
 redirect(path(slug)+"?notice=text-qa-approved");
}

/** A strictly bounded in-work editor action: one anchored paragraph indent. */
export async function requestOwnAliceIndent(form:FormData):Promise<void>{
 const actor=await requireAdmin();
 const slug=String(form.get("slug")??"");
 const work=String(form.get("work")??"");
 const atomId=String(form.get("atom")??"");
 if(!safePilot(actor.id)||slug!=="alices-adventures-in-wonderland"||
    !uuid.test(work)||!/^a:[0-9a-f]{24}$/.test(atomId))
  redirect("/member/editorial-tasks?error=blocked");
 const db=await createClient();
 const {data:current,error:readError}=await db.rpc("get_semantic_v2_editor_state",{p_work_id:work});
 if(readError||current?.result!=="ready")redirect(path(slug)+"?error=issue");
 let verified;
 try{verified=verifySignedReadback(current,{work_id:work,slug});}
 catch{redirect(path(slug)+"?error=issue");}
 if(verified.pending_issue||!walkSemanticAtoms(verified.revision.blocks).some(a=>a.id===atomId))
  redirect(path(slug)+"?error=issue");
 const {data:returned,error}=await db.rpc("return_semantic_v2_revision",{
  p_work_id:work,p_draft_id:verified.draft_id,
  p_expected_sha256:verified.revision.revision_sha256,
  p_target_atom_id:atomId,
  p_reason:"Prosím upravit odsazení tohoto jediného odstavce.",
  p_request_id:randomUUID()
 });
 if(error||returned?.result!=="returned_for_changes"||returned.publication_allowed!==false)
  redirect(path(slug)+"?error=issue");
 revalidatePath(path(slug));
 redirect(path(slug)+"?notice=issue");
}
