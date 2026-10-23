"use server";
import {redirect} from "next/navigation";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
const allowed=new Set(["new","checking","ready","deferred","rejected"]);
export async function createManualCandidate(form:FormData){
 await requireEditorOrAdmin();
 const title=String(form.get("title")??"").trim(),author=String(form.get("author")??"").trim();
 const reference=String(form.get("reference")??"").trim(),notes=String(form.get("notes")??"");
 const priority=Number(form.get("priority")??50);
 if(!title||!author||title.length>300||author.length>200||reference.length>500||notes.length>5000||!Number.isInteger(priority)||priority<0||priority>100)redirect("/member/candidates/new?error=invalid");
 const db=await createClient();
 const {data,error}=await db.rpc("artales_create_manual_candidate",{p_title:title,p_author:author,p_priority:priority,p_notes:notes,p_origin_reference:reference||null});
 if(error)redirect("/member/candidates/new?error=save");
 const candidate=Array.isArray(data)?data[0]:null;
 if(candidate?.outcome!=="created"||!candidate?.candidate_id)redirect("/member/candidates/new?error=duplicate");
 redirect(`/member/candidates/${candidate.candidate_id}`);
}
export async function updateCandidate(id:string,form:FormData){
 await requireEditorOrAdmin();
 const status=String(form.get("status")??""),notes=String(form.get("notes")??""),priority=Number(form.get("priority"));
 if(!allowed.has(status)||notes.length>5000||!Number.isInteger(priority)||priority<0||priority>100)redirect(`/member/candidates/${id}?error=invalid`);
 const db=await createClient();const {error}=await db.from("work_candidates").update({status,notes,priority,updated_at:new Date().toISOString()}).eq("id",id);
 if(error)redirect(`/member/candidates/${id}?error=save`);
 redirect(`/member/candidates/${id}?saved=1`);
}
