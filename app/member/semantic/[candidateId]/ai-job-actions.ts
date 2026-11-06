"use server";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import type {AiQaSuggestion} from "@/lib/semantic/aiQaProposalEngine";
import {walkSemanticAtoms,verifySemanticRevision} from "@/lib/semantic/compose";
import type {SemanticRevision} from "@/lib/semantic/model";
import {revalidatePath} from "next/cache";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha=/^[a-f0-9]{64}$/;
const enabled=()=>process.env.ARTALES_AI_DURABLE_JOBS_ENABLED==="enabled";
// Report only the missing capability, never environment values or credentials.
function configurationIssue():string|null{
 if(!process.env.CRON_SECRET||process.env.CRON_SECRET.length<16)
  return "Chybí autorizace interní AI fronty (cron).";
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)
  return "Není dostupné serverové spojení s databází.";
 // OIDC is injected on the worker Request header, not in the server-action env.
 if(!process.env.ARTALES_EDITORIAL_AI_MODEL)
  return "Není nakonfigurovaný AI model.";
 return null;
}
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
 const missing=configurationIssue();
 if(missing)return fail("Úloha nevznikla. "+missing);
 const db=await createClient();
 const {data,error}=await db.rpc("artales_enqueue_ai_qa_job",{
  p_candidate_id:input.candidateId,p_revision_sha256:input.revisionSha
 });
 if(error){
  // Only the PostgREST error code is shown, never the SQL query or credentials.
  return fail("Úlohu nelze zařadit: databázová chyba ("+(error.code??"neznámý kód")+").");
 }
 if(!data)return fail("Úlohu nelze zařadit: databáze nevrátila výsledek.");
 if(!["queued","existing"].includes(data.result)||!uuid.test(data.job_id??""))
  return fail("Úlohu nelze zařadit ("+String(data.result??"neznámý stav")+").");
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
 const missing=configurationIssue();
 if(missing)return fail("ARTales AI není připravena. "+missing);
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


/**
 * A general request is a normal, source-anchored QA finding with a special
 * instruction. The existing identity-bound durable job, retries, RLS and token
 * ledger remain authoritative. No new DB schema or background privilege.
 */
export async function enqueueGeneralSemanticQaJob(input:{
 candidateId:string;revisionSha:string;instruction:string;exampleAtomId:string|null;
}):Promise<QaJobStatus>{
 const actor=await requireEditorOrAdmin();
 if(!enabled())return fail("ARTales AI není zapnutá.");
 const instruction=input.instruction?.trim()??"";
 if(!uuid.test(input.candidateId)||!sha.test(input.revisionSha)||
    instruction.length<20||instruction.length>550||
    (input.exampleAtomId!==null&&
     (typeof input.exampleAtomId!=="string"||input.exampleAtomId.length>160)))
  return fail("Popiš obecný problém alespoň 20 a nejvýše 550 znaky.");
 const missing=configurationIssue();
 if(missing)return fail("Úlohu nelze založit. "+missing);
 const db=await createClient();
 const [{data:record,error:revisionError},{data:task,error:taskError}]=await Promise.all([
  db.from("candidate_semantic_revisions").select("revision,source_text,revision_sha256")
   .eq("candidate_id",input.candidateId).order("created_at",{ascending:false})
   .order("id",{ascending:false}).limit(1).maybeSingle(),
  db.from("artales_editorial_tasks").select("id")
   .eq("candidate_id",input.candidateId).eq("revision_sha256",input.revisionSha)
   .eq("kind","text_review").eq("status","claimed")
   .eq("assigned_to",actor.id).limit(1).maybeSingle()
 ]);
 if(revisionError||!record||record.revision_sha256!==input.revisionSha||
    taskError||!task)return fail("Nejsi vlastníkem právě převzaté aktuální QA kontroly.");
 let atoms:ReturnType<typeof walkSemanticAtoms>;
 try{
  const revision=record.revision as SemanticRevision;
  verifySemanticRevision(revision,record.source_text);
  atoms=walkSemanticAtoms(revision.blocks);
 }catch{return fail("Nepodařilo se ověřit neporušenou revizi textu.");}
 const example=atoms.find(a=>a.id===input.exampleAtomId);
 if(input.exampleAtomId&&!example)return fail("Ukázkový blok již není v této revizi.");
 const anchor=example??atoms.find(a=>a.raw.trim().length>0);
 if(!anchor)return fail("Dílo neobsahuje žádný použitelný textový blok.");
 const comment=(example?"Obecné zadání s ukázkou: ":"Obecné zadání pro dílo: ")+instruction;
 // Repeated clicks must not create duplicate QA findings or duplicate billing.
 const {data:existing,error:existingError}=await db.from("artales_semantic_qa_flags")
  .select("id").eq("candidate_id",input.candidateId)
  .eq("revision_sha256",input.revisionSha).eq("status","open")
  .eq("kind","other").eq("comment",comment)
  .limit(1).maybeSingle();
 if(existingError)return fail("Nepodařilo se ověřit starší obecná zadání.");
 if(!existing){
  const {error:flagError}=await db.from("artales_semantic_qa_flags").insert({
   candidate_id:input.candidateId,revision_sha256:input.revisionSha,
   target_atom_id:anchor.id,source_start:anchor.anchor.normalized_start,
   source_end:anchor.anchor.normalized_end,kind:"other",comment,created_by:actor.id
  });
  if(flagError)return fail("Obecné zadání se nepodařilo bezpečně uložit.");
 }
 revalidatePath("/member/semantic/"+input.candidateId);
 return enqueueSemanticAiQaJob({candidateId:input.candidateId,revisionSha:input.revisionSha});
}
