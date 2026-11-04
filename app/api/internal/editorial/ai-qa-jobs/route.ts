import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {timingSafeEqual} from "node:crypto";
import {generateSemanticAiQaSuggestions} from "@/lib/semantic/aiQaProposalEngine";

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
 if(!url||!roleKey||!process.env.ARTALES_EDITORIAL_AI_API_KEY||
   !process.env.ARTALES_EDITORIAL_AI_MODEL)
  return NextResponse.json({status:"not_configured"},{status:503});
 const db=createClient(url,roleKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:job,error:claimError}=await db.rpc("artales_claim_ai_qa_job");
 if(claimError||!job)
  return NextResponse.json({status:"queue_unavailable"},{status:503});
 if(job.result==="empty")return NextResponse.json({status:"empty"});
 if(job.result!=="claimed"||!uuid.test(job.job_id??"")||
   !uuid.test(job.candidate_id??"")||!sha.test(job.revision_sha256??"")||
   !Array.isArray(job.flag_ids))
  return NextResponse.json({status:"invalid_claim"},{status:500});
 const input={candidateId:job.candidate_id as string,
  revisionSha:job.revision_sha256 as string,expectedFlagIds:job.flag_ids as string[]};
 let suggestions:unknown=null;
 let errorCode:string|null=null;
 try{
  const answer=await generateSemanticAiQaSuggestions(input,db);
  if(answer.ok)suggestions=answer.suggestions;
  else errorCode="validation_or_provider_failed";
 }catch{errorCode="worker_exception";}
 const {data:stored,error:finishError}=await db.rpc("artales_finish_ai_qa_job",{
  p_job_id:job.job_id,p_suggestions:suggestions,p_error_code:errorCode
 });
 if(finishError||stored?.result!=="stored")
  return NextResponse.json({status:"persist_failed"},{status:503});
 return NextResponse.json({status:errorCode?"failed":"completed",job_id:job.job_id});
}
