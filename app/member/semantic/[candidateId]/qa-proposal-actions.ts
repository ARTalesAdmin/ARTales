"use server";

import {revalidatePath} from "next/cache";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {createClient as createServiceClient} from "@supabase/supabase-js";
import {prepareQaPresentationBatch} from "@/lib/semantic/qaBatchPreparation";
import {planQaProposalReview,type QaProposalDecision} from "@/lib/semantic/qaProposalReview";
import type {AiQaSuggestion} from "@/lib/semantic/aiQaProposalEngine";


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
  db.from("artales_semantic_qa_flags").select("id,status,kind,target_atom_id,comment")
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
 // The editor's full decision set is persisted in ONE server-side Postgres
 // transaction. Never resolve or persist rules before the immutable revision
 // has passed the same source/owner/revision checks as manual QA.
 const byFlag=new Map(flags.map(f=>[f.id,f]));
 const repairs=[
  ...plan.exclusions.map(x=>({flagId:x.flagId,action:"exclude_note" as const})),
  ...plan.layout
 ];
 const changedAtomIds=repairs.map(x=>byFlag.get(x.flagId)?.target_atom_id);
 if(changedAtomIds.some(x=>!x)||new Set(changedAtomIds).size!==changedAtomIds.length)
  return fail("Více schválených zásahů mění tentýž blok. Uprav výběr.");
 let revisionPayload=null;
 if(repairs.length){
  const prepared=await prepareQaPresentationBatch({
   candidateId:input.candidateId,revisionSha:input.revisionSha,repairs
  },db);
  if(!prepared.ok)return fail("Nelze připravit smíšenou revizi: "+prepared.message);
  revisionPayload=prepared.revision;
 }
 const actions=new Map<string,{action:string;term:string}>();
 for(const x of plan.layout)actions.set(x.flagId,{action:x.action,term:""});
 for(const x of plan.exclusions)actions.set(x.flagId,{action:"exclude_note",term:""});
 for(const x of plan.protectedTerms)actions.set(x.flagId,{action:"protect_term",term:x.term});
 for(const id of plan.confirmedNoChange)actions.set(id,{action:"confirm_no_change",term:""});
 for(const id of plan.rejected)actions.set(id,{action:"reject",term:""});
 const decisions=input.decisions.map(d=>({
  flagId:d.flagId,...(actions.get(d.flagId)??{action:"invalid",term:""})
 }));
 if(decisions.some(d=>d.action==="invalid"))return fail("Některé rozhodnutí nelze přiřadit.");
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const serviceUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!serviceKey||!serviceUrl)return fail("Není dostupné zabezpečené ukládání QA.");
 const internal=createServiceClient(serviceUrl,serviceKey,{
  auth:{persistSession:false,autoRefreshToken:false}
 });
 const {data:committed,error:commitError}=await internal.rpc(
  "artales_commit_editorial_review_batch",{
   p_candidate_id:input.candidateId,p_parent_sha:input.revisionSha,
   p_job_id:input.jobId,p_editor_id:actor.id,
   p_revision:revisionPayload,p_decisions:decisions
  });
 if(commitError||!["created","resolved_only"].includes(committed?.result))
  return fail("Dávka nebyla zapsána; vše zůstává beze změny ("+
   (committed?.result??commitError?.code??"chyba")+").");
 revalidatePath("/member/semantic/"+input.candidateId);
 revalidatePath("/member/editorial-pipeline");
 revalidatePath("/member","layout");
 const created=committed.result==="created";
 return {ok:true,revisionCreated:created,
  resolved:committed.resolved??0,remaining:committed.remaining??plan.rejected.length,
  message:created?
   "Schválené vyřazení a sazba byly atomicky uloženy v jedné revizi. "+
   "Neschválené nálezy pokračují u stejného editora; archiv je nedotčen.":
   "Schválená pravidla a redakční rozhodnutí jsou zapsána. "+
   "Neschválené nálezy zůstávají otevřené."};
}
