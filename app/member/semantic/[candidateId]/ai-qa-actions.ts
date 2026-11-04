"use server";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {generateSemanticAiQaSuggestions,type AiQaSuggestResult} from "@/lib/semantic/aiQaProposalEngine";
export type {AiQaSuggestion,AiQaSuggestResult} from "@/lib/semantic/aiQaProposalEngine";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha=/^[a-f0-9]{64}$/;

/** Foreground read-only proposal. Durable queue is available as an alternative. */
export async function suggestSemanticQaRepairs(input:{
 candidateId:string;revisionSha:string
}):Promise<AiQaSuggestResult>{
 const actor=await requireEditorOrAdmin();
 const fail=(message:string):AiQaSuggestResult=>({ok:false,message,suggestions:[]});
 if(!uuid.test(input.candidateId)||!sha.test(input.revisionSha))
  return fail("Neplatná identita díla nebo revize.");
 const db=await createClient();
 if(actor.role!=="admin"){
  const {data:task,error:taskError}=await db.from("artales_editorial_tasks")
   .select("id").eq("candidate_id",input.candidateId)
   .eq("revision_sha256",input.revisionSha).eq("kind","text_review")
   .eq("assigned_to",actor.id).eq("status","claimed").limit(1);
  if(taskError||!task?.length)return fail("AI návrhy smí vyžádat pouze aktuální editor QA.");
 }
 return generateSemanticAiQaSuggestions(input,db);
}
