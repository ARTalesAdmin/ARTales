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
 const {count:openCount,error:countError}=await db.from("artales_semantic_qa_flags")
  .select("id",{count:"exact",head:true})
  .eq("candidate_id",input.candidateId).eq("revision_sha256",input.revisionSha)
  .eq("status","open");
 if(countError||openCount===null)return fail("Nebylo možné ověřit počet otevřených nálezů.");
 const comment=(example?"Obecné zadání s ukázkou: ":"Obecné zadání pro dílo: ")+instruction;
 // Repeated clicks must not create duplicate QA findings or duplicate billing.
 const {data:existing,error:existingError}=await db.from("artales_semantic_qa_flags")
  .select("id").eq("candidate_id",input.candidateId)
  .eq("revision_sha256",input.revisionSha).eq("status","open")
  .eq("kind","other").eq("comment",comment)
  .limit(1).maybeSingle();
 if(existingError)return fail("Nepodařilo se ověřit starší obecná zadání.");
 if(!existing){
  if(openCount>=25)return fail("V této revizi je už 25 otevřených nálezů. Nejprve vyřeš část stávajících.");
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


/** The editor approves model-suggested targets; only server-validated source atoms
 * may become durable follow-up QA findings. A single INSERT is atomic. */
export async function adoptGeneralQaTargets(input:{
 jobId:string;targetAtomIds:string[];kind:"typography"|"structure"|"other"
}):Promise<{ok:boolean;message:string}>{
 const failAdopt=(message:string)=>({ok:false,message});
 const actor=await requireEditorOrAdmin();
 if(!uuid.test(input.jobId)||!Array.isArray(input.targetAtomIds)||
    input.targetAtomIds.length<1||input.targetAtomIds.length>24||
    new Set(input.targetAtomIds).size!==input.targetAtomIds.length||
    !["typography","structure","other"].includes(input.kind))
  return failAdopt("Vyber nejvýše 24 jedinečných navržených bloků a jejich typ problému.");
 const db=await createClient();
 const {data:job,error:jobError}=await db.from("artales_semantic_ai_qa_jobs")
  .select("id,candidate_id,revision_sha256,created_by,status,suggestions")
  .eq("id",input.jobId).maybeSingle();
 if(jobError||!job||job.created_by!==actor.id||job.status!=="completed"||
    !Array.isArray(job.suggestions))
  return failAdopt("Návrhy nejsou dostupné nebo nepatří k tvé dokončené AI úloze.");
 const [{data:record,error:revisionError},{data:task,error:taskError},{data:generalFlags,error:flagsError}]=
 await Promise.all([
  db.from("candidate_semantic_revisions").select("revision,source_text,revision_sha256")
   .eq("candidate_id",job.candidate_id).order("created_at",{ascending:false})
   .order("id",{ascending:false}).limit(1).maybeSingle(),
  db.from("artales_editorial_tasks").select("id")
   .eq("candidate_id",job.candidate_id).eq("revision_sha256",job.revision_sha256)
   .eq("assigned_to",actor.id).eq("kind","text_review").eq("status","claimed")
   .limit(1).maybeSingle(),
  db.from("artales_semantic_qa_flags").select("id,comment")
   .eq("candidate_id",job.candidate_id).eq("revision_sha256",job.revision_sha256)
   .in("id",(job.suggestions as AiQaSuggestion[]).map(s=>s.flagId))
 ]);
 if(revisionError||!record||record.revision_sha256!==job.revision_sha256||
    taskError||!task||flagsError||!generalFlags)
  return failAdopt("Revize nebo přiřazení redakční kontroly už nejsou aktuální.");
 let atoms:ReturnType<typeof walkSemanticAtoms>;
 try{
  const revision=record.revision as SemanticRevision;
  verifySemanticRevision(revision,record.source_text);
  atoms=walkSemanticAtoms(revision.blocks);
 }catch{return failAdopt("Integrita původního textu nebyla potvrzena.");}
 const generalIds=new Set(generalFlags.filter(f=>f.comment.startsWith("Obecné zadání "))
  .map(f=>f.id));
 const allowed=new Set((job.suggestions as AiQaSuggestion[])
  .filter(s=>generalIds.has(s.flagId))
  .flatMap(s=>Array.isArray(s.targetAtomIds)?s.targetAtomIds:[]));
 if(input.targetAtomIds.some(id=>!allowed.has(id)))
  return failAdopt("Některý blok nebyl doložen ověřeným návrhem této AI úlohy.");
 const originalAtoms=new Map(atoms.map(a=>[a.id,a]));
 if(input.targetAtomIds.some(id=>!originalAtoms.has(id)))
  return failAdopt("Navržené bloky nejsou v aktuální revizi.");
 const general=generalFlags.find(f=>f.comment.startsWith("Obecné zadání "));
 if(!general)return failAdopt("Původní obecné zadání nebylo nalezeno.");
 const note=general.comment.slice(0,500);
 const {data:already,error:alreadyError}=await db.from("artales_semantic_qa_flags")
  .select("target_atom_id,comment").eq("candidate_id",job.candidate_id)
  .eq("revision_sha256",job.revision_sha256).eq("status","open")
  .in("target_atom_id",input.targetAtomIds).eq("comment",note);
 if(alreadyError)return failAdopt("Nelze ověřit již převzaté bloky.");
 const dedup=new Set((already??[]).map(x=>x.target_atom_id));
 const additions=input.targetAtomIds.filter(id=>!dedup.has(id));
 if(!additions.length)return {ok:true,message:"Všechny vybrané bloky už jsou v otevřených nálezech."};
 const {count,error:countError}=await db.from("artales_semantic_qa_flags")
  .select("id",{head:true,count:"exact"}).eq("candidate_id",job.candidate_id)
  .eq("revision_sha256",job.revision_sha256).eq("status","open");
 if(countError||count===null||count+additions.length>25)
  return failAdopt("Počet nálezů by překročil limit 25. Vyber menší dávku.");
 const {error:insertError}=await db.from("artales_semantic_qa_flags").insert(
  additions.map(id=>{
   const atom=originalAtoms.get(id)!;
   return {candidate_id:job.candidate_id,revision_sha256:job.revision_sha256,
    target_atom_id:id,source_start:atom.anchor.normalized_start,
    source_end:atom.anchor.normalized_end,kind:input.kind,
    comment:note,created_by:actor.id};
  })
 );
 if(insertError)return failAdopt("Vybrané bloky se nepodařilo společně uložit.");
 revalidatePath("/member/semantic/"+job.candidate_id);
 return {ok:true,message:"Přidáno "+additions.length+
  " bloků mezi QA nálezy. Nyní je můžeš jedním tlačítkem odeslat k opravě."};
}
