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
 const kind=field==="collection"?"collection_curation":field==="description"?
  "work_description":field==="cover"?"cover_art":null;
 if(kind){
  const {data:mine}=await db.from("artales_editorial_tasks")
   .select("id,status,assigned_to").eq("candidate_id",candidateId)
   .eq("kind",kind).in("status",["open","claimed","returned"]).maybeSingle();
  const actor=await requireEditorOrAdmin();
  if(mine?.status==="claimed"&&mine.assigned_to===actor.id){
   // A failed closeout leaves the saved metadata intact and the task open.
   const note="Redakční úkol "+kind+
    " dokončen po uložení podkladů, validaci povinných údajů a databázovém ověření.";
   const {data:completed}=await db.rpc("artales_complete_editorial_task",{
    p_task_id:mine.id,p_note:note
   });
   if(completed?.result==="completed"){
    revalidatePath("/member/editorial-detail/"+candidateId);
    revalidatePath("/member/editorial-pipeline");revalidatePath("/member","layout");
    redirect("/member/editorial-detail/"+candidateId+"?saved="+encodeURIComponent(field)+"&closed=1");
   }
   // The metadata write succeeded but the independent evidence gate refused
   // closeout: never show a false confirmation or hide the still-active task.
   revalidatePath("/member/editorial-detail/"+candidateId);
   redirect("/member/editorial-detail/"+candidateId+"?saved="+encodeURIComponent(field)+"&closeout=pending");
  }
 }
 revalidatePath("/member/editorial-detail/"+candidateId);
 revalidatePath("/member/editorial-pipeline");
 redirect("/member/editorial-detail/"+candidateId+"?saved="+encodeURIComponent(field));
}
