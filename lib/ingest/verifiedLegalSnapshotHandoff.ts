import {createHash} from "node:crypto";
import {chooseSnapshotFile, type LegalSnapshotLock, type GutenbergBook, type SnapshotFileChoice} from "./lockedSnapshotSelection";
import {captureRawSource, type RawSourceCapture} from "./rawSourceSnapshot";

/** Pure, server-side-only planning inputs. Caller must read these from current
 * authenticated Supabase records, never accept them from browser JSON. No DB,
 * Storage or external download happens in this module. */
export type SnapshotActor = Readonly<{id:string;role:"admin"|"editor";is_active:boolean}>;
export type LegalCandidateIdentity = Readonly<{id:string;proposed_title:string;proposed_author_name:string}>;
export type LegalSourceIdentity = Readonly<{id:string;candidate_id:string;source_kind:string;edition_title:string;source_url:string;download_url:string;identity_match:string;language_match:string;text_format:string;language_code:string}>;
export type LegalApprovalIdentity = Readonly<{decision_no:number;candidate_id:string;source_id:string;verdict:string;territory:string;recorded_at:string;reviewed_by:string}>;
export type VerifiedLegalSnapshotPacket = Readonly<{
  actor: SnapshotActor;
  candidate: LegalCandidateIdentity;
  source: LegalSourceIdentity;
  approved: LegalApprovalIdentity;
  lock: LegalSnapshotLock & {locked_by:string};
}>;
export type LegalSnapshotPlan = Readonly<{
  schema:"artales.legal-snapshot-handoff.v1";
  selection:SnapshotFileChoice;
  actor_id:string;
  legal_territory:"CZ/EU";
  legal_decision_ref:string;
  locked_at:string;
  approval_recorded_at:string;
  review_status:"legal_lock_verified";
  binary_status:"awaiting_verified_acquisition";
  text_correspondence:"pending_binary_inspection";
  archive_status:"not_persisted";
  semantic_ready:false;
  publication_authorized:false;
}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const words=(s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const canon=(s:string)=>words(s).join(" ");
function time(s:string){const n=Date.parse(s);if(!Number.isFinite(n))throw Error("invalid_legal_time");return n;}
/** Refuse partial, stale and cross-candidate evidence; no approval is invented. */
export function planLockedSnapshot(packet:VerifiedLegalSnapshotPacket, book:GutenbergBook, alternative?:string):LegalSnapshotPlan {
 const {actor,candidate,source,approved,lock}=packet;
 if(!actor||!uuid.test(actor.id)||actor.role!=="admin"||actor.is_active!==true)throw Error("snapshot_admin_gate_missing");
 if(!candidate||!uuid.test(candidate.id)||!canon(candidate.proposed_title)||!canon(candidate.proposed_author_name))throw Error("invalid_candidate");
 if(!lock||!uuid.test(lock.locked_by)||lock.candidate_id!==candidate.id||
    approved?.candidate_id!==candidate.id||source?.candidate_id!==candidate.id||
    approved?.source_id!==lock.source_id||source?.id!==lock.source_id||
    approved?.decision_no!==lock.decision_no||approved?.verdict!=="approved"||
    approved?.territory!=="CZ/EU"||!uuid.test(approved.reviewed_by))throw Error("legal_approval_lock_mismatch");
 const t=time(approved.recorded_at),l=time(lock.locked_at);
 if(t>l || t<=0)throw Error("stale_legal_lock");
 if(source.source_kind!=="gutenberg"||source.source_url!==lock.source_url||
    source.download_url!==lock.download_url||source.identity_match!=="confirmed"||
    source.language_match!=="matches"||canon(source.edition_title)!==canon(candidate.proposed_title)||
    source.text_format!==(lock.source_facts as {textFormat?:unknown})?.textFormat||
    source.language_code!==(lock.source_facts as {language?:unknown})?.language)throw Error("source_identity_mismatch");
 if(!book||canon(book.title)!==canon(candidate.proposed_title)||!book.authors?.length||
    !book.authors.some(a=>words(candidate.proposed_author_name).every(t=>words(a.name).includes(t))))throw Error("catalog_author_or_title_mismatch");
 const selection=chooseSnapshotFile(lock,book,alternative);
 return {schema:"artales.legal-snapshot-handoff.v1",selection,actor_id:actor.id,legal_territory:"CZ/EU",
   legal_decision_ref:`legal:${candidate.id}:${approved.decision_no}`,locked_at:lock.locked_at,
   approval_recorded_at:approved.recorded_at,review_status:"legal_lock_verified",
   binary_status:"awaiting_verified_acquisition",text_correspondence:"pending_binary_inspection",
   archive_status:"not_persisted",semantic_ready:false,publication_authorized:false};
}
export type SnapshotOfflineIntake = Readonly<{
  schema:"artales.snapshot-offline-intake.v1";
  handoff:LegalSnapshotPlan;
  acquisition_channel:"operator_provided_file";
  supplied_by:string;
  captured:RawSourceCapture;
  binary_sha256:string;
  original_source_url:string;
  acquisition_verified:false;
  edition_text_comparison:"pending";
  archive_status:"not_persisted";
  semantic_ready:false;
  publication_authorized:false;
}>;
/** An operator-provided EPUB/TXT is deliberately *not* represented as verified
 * Gutenberg content. A later human provenance check and edition/text comparison
 * are required before any semantic draft/release. */
export function inspectOperatorProvidedSource(plan:LegalSnapshotPlan, bytes:Uint8Array, actorId:string, capturedAt:string):SnapshotOfflineIntake {
 if(plan.schema!=="artales.legal-snapshot-handoff.v1"||!uuid.test(actorId)||actorId!==plan.actor_id||
    plan.review_status!=="legal_lock_verified"||plan.binary_status!=="awaiting_verified_acquisition"||
    plan.archive_status!=="not_persisted"||plan.semantic_ready!==false||plan.publication_authorized!==false)
  throw Error("untrusted_snapshot_intake_plan");
 const captured=captureRawSource(plan.selection,bytes,capturedAt);
 const digest=createHash("sha256").update(bytes).digest("hex");
 if(captured.manifest.sha256!==digest)throw Error("capture_digest_mismatch");
 return {schema:"artales.snapshot-offline-intake.v1",handoff:plan,acquisition_channel:"operator_provided_file",
   supplied_by:actorId,captured,binary_sha256:digest,original_source_url:plan.selection.chosen_url,
   acquisition_verified:false,edition_text_comparison:"pending",archive_status:"not_persisted",
   semantic_ready:false,publication_authorized:false};
}