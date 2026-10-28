import {createClient} from "@/lib/supabase/server";
import {requireEditorOrAdmin} from "@/lib/guards";
import {deriveSnapshotActionState} from "@/lib/ingest/generalSnapshotAction";
import type {SnapshotActionState} from "@/lib/ingest/generalSnapshotAction";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function getCandidateSnapshotState(candidateId:string):Promise<SnapshotActionState>{
 await requireEditorOrAdmin();
 if(!uuid.test(candidateId))throw Error("invalid_candidate_id");
 const db=await createClient();
 const [{data:lock,error:le},{data:receipt,error:re},{data:claim,error:ce}]=await Promise.all([
  db.from("candidate_legal_locks").select("candidate_id,decision_no,source_url,source_facts").eq("candidate_id",candidateId).maybeSingle(),
  db.from("candidate_snapshots").select("candidate_id,sha256,readback_status,content_correspondence").eq("candidate_id",candidateId).maybeSingle(),
  db.from("candidate_snapshot_claims").select("candidate_id").eq("candidate_id",candidateId).maybeSingle()
 ]);
 if(le||re||ce)throw Error("snapshot_registry_unavailable");
 if(!lock)return deriveSnapshotActionState({approved:false,locked:false,sourceAvailable:false});
 const {data:decision,error:de}=await db.from("candidate_legal_decisions")
  .select("decision_no,verdict").eq("candidate_id",candidateId).eq("decision_no",lock.decision_no).maybeSingle();
 if(de)throw Error("snapshot_legal_read_failed");
 const facts=lock.source_facts&&typeof lock.source_facts==="object"&&!Array.isArray(lock.source_facts)
  ?lock.source_facts as Record<string,unknown>:null;
 // The route currently archives EPUB only. Avoid presenting a button on a
 // legally locked HTML/TXT title that the server must reject.
 const acquisitionEligible=
  /^https:\/\/www\.gutenberg\.org\/ebooks\/[1-9][0-9]{0,7}$/.test(lock.source_url) &&
  facts?.kind==="gutenberg" && facts?.textFormat==="epub";
 return deriveSnapshotActionState({
  approved:decision?.verdict==="approved",locked:true,
  sourceAvailable:acquisitionEligible,
  receipt:receipt?{sha256:receipt.sha256,readbackVerified:receipt.readback_status==="sha256_verified"}:null,
  editionVerified:receipt?.content_correspondence==="confirmed",
  claimWithoutReceipt:Boolean(!receipt&&claim)
 });
}
