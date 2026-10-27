import {createHash} from "node:crypto";
import {archiveRawSource, RAW_SNAPSHOT_BUCKET, type RawSnapshotStorageClient, type VerifiedRawArchiveReceipt} from "./rawSourceArchive";
import {inspectOperatorProvidedSource, type LegalSnapshotPlan} from "./verifiedLegalSnapshotHandoff";

export const SNAPSHOT_389_CANDIDATE = "98508359-bce1-4e73-b842-b69a9d1112d0" as const;
export const SNAPSHOT_389_CATALOG = "https://www.gutenberg.org/ebooks/389" as const;
export type PilotArchiveResult = Readonly<{
  schema:"artales.snapshot-389-pilot-receipt.v1";
  legal_decision_ref:string;
  catalog_url:typeof SNAPSHOT_389_CATALOG;
  selected_source_url:string;
  channel:"operator_provided_file";
  provenance:"pending_independent_verification";
  content_correspondence:"pending";
  archive:VerifiedRawArchiveReceipt;
  source_sha256:string;
  publication_authorized:false;
  semantic_ready:false;
}>;
/**
 * Isolated, explicit one-title dry-run orchestration. This module has no route
 * and grants no Storage access. The caller must independently verify a fresh
 * admin session and legal source from Supabase, and receive an operator-supplied
 * ORIGINAL file through a bounded, origin/CSRF-checked server entry point.
 *
 * Even successful Storage SHA256 readback proves preservation only, NOT
 * Gutenberg provenance or the suitability of a different technical edition.
 */
export async function runSnapshot389Pilot(
  plan:LegalSnapshotPlan,
  bytes:Uint8Array,
  actorId:string,
  acquiredAt:string,
  client:RawSnapshotStorageClient
):Promise<PilotArchiveResult>{
  if(plan?.schema!=="artales.legal-snapshot-handoff.v1" ||
     plan.selection?.candidate_id!==SNAPSHOT_389_CANDIDATE ||
     plan.selection.catalog_url!==SNAPSHOT_389_CATALOG ||
     plan.selection.decision_no!==9 ||
     plan.legal_territory!=="CZ/EU" ||
     plan.review_status!=="legal_lock_verified" ||
     plan.binary_status!=="awaiting_verified_acquisition" ||
     plan.archive_status!=="not_persisted" ||
     plan.semantic_ready!==false || plan.publication_authorized!==false ||
     plan.selection.correspondence!=="locked_file" ||
     plan.selection.format!=="epub" ||
     plan.selection.chosen_url!==plan.selection.original_locked_url ||
     !bytes || bytes.byteLength>8*1024*1024 ||
     !/^[0-9a-f-]{36}$/i.test(actorId))
    throw Error("snapshot_389_pilot_scope_refused");
  const intake=inspectOperatorProvidedSource(plan,bytes,actorId,acquiredAt);
  if(!intake.captured.manifest.archive_ready ||
      intake.captured.manifest.embedded_images!==0 ||
      intake.captured.manifest.selection.format!=="epub")
    throw Error("snapshot_389_image_rights_hold");
  const receipt=await archiveRawSource(intake.captured,client,RAW_SNAPSHOT_BUCKET);
  const ownHash=createHash("sha256").update(bytes).digest("hex");
  if(receipt.sha256!==ownHash || receipt.storage_readback!=="sha256_verified")
    throw Error("snapshot_389_receipt_mismatch");
  return {
    schema:"artales.snapshot-389-pilot-receipt.v1",
    legal_decision_ref:plan.legal_decision_ref,
    catalog_url:SNAPSHOT_389_CATALOG,
    selected_source_url:plan.selection.chosen_url,
    channel:"operator_provided_file",
    provenance:"pending_independent_verification",
    content_correspondence:"pending",
    archive:receipt,
    source_sha256:receipt.sha256,
    publication_authorized:false,
    semantic_ready:false,
  };
}
