"use server";
import {revalidatePath} from "next/cache";
import {requireEditorOrAdmin,requireAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
type Result={ok:boolean;message:string};
export async function requestEditorialHelp(input:{
 contextPath:string;subject:string;details:string
}):Promise<Result>{
 await requireEditorOrAdmin();
 if(!/^\/member\/(semantic|authors|collections|works|editorial-pipeline)(?:\/|$)/.test(input.contextPath)||
   input.contextPath.length>280||input.subject.trim().length<5||
   input.subject.trim().length>160||input.details.trim().length<20||
   input.details.trim().length>4000)
  return {ok:false,message:"Doplň oblast, stručný předmět a popis nejméně 20 znaků."};
 const db=await createClient();
 const {data,error}=await db.rpc("artales_create_editorial_escalation",{
  p_context_path:input.contextPath,p_subject:input.subject.trim(),p_details:input.details.trim()
 });
 if(error||data?.result!=="created")
  return {ok:false,message:"Eskalaci se nepodařilo uložit."};
 revalidatePath("/member");
 revalidatePath("/member/editorial-pipeline");
 return {ok:true,message:"Požadavek je uložen jako úkol pro Luboše."};
}
export async function resolveEditorialHelp(form:FormData){
 const admin=await requireAdmin();
 const id=String(form.get("id")??"");
 const note=String(form.get("note")??"").trim();
 if(!/^[a-f0-9-]{36}$/i.test(id)||note.length<20||note.length>4000)return;
 const db=await createClient();
 const {data,error}=await db.rpc("artales_resolve_editorial_escalation",{
  p_id:id,p_note:note
 });
 if(!error&&data?.result==="resolved"){
  revalidatePath("/member");revalidatePath("/member/editorial-pipeline");
 }
 void admin;
}
