import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {timingSafeEqual} from "node:crypto";
import {generateSemanticAiQaSuggestions} from "@/lib/semantic/aiQaProposalEngine";
import {prepareQaPresentationBatch,type EditorialBatchAction} from "@/lib/semantic/qaBatchPreparation";

export const dynamic="force-dynamic";
export const maxDuration=60;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha=/^[a-f0-9]{64}$/;
function authorized(authorization:string|null,secret:string|undefined){
 if(!secret||secret.length<16||!authorization)return false;
 const a=Buffer.from(authorization),b=Buffer.from("Bearer "+secret);
 return a.length===b.length&&timingSafeEqual(a,b);
}
/** Production cron only. Requires CRON_SECRET and service-role DB authorization. */
export async function GET(request:NextRequest){
 if(!authorized(request.headers.get("authorization"),process.env.CRON_SECRET))
  return NextResponse.json({error:"unauthorized"},{status:401});
 if(process.env.ARTALES_AI_DURABLE_JOBS_ENABLED!=="enabled")
  return NextResponse.json({status:"disabled"},{status:503});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,roleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 // Vercel injects the OIDC token per invocation in Request headers.
 // It is not available through process.env in production functions.
 const oidcToken=request.headers.get("x-vercel-oidc-token");
 if(!url||!roleKey||!process.env.ARTALES_EDITORIAL_AI_MODEL)
  return NextResponse.json({status:"not_configured"},{status:503});
 if(!oidcToken)
  return NextResponse.json({status:"gateway_oidc_unavailable"},{status:503});
 const db=createClient(url,roleKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:job,error:claimError}=await db.rpc("artales_claim_ai_qa_job");
 if(claimError||!job)
  return NextResponse.json({status:"queue_unavailable"},{status:503});
 if(job.result==="empty")return NextResponse.json({status:"empty"});
 if(job.result!=="claimed"||!uuid.test(job.job_id??"")||
   !uuid.test(job.candidate_id??"")||!sha.test(job.revision_sha256??"")||
   !uuid.test(job.created_by??"")||!Array.isArray(job.flag_ids))
  return NextResponse.json({status:"invalid_claim"},{status:500});
 const input={candidateId:job.candidate_id as string,
  revisionSha:job.revision_sha256 as string,editorId:job.created_by as string,
  oidcToken,expectedFlagIds:job.flag_ids as string[]};
 let suggestions:unknown=null;
 let errorCode:string|null=null;
 let appliedRevisionSha:string|null=null;
 try{
  const answer=await generateSemanticAiQaSuggestions(input,db);
  if(answer.usage){
   const u=answer.usage;
   // A job can run twice after a worker timeout. Keep each billed generation.
   const {error:usageError}=await db.from("artales_semantic_ai_usage").upsert({
    generation_id:u.generationId,job_id:job.job_id,
    candidate_id:u.candidateId,requested_by:u.requestedBy,model:u.model,
    input_tokens:u.inputTokens,output_tokens:u.outputTokens,total_tokens:u.totalTokens,
    cost_usd:u.costUsd,cost_status:u.status
   },{onConflict:"generation_id",ignoreDuplicates:true});
   if(usageError)throw Error("gateway_usage_receipt_failed");
  }
  if(!answer.ok)errorCode="validation_or_provider_failed";
  else{
   suggestions=answer.suggestions;
   // A protected name/title is a rendering-only instruction for this work.
   // The editor authorized this through the assigned QA job; there is no
   // additional administrator approval and no mutation of source text.
   const terms=answer.suggestions.filter(x=>x.action==="protect_term");
   for(const item of terms){
    const {error:termError}=await db.from("artales_work_typography_rules").upsert({
      candidate_id:input.candidateId,term:item.term.trim(),created_by:job.created_by
    },{onConflict:"candidate_id,term",ignoreDuplicates:true});
    if(termError)throw Error("protected_term_write_failed");
   }
   // "Send for repair" is authorization for strictly presentation-only corrections.
   // Uncertain or non-layout findings stay OPEN and never get edited by AI.
   const safe=new Set<EditorialBatchAction>(["compact","airy","center"]);
   const repairs=answer.suggestions.filter(x=>safe.has(x.action as EditorialBatchAction))
    .map(x=>({flagId:x.flagId,action:x.action as EditorialBatchAction}));
   if(repairs.length){
    const prepared=await prepareQaPresentationBatch({
     candidateId:input.candidateId,revisionSha:input.revisionSha,repairs
    },db);
    if(!prepared.ok)errorCode="layout_validation_failed";
    else{
     const {data:committed,error:commitError}=await db.rpc("artales_commit_safe_layout_revision",{
      p_candidate_id:input.candidateId,p_parent_sha:input.revisionSha,
      p_revision:prepared.revision,p_flag_ids:repairs.map(x=>x.flagId),
      p_editor_id:job.created_by,p_job_id:job.job_id,
      p_job_suggestions:answer.suggestions
     });
     if(commitError||committed?.result!=="created")errorCode="layout_commit_failed";
     else appliedRevisionSha=committed.revision_sha256;
    }
   }
  }
 }catch{errorCode="worker_exception";}
 // The safe commit already saved a completed job receipt in the same transaction.
 if(appliedRevisionSha)return NextResponse.json({
  status:"completed",job_id:job.job_id,applied_revision_sha256:appliedRevisionSha
 });
 const {data:stored,error:finishError}=await db.rpc("artales_finish_ai_qa_job",{
  p_job_id:job.job_id,p_suggestions:suggestions,p_error_code:errorCode,
  p_applied_revision_sha:appliedRevisionSha
 });
 if(finishError||stored?.result!=="stored")
  return NextResponse.json({status:"persist_failed"},{status:503});
 return NextResponse.json({status:errorCode?"failed":"completed",job_id:job.job_id});
}
