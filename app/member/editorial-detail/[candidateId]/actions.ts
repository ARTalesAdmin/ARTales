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
 const alt=String(form.get("alt")??"").trim();
 const caption=String(form.get("caption")??"").trim();
 if(value.length>4000||alt.length>350||caption.length>500)
  redirect("/member/editorial-detail/"+candidateId+"?error=invalid_input");
 const db=await createClient();
 const {data,error}=await db.rpc("artales_save_candidate_editorial_field",{
  p_candidate_id:candidateId,p_field:field,p_value:value,p_alt:alt||null,p_caption:caption||null
 });
 if(error||data?.result!=="saved")
  redirect("/member/editorial-detail/"+candidateId+"?error="+encodeURIComponent(
   typeof data?.result==="string"?data.result:"save_failed"));
 revalidatePath("/member/editorial-detail/"+candidateId);
 revalidatePath("/member/editorial-pipeline");
 redirect("/member/editorial-detail/"+candidateId+"?saved="+encodeURIComponent(field));
}
