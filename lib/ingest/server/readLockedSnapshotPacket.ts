import "server-only";
import {requireAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import type {VerifiedLegalSnapshotPacket} from "../verifiedLegalSnapshotHandoff";

/** Read-only Next.js server gate. Called only behind a separately approved
 * application workflow, never from a browser-supplied lock or role claim.
 * It creates no Snapshot and does not grant access to Storage. */
export async function readLockedSnapshotPacket(candidateId:string):Promise<VerifiedLegalSnapshotPacket> {
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidateId))
  throw new Error("invalid_snapshot_candidate");
 const profile=await requireAdmin();
 if(profile.role!=="admin"||profile.is_active!==true)throw new Error("snapshot_admin_required");
 const db=await createClient();
 const {data:lock,error:lockError}=await db.from("candidate_legal_locks")
  .select("candidate_id,source_id,decision_no,source_url,download_url,source_facts,illustrations,locked_at,locked_by")
  .eq("candidate_id",candidateId).maybeSingle();
 if(lockError||!lock)throw new Error("snapshot_lock_missing");
 const [candidateResult,sourceResult,decisionResult]=await Promise.all([
  db.from("work_candidates").select("id,proposed_title,proposed_author_name").eq("id",candidateId).maybeSingle(),
  db.from("candidate_legal_sources")
   .select("id,candidate_id,source_kind,edition_title,source_url,download_url,identity_match,language_match,text_format,language_code")
   .eq("candidate_id",candidateId).eq("id",lock.source_id).maybeSingle(),
  db.from("candidate_legal_decisions")
   .select("decision_no,candidate_id,source_id,verdict,territory,recorded_at,reviewed_by")
   .eq("candidate_id",candidateId).eq("decision_no",lock.decision_no).maybeSingle()
 ]);
 if(candidateResult.error||sourceResult.error||decisionResult.error||
    !candidateResult.data||!sourceResult.data||!decisionResult.data)
  throw new Error("snapshot_linked_legal_evidence_missing");
 // Pure verifier (planLockedSnapshot) enforces all cross-record identity and
 // legal authority invariants before any binary can be admitted.
 return {
  actor:{id:profile.id,role:"admin",is_active:true},
  candidate:candidateResult.data,
  source:sourceResult.data,
  approved:decisionResult.data,
  lock,
 } as VerifiedLegalSnapshotPacket;
}