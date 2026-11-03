"use server";
import {revalidatePath} from "next/cache";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {verifySemanticRevision,walkSemanticAtoms} from "@/lib/semantic/compose";
import type {SemanticRevision} from "@/lib/semantic/model";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha=/^[a-f0-9]{64}$/;
const kinds=new Set(["text","typography","structure","image","other"]);
export type QaMutationResult={ok:boolean;message:string};
export async function submitSemanticQaFlag(input:{
 candidateId:string;revisionSha:string;atomId:string;
 kind:string;comment:string;
}):Promise<QaMutationResult>{
 const actor=await requireEditorOrAdmin();
 if(!uuid.test(input.candidateId)||!sha.test(input.revisionSha)||
   !kinds.has(input.kind)||input.atomId.length>160||
   input.comment.trim().length<15||input.comment.trim().length>4000)
  return {ok:false,message:"Neplatná kotva, druh nebo délka komentáře."};
 const db=await createClient();
 const {data,error}=await db.from("candidate_semantic_revisions")
  .select("revision,revision_sha256,source_text").eq("candidate_id",input.candidateId)
  .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(1).maybeSingle();
 if(error||!data||data.revision_sha256!==input.revisionSha)
  return {ok:false,message:"Revize se změnila. Obnov redakční kontrolu."};
 let atom;
 try{
  const revision=data.revision as SemanticRevision;
  verifySemanticRevision(revision,data.source_text);
  atom=walkSemanticAtoms(revision.blocks).find(a=>a.id===input.atomId);
 }catch{return {ok:false,message:"Integritu revize se nepodařilo ověřit."};}
 if(!atom)return {ok:false,message:"Blok již neexistuje v aktuální revizi."};
 const {error:insertError}=await db.from("artales_semantic_qa_flags").insert({
  candidate_id:input.candidateId,revision_sha256:input.revisionSha,
  target_atom_id:atom.id,source_start:atom.anchor.normalized_start,
  source_end:atom.anchor.normalized_end,kind:input.kind,comment:input.comment.trim(),
  created_by:actor.id
 });
 if(insertError)return {ok:false,message:"Nález se nepodařilo uložit. Databázová QA vrstva může chybět."};
 revalidatePath("/member/semantic/"+input.candidateId);
 revalidatePath("/member/editorial-pipeline");
 return {ok:true,message:"Nález je trvale uložen u přesné revize a bloku."};
}
export async function resolveSemanticQaFlag(input:{
 candidateId:string;flagId:string;resolutionNote:string;
}):Promise<QaMutationResult>{
 await requireEditorOrAdmin();
 if(!uuid.test(input.candidateId)||!uuid.test(input.flagId)||
    input.resolutionNote.trim().length<30||input.resolutionNote.trim().length>4000)
  return {ok:false,message:"Je třeba uvést nejméně 30 znaků skutečného výsledku opravy."};
 const db=await createClient();
 const {data,error}=await db.from("artales_semantic_qa_flags")
  .select("id,candidate_id,revision_sha256,status")
  .eq("id",input.flagId).eq("candidate_id",input.candidateId).maybeSingle();
 if(error||!data||data.status!=="open")
  return {ok:false,message:"Nález není dostupný nebo je již uzavřen."};
 const {data:result,error:rpcError}=await db.rpc("artales_resolve_semantic_qa_flag",{
  p_flag_id:input.flagId,p_resolution_note:input.resolutionNote.trim()
 });
 if(rpcError||result?.result!=="resolved")
  return {ok:false,message:"Uzavření nálezu se nepodařilo."};
 revalidatePath("/member/semantic/"+input.candidateId);
 revalidatePath("/member/editorial-pipeline");
 return {ok:true,message:"Nález uzavřen s dohledatelným zdůvodněním."};
}
