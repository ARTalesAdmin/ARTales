"use server";
import {revalidatePath} from "next/cache";
import {requireEditorOrAdmin,requireAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {createClient as createServiceClient} from "@supabase/supabase-js";
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
export type QaBatchInput={
 candidateId:string;revisionSha:string;repairs:{flagId:string;action:EditorialBatchAction}[]
};
export type QaBatchPreviewResult=QaMutationResult&{
 revision?:SemanticRevision;affectedAtomIds?:string[];
};

/** The same verified plan powers preview and commit. No text mutation is supported. */
async function prepareQaPresentationBatch(input:QaBatchInput):Promise<
 {ok:true;revision:SemanticRevision;atomIds:string[]}|{ok:false;message:string}
>{
 const fail=(message:string)=>({ok:false as const,message});
 if(!uuid.test(input.candidateId)||!sha.test(input.revisionSha)||
   !Array.isArray(input.repairs)||input.repairs.length<1||input.repairs.length>50||
   new Set(input.repairs.map(x=>x.flagId)).size!==input.repairs.length||
   input.repairs.some(x=>!uuid.test(x.flagId)||
    !["exclude_note","compact","airy","center"].includes(x.action)))
  return fail("Neplatná nebo prázdná opravná dávka.");
 const db=await createClient();
 const [{data:previous,error:readError},{data:flags,error:flagsError}]=await Promise.all([
  db.from("candidate_semantic_revisions").select("revision,source_text,revision_sha256")
   .eq("candidate_id",input.candidateId)
   .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(1).maybeSingle(),
  db.from("artales_semantic_qa_flags")
   .select("id,kind,comment,target_atom_id,status,revision_sha256")
   .eq("candidate_id",input.candidateId).eq("revision_sha256",input.revisionSha)
   .eq("status","open").in("id",input.repairs.map(x=>x.flagId))
 ]);
 if(readError||!previous||previous.revision_sha256!==input.revisionSha||
    flagsError||!flags||flags.length!==input.repairs.length)
  return fail("Revize nebo její nálezy již nejsou aktuální.");
 try{
  const original=previous.revision as SemanticRevision;
  verifySemanticRevision(original,previous.source_text);
  const flagged=new Map(flags.map(f=>[f.id,f]));
  const sourceAtoms=walkSemanticAtoms(original.blocks);
  const atomIndex=new Map(sourceAtoms.map(a=>[a.id,a]));
  const changes=input.repairs.map(repair=>{
   const flag=flagged.get(repair.flagId);
   if(!flag||flag.status!=="open")throw Error("Missing flag");
   const atom=atomIndex.get(flag.target_atom_id);
   if(!atom)throw Error("Missing exact atom");
   if(repair.action==="exclude_note"){
    // Only an editor-selected, explicitly recorded apparatus exclusion.
    // AI is NOT allowed to recommend this action.
    if(!["structure","other"].includes(flag.kind)||
       !/^\\s*(?:NOTE[.\\u2014: -]|TRANSCRIBER)/im.test(atom.raw))
     throw Error("A literary paragraph must not be excluded.");
    return {flagId:flag.id,atomId:atom.id,reason:flag.comment,
     kind:"exclude_from_edition" as const};
   }
   if(!["typography","structure"].includes(flag.kind))
    throw Error("This finding is not a presentation fix.");
   const presentation=repair.action==="compact"
    ?{align:"left" as const,indent:"none" as const,
      space_before:"none" as const,space_after:"none" as const}
    :repair.action==="airy"
    ?{align:"left" as const,indent:"none" as const,
      space_before:"normal" as const,space_after:"generous" as const}
    :{align:"center" as const,indent:"none" as const,
      space_before:"normal" as const,space_after:"normal" as const};
   return {flagId:flag.id,atomId:atom.id,reason:flag.comment,
    kind:"block_presentation" as const,presentation};
  });
  const revision=recomposeSemanticBatch(original,changes,previous.source_text);
  const afterAtoms=walkSemanticAtoms(revision.blocks);
  if(sourceAtoms.length!==afterAtoms.length||
     sourceAtoms.some((a,i)=>a.id!==afterAtoms[i].id||
       a.raw!==afterAtoms[i].raw||
       a.source_sha256!==afterAtoms[i].source_sha256||
       JSON.stringify(a.anchor)!==JSON.stringify(afterAtoms[i].anchor)))
   throw Error("Editorial text or source anchor was changed.");
  if(revision.source.normalized_text_sha256!==original.source.normalized_text_sha256||
     JSON.stringify(revision.gaps)!==JSON.stringify(original.gaps))
   throw Error("Source or separators have been changed.");
  return {ok:true,revision,atomIds:changes.map(x=>x.atomId)};
 }catch{
  return fail("Oprava přesahuje bezpečné formátování. Nálezy zůstávají otevřené.");
 }
}

/** Read-only, source-byte-verified layout preview; no database mutation. */
export async function previewSemanticQaBatch(input:QaBatchInput):Promise<QaBatchPreviewResult>{
 const actor=await requireEditorOrAdmin();
 if(!uuid.test(input.candidateId)||!sha.test(input.revisionSha))
  return {ok:false,message:"Neplatná identita revize."};
 if(actor.role!=="admin"){
  const db=await createClient();
  const {data,error}=await db.from("artales_editorial_tasks").select("id")
   .eq("candidate_id",input.candidateId).eq("revision_sha256",input.revisionSha)
   .eq("kind","text_review").eq("assigned_to",actor.id).eq("status","claimed").limit(1);
  if(error||!data?.length)return {ok:false,message:"Náhled může vyžádat pouze aktuální QA editor."};
 }
 const result=await prepareQaPresentationBatch(input);
 if(!result.ok)return result;
 return {ok:true,message:"Bezpečný náhled. Zdrojový text zůstává beze změn.",
   revision:result.revision,affectedAtomIds:result.atomIds};
}

/** Persist only through the separately governed, admin-only immutable revision RPC. */
export async function commitSemanticQaBatch(input:QaBatchInput):Promise<QaMutationResult>{
 const actor=await requireEditorOrAdmin();
 const prepared=await prepareQaPresentationBatch(input);
 if(!prepared.ok)return prepared;
 const db=await createClient();
 // Exclusion of nonliterary distribution apparatus is NOT AI-driven, and
 // retains the existing admin-only approval path.
 if(input.repairs.some(x=>x.action==="exclude_note")){
  if(actor.role!=="admin")return {ok:false,message:"Vyřazení ediční poznámky vyžaduje garanta."};
  const {data,error}=await db.rpc("artales_commit_semantic_qa_batch",{
   p_candidate_id:input.candidateId,p_parent_sha:input.revisionSha,
   p_revision:prepared.revision,p_flag_ids:input.repairs.map(x=>x.flagId)
  });
  if(error||data?.result!=="created")return {ok:false,message:"Ediční vyřazení nebylo schváleno."};
 }else{
  const {data:owner,error:ownerError}=await db.from("artales_editorial_tasks")
   .select("id").eq("candidate_id",input.candidateId)
   .eq("revision_sha256",input.revisionSha).eq("kind","text_review")
   .eq("assigned_to",actor.id).eq("status","claimed").maybeSingle();
  if(ownerError||!owner)return {ok:false,message:"Opravu smí uložit jen právě přiřazený QA editor."};
  // No service-role key is ever passed to the browser or accepted as an argument.
  const roleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  if(!roleKey||!url)return {ok:false,message:"Zabezpečené ukládání sazby není nakonfigurováno."};
  const internal=createServiceClient(url,roleKey,{
   auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data,error}=await internal.rpc("artales_commit_safe_layout_revision",{
   p_candidate_id:input.candidateId,p_parent_sha:input.revisionSha,
   p_revision:prepared.revision,p_flag_ids:input.repairs.map(x=>x.flagId),
   p_editor_id:actor.id
  });
  if(error||data?.result!=="created")
   return {ok:false,message:"Změnu odmítla databázová kontrola. Revizi a nálezy ponecháváme beze změn."};
 }
 revalidatePath("/member/semantic/"+input.candidateId);
 revalidatePath("/member/editorial-pipeline");
 revalidatePath("/member","layout");
 return {ok:true,message:"Bez změny jediného znaku byl uložen nový návrh sazby. Opravené bloky čekají na potvrzení."};
}

export async function decideSemanticChange(input:{
 candidateId:string;revisionSha:string;issueId:string;decision:"accepted"|"returned";note:string
}):Promise<QaMutationResult>{
 await requireEditorOrAdmin();
 if(!uuid.test(input.candidateId)||!sha.test(input.revisionSha)||
  input.issueId.length<1||input.issueId.length>160||
  !["accepted","returned"].includes(input.decision)||
  (input.decision==="returned"&&(input.note.trim().length<15||input.note.length>4000)))
  return {ok:false,message:"Neplatné rozhodnutí; vrácení vyžaduje důvod alespoň 15 znaků."};
 const db=await createClient();
 const {data,error}=await db.rpc("artales_review_semantic_change",{
  p_candidate_id:input.candidateId,p_revision_sha:input.revisionSha,
  p_issue_id:input.issueId,p_decision:input.decision,
  p_note:input.decision==="returned"?input.note.trim():null
 });
 if(error||!["accepted","returned"].includes(data?.result))
  return {ok:false,message:"Rozhodnutí nebylo zapsáno; ověř aktuální QA revizi."};
 revalidatePath("/member/semantic/"+input.candidateId);
 revalidatePath("/member/editorial-pipeline");
 return {ok:true,message:data.result==="accepted"?"Změna přijata.":"Změna vrácena s poznámkou do další opravné dávky."};
}

export async function finishSemanticQaReview(input:{
 candidateId:string;revisionSha:string;taskId:string
}):Promise<QaMutationResult>{
 await requireEditorOrAdmin();
 if(!uuid.test(input.candidateId)||!uuid.test(input.taskId)||!sha.test(input.revisionSha))
  return {ok:false,message:"Neplatný QA úkol."};
 const db=await createClient();
 const {data,error}=await db.rpc("artales_finish_semantic_text_qa",{
  p_task_id:input.taskId,p_revision_sha:input.revisionSha
 });
 if(error||data?.result!=="completed")
  return {ok:false,message:"QA zatím nelze přijmout. Ověř všechny otevřené nálezy a změněné bloky."};
 revalidatePath("/member/semantic/"+input.candidateId);
 revalidatePath("/member/editorial-pipeline");
 revalidatePath("/member","layout");
 return {ok:true,message:"Textové QA dokončeno; navazující redakční úkoly mohou pokračovat."};
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
