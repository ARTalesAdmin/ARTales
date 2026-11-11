"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {notFound} from "next/navigation";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {SEMANTIC_PIPELINE_ENABLED} from "@/lib/semantic/featureFlag";
import {canAssignCandidate} from "@/lib/editorial/candidateAuthority";

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

export type CoverSaveResult={ok:boolean;message:string;closed:boolean};
/** Non-redirecting single cover save. Keeps the uploaded image and entered
 * description in the browser if the DB or task-completion gate refuses.
 * The canonical authenticated RPC remains the authorization authority.
 */
export async function saveCandidateCover(input:{
 candidateId:string;path:string;alt:string;caption:string
}):Promise<CoverSaveResult>{
 if(!SEMANTIC_PIPELINE_ENABLED)notFound();
 const actor=await requireEditorOrAdmin();
 const id=input.candidateId,back={ok:false,closed:false};
 if(!uuid.test(id)||typeof input.path!=="string"||typeof input.alt!=="string"||
    typeof input.caption!=="string"||
    !new RegExp("^works/"+id+"/cover/[a-zA-Z0-9_.-]+[.](?:jpg|png|webp)$").test(input.path)||
    input.alt.trim().length<8||input.alt.trim().length>350||input.caption.trim().length>500)
  return {...back,message:"Doplň popis (8–350 znaků) a vyber nahranou obálku."};
 const db=await createClient();
 const {data,error}=await db.rpc("artales_save_candidate_editorial_field",{
  p_candidate_id:id,p_field:"cover",p_value:input.path,
  p_alt:input.alt.trim(),p_caption:input.caption.trim()||null
 });
 if(error||data?.result!=="saved"){
  const code=typeof data?.result==="string"?data.result:error?.code??"save_failed";
  return {...back,message:code==="not_claimed"?"Nejdřív převezmi úkol obálky.":
   code==="cover_asset_missing"?"Obrázek je nahraný, ale databáze jej nevidí. Zachovej soubor a opakuj uložení.":
   code==="cover_required"?"Cesta k obrázku nebo jeho popis nesplňuje pravidla.":
   "Obálka se nepodařila propojit s dílem ("+code+"). Soubor zůstává nahraný."};
 }
 const {data:owned,error:lookupError}=await db.from("artales_editorial_tasks")
  .select("id").eq("candidate_id",id).eq("kind","cover_art")
  .eq("assigned_to",actor.id).eq("status","claimed");
 let closed=false,closeoutFailed=Boolean(lookupError);
 for(const task of owned??[]){
  const {data:complete,error:completeError}=await db.rpc("artales_complete_editorial_task",{
   p_task_id:task.id,p_note:"Obálka uložena v ARTales a úložiště ověřeno databázovou kontrolou."
  });
  if(completeError||complete?.result!=="completed")closeoutFailed=true;
  else closed=true;
 }
 revalidatePath("/member/editorial-detail/"+id);
 revalidatePath("/member/editorial-pipeline");
 revalidatePath("/member","layout");
 return {ok:true,closed,message:closeoutFailed?
  "Obálka je bezpečně uložená, ale dokončení úkolu neprošlo. Soubor znovu nenahrávej.":
  "Obálka byla uložená k dílu"+(closed?" a úkol je dokončen.":".")};
}
/** Recover previously uploaded candidate covers without writing Storage or DB.
 * Only the assigned current cover editor (or admin) may discover candidates.
 */
export async function listCandidateCoverUploads(candidateId:string):
 Promise<{ok:boolean;message:string;paths:string[]}>{
 const actor=await requireEditorOrAdmin();
 if(!uuid.test(candidateId))return {ok:false,message:"Neplatné dílo.",paths:[]};
 const db=await createClient();
 if(actor.role!=="admin"){
  const {data:task,error}=await db.from("artales_editorial_tasks").select("id")
   .eq("candidate_id",candidateId).eq("kind","cover_art")
   .eq("assigned_to",actor.id).eq("status","claimed").limit(1).maybeSingle();
  if(error||!task)return {ok:false,message:"Nejdřív převezmi úkol obálky.",paths:[]};
 }
 const folder="works/"+candidateId+"/cover";
 const {data,error}=await db.storage.from("artales-images").list(folder,{
  limit:30,sortBy:{column:"created_at",order:"desc"}
 });
 if(error)return {ok:false,message:"Nahrané obálky nelze načíst.",paths:[]};
 const files=(data??[]).filter(x=>/^cover-[a-zA-Z0-9_.-]+[.](?:jpg|png|webp)$/.test(x.name))
  .slice(0,12).map(x=>folder+"/"+x.name);
 return {ok:true,message:files.length?"Vyber již nahranou obálku.":"Žádné nahrané obálky nebyly nalezeny.",paths:files};
}

/** Reassign from the permanent candidate work card. No access is gained by
 * rendering the form: the existing audited RPC enforces admin and capability. */
export async function reassignCandidateTask(form:FormData){
 if(!SEMANTIC_PIPELINE_ENABLED)notFound();
 const actor=await requireEditorOrAdmin();
 if(!await canAssignCandidate(String(form.get("candidate_id")??""),actor))notFound();
 const candidateId=String(form.get("candidate_id")??"");
 const taskId=String(form.get("task_id")??"");
 const assigneeId=String(form.get("assignee_id")??"");
 const reason=String(form.get("reason")??"").trim();
 if(!uuid.test(candidateId))notFound();
 const back="/member/editorial-detail/"+candidateId;
 if(!uuid.test(taskId)||!uuid.test(assigneeId)||
    reason.length>1000||(actor.role!=="admin"&&reason.length<20))
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
