"use server";

import {revalidatePath} from "next/cache";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {planQaProposalReview,type QaProposalDecision} from "@/lib/semantic/qaProposalReview";
import type {AiQaSuggestion} from "@/lib/semantic/aiQaProposalEngine";
import {saveWorkTypographyRule,resolveSemanticQaFlag,commitSemanticQaBatch} from "./qa-actions";

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const sha=/^[a-f0-9]{64}$/;

export type QaProposalApplyResult={
 ok:boolean;message:string;revisionCreated:boolean;resolved:number;remaining:number;
};

/** No model call. Source/job/flags/ownership are checked again on the server.
 * Layout commit stays behind the existing immutable service-only RPC. */
export async function applyReviewedQaProposals(input:{
 candidateId:string;revisionSha:string;jobId:string;decisions:QaProposalDecision[];
}):Promise<QaProposalApplyResult>{
 const fail=(message:string):QaProposalApplyResult=>({
  ok:false,message,revisionCreated:false,resolved:0,remaining:0
 });
 const actor=await requireEditorOrAdmin();
 if(!uuid.test(input.candidateId)||!sha.test(input.revisionSha)||
  !uuid.test(input.jobId)||!Array.isArray(input.decisions)||
  input.decisions.length<1||input.decisions.length>25)
  return fail("Návrhy nemají platnou identitu nebo úplná rozhodnutí.");
 const db=await createClient();
 const [{data:job,error:jobError},{data:revision,error:revisionError},
  {data:task,error:taskError},{data:flags,error:flagsError}]=await Promise.all([
  db.from("artales_semantic_ai_qa_jobs")
   .select("id,candidate_id,revision_sha256,created_by,status,suggestions")
   .eq("id",input.jobId).maybeSingle(),
  db.from("candidate_semantic_revisions").select("revision_sha256")
   .eq("candidate_id",input.candidateId)
   .order("created_at",{ascending:false}).order("id",{ascending:false})
   .limit(1).maybeSingle(),
  db.from("artales_editorial_tasks").select("id")
   .eq("candidate_id",input.candidateId).eq("revision_sha256",input.revisionSha)
   .eq("assigned_to",actor.id).eq("status","claimed").eq("kind","text_review")
   .maybeSingle(),
  db.from("artales_semantic_qa_flags").select("id,status,kind,target_atom_id")
   .eq("candidate_id",input.candidateId)
   .eq("revision_sha256",input.revisionSha)
 ]);
 if(jobError||!job||job.candidate_id!==input.candidateId||
  job.revision_sha256!==input.revisionSha||job.created_by!==actor.id||
  job.status!=="completed"||!Array.isArray(job.suggestions)||
  revisionError||!revision||revision.revision_sha256!==input.revisionSha||
  taskError||!task||flagsError||!flags)
  return fail("Úloha, aktuální QA revize nebo vlastník nesouhlasí. Obnov stránku.");
 let plan;
 try{
  plan=planQaProposalReview(job.suggestions as AiQaSuggestion[],flags,input.decisions);
 }catch(e){return fail(e instanceof Error?e.message:"Nelze bezpečně ověřit rozhodnutí.");}
 const byFlag=new Map(flags.map(f=>[f.id,f]));
 const layoutTargets=plan.layout.map(x=>byFlag.get(x.flagId)?.target_atom_id);
 if(new Set(layoutTargets).size!==layoutTargets.length)
  return fail("Více přijatých sazebních návrhů mění stejný blok. Ponech jeden návrh "+
   "k opravě a znovu zkontroluj společný náhled.");
 let resolved=0;
 // Apply safe work-wide protections first, idempotently. Never edit source bytes.
 for(const change of plan.protectedTerms){
  const rule=await saveWorkTypographyRule({candidateId:input.candidateId,term:change.term});
  if(!rule.ok)return fail("Ukládání bylo přerušeno: "+rule.message);
  if(byFlag.get(change.flagId)?.status==="resolved")continue;
  const closed=await resolveSemanticQaFlag({
   candidateId:input.candidateId,flagId:change.flagId,
   resolutionNote:"Editor přijal a ověřil ochranu výrazu „"+change.term+
    "“ pro celé dílo. Zdrojový text ani obsahová struktura nebyly upraveny."
  });
  if(!closed.ok)return fail("Ochrana výrazu je uložená, ale nález zůstal otevřený: "+closed.message);
  resolved++;
 }
 // Explicit editorial acknowledgement that no textual/layout change is warranted.
 // This is not an autonomous AI acceptance.
 for(const id of plan.confirmedNoChange){
  if(byFlag.get(id)?.status==="resolved")continue;
  const closed=await resolveSemanticQaFlag({
   candidateId:input.candidateId,flagId:id,
   resolutionNote:"Editor po vizuálním posouzení označil návrh jako prověřený bez potřeby "+
    "další změny. Jde o výslovné redakční rozhodnutí, nikoli automatické schválení AI."
  });
  if(!closed.ok)return fail("Část rozhodnutí je uložena; některý nález čeká: "+closed.message);
  resolved++;
 }
 if(plan.layout.length){
  const result=await commitSemanticQaBatch({
   candidateId:input.candidateId,revisionSha:input.revisionSha,
   repairs:plan.layout
  });
  if(!result.ok)return {
   ok:false,message:"Dosavadní rozhodnutí byla zaznamenána, ale novou revizi nelze vytvořit: "+
    result.message,revisionCreated:false,resolved,remaining:plan.rejected.length+plan.layout.length
  };
  revalidatePath("/member/semantic/"+input.candidateId);
  return {ok:true,revisionCreated:true,resolved,remaining:plan.rejected.length,
   message:"Schválené sazební změny byly společně uloženy do nové revize. "+
    "Nyní ověř změněné bloky a dokonči QA, až nezůstanou otevřené nálezy."};
 }
 revalidatePath("/member/semantic/"+input.candidateId);
 revalidatePath("/member/editorial-pipeline");
 return {ok:true,revisionCreated:false,resolved,remaining:plan.rejected.length,
  message:"Rozhodnutí byla uložena. Nebyla provedena žádná změna sazby, proto nevzniká "+
   "umělá nová revize. Zbývající nálezy je potřeba posoudit."};
}
