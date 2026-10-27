/** Read-only, per-title acquisition proposal for the Legal -> Snapshot bridge.
 * Never downloads, stores, mutates rights, or authorizes publication.
 * Requires an already server-verified LegalSnapshotPlan (not browser JSON).
 */
import type {LegalSnapshotPlan} from "./verifiedLegalSnapshotHandoff";
import type {GutenbergBook} from "../legal/gutenbergCatalog";

export type SnapshotAcquisitionProposal = Readonly<{
  schema: "artales.snapshot-acquisition-proposal.v1";
  candidateId: string;
  legalDecisionRef: string;
  gutenbergId: number;
  catalogUrl: string;
  lockedFileUrl: string;
  selectedFileUrl: string;
  selectedFormat: "epub";
  acquisitionChannel: "gutenberg_official_mirror";
  acquisitionUrl: string;
  editionCorrespondence: "pending";
  sourceProvenance: "pending_independent_verification";
  requiresPrivateImageRetentionDecision: true;
  semanticReady: false;
  publicationAuthorized: false;
}>;

const catalogPattern = /^https:\/\/www\.gutenberg\.org\/ebooks\/([1-9][0-9]{0,7})$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Generates a single allowlisted URL from a trusted numeric book ID.
 * Missing mirror files must be handled as an acquisition hold, not a fallback
 * to arbitrary hosts, redirects, or an automated website crawler.
 */
export function proposeGutenbergSnapshotAcquisition(
  plan: LegalSnapshotPlan,
  book: GutenbergBook
): SnapshotAcquisitionProposal {
  if (plan?.schema !== "artales.legal-snapshot-handoff.v1" ||
      plan.review_status !== "legal_lock_verified" ||
      plan.archive_status !== "not_persisted" ||
      plan.binary_status !== "awaiting_verified_acquisition" ||
      plan.semantic_ready !== false ||
      plan.publication_authorized !== false ||
      plan.legal_territory !== "CZ/EU" ||
      !uuid.test(plan.actor_id) ||
      !uuid.test(plan.selection?.candidate_id) ||
      !uuid.test(plan.selection?.source_id) ||
      plan.selection.decision_no < 1 ||
      !Number.isSafeInteger(plan.selection.decision_no)) {
    throw new Error("snapshot_unverified_legal_plan");
  }
  const match = catalogPattern.exec(plan.selection.catalog_url);
  const id = match ? Number(match[1]) : NaN;
  if (!Number.isSafeInteger(id) || book?.id !== id ||
      book.catalogUrl !== plan.selection.catalog_url ||
      !book.files?.length) {
    throw new Error("snapshot_catalog_identity_mismatch");
  }
  if (plan.legal_decision_ref !==
      `legal:${plan.selection.candidate_id}:${plan.selection.decision_no}`) {
    throw new Error("snapshot_legal_ref_mismatch");
  }
  // EPUB is the only production-proven archive format for this provider.
  // A same-book HTML/TXT alternative remains an explicit future adapter.
  if (plan.selection.format !== "epub") {
    throw new Error("snapshot_provider_format_unsupported");
  }
  if (plan.selection.selection === "same_record_alternative" &&
      !book.files.some(f => f.url === plan.selection.chosen_url && f.format === "epub")) {
    throw new Error("snapshot_edition_file_not_in_catalog");
  }
  if (plan.selection.selection !== "locked" &&
      plan.selection.selection !== "same_record_alternative") {
    throw new Error("snapshot_invalid_source_selection");
  }
  if (!plan.selection.chosen_url.startsWith(plan.selection.catalog_url + ".") &&
      !book.files.some(f => f.url === plan.selection.chosen_url && f.format === "epub")) {
    throw new Error("snapshot_chosen_file_identity_mismatch");
  }
  return {
    schema: "artales.snapshot-acquisition-proposal.v1",
    candidateId: plan.selection.candidate_id,
    legalDecisionRef: plan.legal_decision_ref,
    gutenbergId: id,
    catalogUrl: plan.selection.catalog_url,
    lockedFileUrl: plan.selection.original_locked_url,
    selectedFileUrl: plan.selection.chosen_url,
    selectedFormat: "epub",
    acquisitionChannel: "gutenberg_official_mirror",
    acquisitionUrl: `https://gutenberg.pglaf.org/cache/epub/${id}/pg${id}.epub`,
    editionCorrespondence: "pending",
    sourceProvenance: "pending_independent_verification",
    requiresPrivateImageRetentionDecision: true,
    semanticReady: false,
    publicationAuthorized: false,
  };
}
