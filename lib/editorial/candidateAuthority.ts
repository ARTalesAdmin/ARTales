import "server-only";
import {createClient} from "@/lib/supabase/server";
import type {EditorialPerson} from "@/lib/editorial/staffDirectory";

type Identity=Pick<EditorialPerson,"id"|"role"|"is_active">;

/** Scoped workflow rights, independently enforced by database RLS/RPCs.
 * Manual titles belong to their creator; Prescreen is shared until an
 * approved human legal decision, then follows that reviewer. Admin may act.
 */
export async function canProgressCandidate(candidateId:string,actor:Identity):Promise<boolean>{
 if(!actor.is_active||!["admin","editor"].includes(actor.role))return false;
 const db=await createClient();
 const {data:candidate,error}=await db.from("work_candidates")
  .select("origin,created_by").eq("id",candidateId).maybeSingle();
 if(error||!candidate)return false;
 if(actor.role==="admin")return true;
 if(candidate.origin==="manual")return candidate.created_by===actor.id;
 if(candidate.origin!=="prescreen")return false;
 const {data:lock,error:lockError}=await db.from("candidate_legal_locks")
  .select("source_id,decision_no").eq("candidate_id",candidateId).maybeSingle();
 if(lockError)return false;
 let reviewer:string|null=null;
 if(lock){
  const {data:approved,error:e}=await db.from("candidate_legal_decisions")
   .select("reviewed_by,verdict").eq("candidate_id",candidateId)
   .eq("source_id",lock.source_id).eq("decision_no",lock.decision_no).maybeSingle();
  if(e||!approved||approved.verdict!=="approved")return false;
  reviewer=approved.reviewed_by;
 }else{
  const {data:approved,error:e}=await db.from("candidate_legal_decisions")
   .select("reviewed_by").eq("candidate_id",candidateId)
   .eq("verdict","approved").order("decision_no",{ascending:false})
   .limit(1).maybeSingle();
  if(e)return false;
  reviewer=approved?.reviewed_by??null;
 }
 return !reviewer||reviewer===actor.id;
}
export async function canAssignCandidate(candidateId:string,actor:Identity):Promise<boolean>{
 if(!await canProgressCandidate(candidateId,actor))return false;
 if(actor.role==="admin")return true;
 const db=await createClient();
 const {data:candidate,error}=await db.from("work_candidates")
  .select("origin,created_by").eq("id",candidateId).maybeSingle();
 if(error||!candidate)return false;
 if(candidate.origin==="manual")return candidate.created_by===actor.id;
 const {data:lock,error:e}=await db.from("candidate_legal_locks")
  .select("source_id,decision_no").eq("candidate_id",candidateId).maybeSingle();
 if(e||!lock)return false;
 const {data:approval,error:ae}=await db.from("candidate_legal_decisions")
  .select("reviewed_by,verdict").eq("candidate_id",candidateId)
  .eq("source_id",lock.source_id).eq("decision_no",lock.decision_no).maybeSingle();
 return !ae&&approval?.verdict==="approved"&&approval.reviewed_by===actor.id;
}
