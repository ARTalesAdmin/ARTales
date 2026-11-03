"use server";
import {revalidatePath} from "next/cache";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {verifySemanticRevision,walkSemanticAtoms,recomposeSemanticBatch} from "@/lib/semantic/compose";
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


export type EditorialBatchAction="exclude_note"|"compact"|"airy"|"center";
export async function commitSemanticQaBatch(input:{
 candidateId:string;revisionSha:string;repairs:{flagId:string;action:EditorialBatchAction}[]
}):Promise<QaMutationResult>{
 const actor=await requireEditorOrAdmin();
 if(!uuid.test(input.candidateId)||!sha.test(input.revisionSha)||
    !Array.isArray(input.repairs)||input.repairs.length<1||input.repairs.length>50||
    new Set(input.repairs.map(x=>x.flagId)).size!==input.repairs.length||
    input.repairs.some(x=>!uuid.test(x.flagId)||
      !["exclude_note","compact","airy","center"].includes(x.action)))
  return {ok:false,message:"Neplatná sada oprav."};
 const db=await createClient();
 const [{data:previous,error:readError},{data:flags,error:flagsError}]=await Promise.all([
  db.from("candidate_semantic_revisions").select("revision,source_text,revision_sha256")
    .eq("candidate_id",input.candidateId).order("created_at",{ascending:false})
    .order("id",{ascending:false}).limit(1).maybeSingle(),
  db.from("artales_semantic_qa_flags")
    .select("id,kind,comment,target_atom_id,status,revision_sha256")
    .eq("candidate_id",input.candidateId).eq("revision_sha256",input.revisionSha)
    .eq("status","open").in("id",input.repairs.map(x=>x.flagId))
 ]);
 if(readError||!previous||previous.revision_sha256!==input.revisionSha||
    flagsError||!flags||flags.length!==input.repairs.length)
  return {ok:false,message:"Revize nebo nálezy nejsou aktuální. Obnov redakci."};
 let updated;
 try{
  const source=previous.revision as SemanticRevision;
  verifySemanticRevision(source,previous.source_text);
  const byId=new Map(flags.map(f=>[f.id,f]));
  const atoms=new Map(walkSemanticAtoms(source.blocks).map(a=>[a.id,a]));
  const changes=input.repairs.map(repair=>{
   const flag=byId.get(repair.flagId);
   if(!flag||flag.status!=="open")throw Error("missing flag");
   const atom=atoms.get(flag.target_atom_id);
   if(!atom)throw Error("missing atom");
   if(repair.action==="exclude_note"){
    if(!["structure","other"].includes(flag.kind)||
       !/^\\s*(?:NOTE[.\\u2014: -]|TRANSCRIBER)/im.test(atom.raw))
      throw Error("only explicit editorial notes may be removed by this action");
    return {flagId:flag.id,atomId:atom.id,reason:flag.comment,
      kind:"exclude_from_edition" as const};
   }
   if(!["typography","structure"].includes(flag.kind))
    throw Error("not an actionable style finding");
   const presentation=repair.action==="compact"
      ?{align:"left" as const,indent:"none" as const,space_before:"none" as const,space_after:"none" as const}
      :repair.action==="airy"
      ?{align:"left" as const,indent:"none" as const,space_before:"normal" as const,space_after:"generous" as const}
      :{align:"center" as const,indent:"none" as const,space_before:"normal" as const,space_after:"normal" as const};
   return {flagId:flag.id,atomId:atom.id,reason:flag.comment,
      kind:"block_presentation" as const,presentation};
  });
  updated=recomposeSemanticBatch(source,changes,previous.source_text);
 }catch{
  return {ok:false,message:"Tyto nálezy nejdou bezpečně opravit zvoleným postupem. Nech je otevřené pro odbornou opravu nebo eskalaci."};
 }
 const {data,error}=await db.rpc("artales_commit_semantic_qa_batch",{
  p_candidate_id:input.candidateId,p_parent_sha:input.revisionSha,
  p_revision:updated,p_flag_ids:input.repairs.map(x=>x.flagId)
 });
 if(error||data?.result!=="created")
  return {ok:false,message:"Atomická revize se neuložila. Žádný nález se nemá považovat za vyřešený."};
 revalidatePath("/member/semantic/"+input.candidateId);
 revalidatePath("/member/editorial-pipeline");
 revalidatePath("/member");
 void actor;
 return {ok:true,message:"Vytvořena jedna nová revize z "+input.repairs.length+
  " oprav. Jediný nový textový QA úkol patří původnímu editorovi."};
}
export async function saveWorkTypographyRule(input:{
 candidateId:string;term:string
}):Promise<QaMutationResult>{
 await requireEditorOrAdmin();
 if(!uuid.test(input.candidateId)||input.term.length>80||input.term.trim().length<2)
  return {ok:false,message:"Zadej krátké slovo nebo sousloví k ochraně."};
 const db=await createClient();
 const {data,error}=await db.rpc("artales_add_work_typography_rule",{
  p_candidate_id:input.candidateId,p_term:input.term.trim()
 });
 if(error||data?.result!=="saved")
  return {ok:false,message:"Pravidlo se nepodařilo aplikovat. Zkontroluj výraz a archivovaný text."};
 revalidatePath("/member/semantic/"+input.candidateId);
 return {ok:true,message:"Pravidlo pro celé dílo uloženo. Výraz je chráněný před dělením ve všech výskytech bez změny zdrojového textu; překontroluj výsledek."};
}
