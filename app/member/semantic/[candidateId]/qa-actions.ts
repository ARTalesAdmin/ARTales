"use server";
import {revalidatePath} from "next/cache";
import {requireAdmin,requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {verifySemanticRevision,walkSemanticAtoms,submitSemanticIssue,recomposeSemanticLayout} from "@/lib/semantic/compose";
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

/** Deterministic, bounded ARTales layout repair. Source bytes stay immutable.
 * A new SHA-bound revision automatically emits a NEW set of review tasks via DB trigger.
 */
export async function applySemanticQaLayoutFix(input:{
 candidateId:string;flagId:string;proposal:"compact"|"airy"|"centered";
}):Promise<QaMutationResult>{
 const actor=await requireAdmin();
 if(!uuid.test(input.candidateId)||!uuid.test(input.flagId)||
  !["compact","airy","centered"].includes(input.proposal))
  return {ok:false,message:"Neplatná žádost o úpravu sazby."};
 const db=await createClient();
 const {data:flag,error:flagError}=await db.from("artales_semantic_qa_flags")
  .select("id,candidate_id,revision_sha256,target_atom_id,kind,status,comment")
  .eq("candidate_id",input.candidateId).eq("id",input.flagId).maybeSingle();
 if(flagError||!flag||flag.status!=="open"||flag.kind!=="typography")
  return {ok:false,message:"Nález není otevřený typografický problém."};
 const {data:previous,error:revError}=await db.from("candidate_semantic_revisions")
  .select("revision,source_text,revision_sha256,snapshot_sha256,component_id,source_manifest,image_selection")
  .eq("candidate_id",input.candidateId)
  .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(1).maybeSingle();
 if(revError||!previous||previous.revision_sha256!==flag.revision_sha256)
  return {ok:false,message:"Revize byla změněna. Použij aktuální revizi pro nové QA."};
 let next;
 try{
  const revision=previous.revision as SemanticRevision;
  verifySemanticRevision(revision,previous.source_text);
  const presentation=input.proposal==="compact"
   ? {align:"left" as const,indent:"none" as const,space_before:"none" as const,space_after:"none" as const}
   : input.proposal==="airy"
    ?{align:"left" as const,indent:"none" as const,space_before:"normal" as const,space_after:"generous" as const}
    :{align:"center" as const,indent:"none" as const,space_before:"normal" as const,space_after:"normal" as const};
  const issue=submitSemanticIssue(revision,{
   id:input.flagId,target_atom_id:flag.target_atom_id,kind:"typography",
   reason:flag.comment,requested_layout:"block_presentation",requested_presentation:presentation
  });
  next=recomposeSemanticLayout(revision,issue,previous.source_text);
 }catch{return {ok:false,message:"Navrhovaná úprava není použitelná nebo by nic nezměnila."};}
 const {error:insertError}=await db.from("candidate_semantic_revisions").insert({
  candidate_id:input.candidateId,snapshot_sha256:previous.snapshot_sha256,
  revision_sha256:next.revision_sha256,revision:next,source_text:previous.source_text,
  component_id:previous.component_id,source_manifest:previous.source_manifest,
  image_selection:previous.image_selection,status:"draft",authored_by:actor.id
 });
 if(insertError)return {ok:false,message:"Novou revizi se nepodařilo uložit nebo založit kontrolní úkoly."};
 const proof="Systém vytvořil novou neměnnou revizi "+next.revision_sha256+
  " z typografického nálezu "+flag.id+". Původní revize zůstává archivována; novou revizi prověří nové QA úkoly.";
 const {data:resolution,error:resolutionError}=await db.rpc("artales_resolve_semantic_qa_flag",{
  p_flag_id:flag.id,p_resolution_note:proof
 });
 revalidatePath("/member/semantic/"+input.candidateId);
 revalidatePath("/member/editorial-pipeline");
 return {ok:true,message:resolutionError||resolution?.result!=="resolved"
  ?"Vznikla nová revize a nové úkoly; starý nález musí editor samostatně uzavřít."
  :"Vznikla nová revize a automaticky nové redakční kontroly. Původní nález je uzavřen se stopou."};
}
