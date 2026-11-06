"use server";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import type {AiQaSuggestion} from "@/lib/semantic/aiQaProposalEngine";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const sha=/^[a-f0-9]{64}$/;
const enabled=()=>process.env.ARTALES_AI_DURABLE_JOBS_ENABLED==="enabled";
const configured=()=>Boolean(process.env.CRON_SECRET&&process.env.CRON_SECRET.length>=16&&
 process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.VERCEL_OIDC_TOKEN&&
 process.env.ARTALES_EDITORIAL_AI_MODEL);
export type QaJobStatus={
 ok:boolean;jobId:string|null;status:"queued"|"running"|"completed"|"failed"|"none";
 message:string;suggestions:AiQaSuggestion[];appliedRevisionSha?:string|null;disabled?:boolean;
};
const fail=(message:string):QaJobStatus=>({
 ok:false,jobId:null,status:"none",message,suggestions:[]
});
const parseRow=(row:{id:string;status:string;suggestions:unknown;error_code:string|null;applied_revision_sha256:string|null}):QaJobStatus=>{
 const status=["queued","running","completed","failed"].includes(row.status)
  ?row.status as QaJobStatus["status"]:"failed";
 const suggested=Array.isArray(row.suggestions)?row.suggestions as AiQaSuggestion[]:[];
 return {ok:true,jobId:row.id,status,appliedRevisionSha:row.applied_revision_sha256,
  suggestions:status==="completed"?suggested:[],
  message:status==="queued"?"Oprava čeká ve frontě ARTales AI; můžeš odejít a později se vrátit."
   :status==="running"?"AI připravuje sazební návrhy. Můžeš pokračovat v jiné práci."
   :status==="completed"?"Návrhy jsou připravené k redakční kontrole."
   :"AI dávka nebyla dokončena ("+(row.error_code??"neznámá chyba")+")."
 };
};
export async function enqueueSemanticAiQaJob(input:{
 candidateId:string;revisionSha:string
}):Promise<QaJobStatus>{
 await requireEditorOrAdmin();
 if(!enabled())return {...fail("Trvalá AI fronta zatím není zapnutá."),disabled:true};
 if(!uuid.test(input.candidateId)||!sha.test(input.revisionSha))
  return fail("Neplatná identita díla nebo revize.");
 if(!configured())return fail("Trvalá AI fronta není úplně nastavena; úloha nevznikla.");
 const db=await createClient();
 const {data,error}=await db.rpc("artales_enqueue_ai_qa_job",{
  p_candidate_id:input.candidateId,p_revision_sha256:input.revisionSha
 });
 if(error||!data||!["queued","existing"].includes(data.result)||!uuid.test(data.job_id??""))
  return fail("Úlohu nelze zařadit: "+String(data?.result??"nedostupná DB vrstva"));
 return readSemanticAiQaJob({jobId:data.job_id});
}
export async function readSemanticAiQaJob(input:{jobId:string}):Promise<QaJobStatus>{
 const actor=await requireEditorOrAdmin();
 if(!enabled())return fail("Trvalá AI fronta zatím není zapnutá.");
 if(!uuid.test(input.jobId))return fail("Neplatné ID AI úlohy.");
 const db=await createClient();
 const {data,error}=await db.from("artales_semantic_ai_qa_jobs")
  .select("id,status,suggestions,error_code,created_by,applied_revision_sha256")
  .eq("id",input.jobId).maybeSingle();
 if(error||!data|| (actor.role!=="admin"&&data.created_by!==actor.id))
  return fail("Úloha není dostupná.");
 return parseRow(data);
}
export async function lastSemanticAiQaJob(input:{
 candidateId:string;revisionSha:string
}):Promise<QaJobStatus>{
 const actor=await requireEditorOrAdmin();
 if(!enabled())return fail("Trvalá AI fronta zatím není zapnutá.");
 if(!uuid.test(input.candidateId)||!sha.test(input.revisionSha))
  return fail("Neplatná identita díla nebo revize.");
 const db=await createClient();
 const {data,error}=await db.from("artales_semantic_ai_qa_jobs")
  .select("id,status,suggestions,error_code,created_by,applied_revision_sha256")
  .eq("candidate_id",input.candidateId).eq("revision_sha256",input.revisionSha)
  .eq("created_by",actor.id).order("created_at",{ascending:false})
  .limit(1).maybeSingle();
 if(error)return fail("Trvalá AI fronta není dostupná.");
 if(!data)return {ok:true,jobId:null,status:"none",message:"Bez předchozí AI dávky.",suggestions:[]};
 return parseRow(data);
}
