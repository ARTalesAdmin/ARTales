/**
 * Governance preflight for a FUTURE versioned ARTales publication engine.
 *
 * Pure deterministic checks only: they do not authorize, publish, unpublish,
 * mutate Supabase, clear copyright or replace trusted server-side RPC guards.
 *
 * Future RPC must read these inputs from server-owned tables, authenticate the
 * actor with auth.uid(), recheck row version and rights under a DB transaction,
 * validate actual source/asset bytes, then atomically change the release pointer.
 */
export type Availability = "unreleased" | "live" | "held" | "withdrawn";
export type TrustedActorRole = "admin" | "editor" | "reader" | "system";
export type Sha256 = string;

export type HumanReview = {
  state: "pending" | "returned" | "approved";
  targetArtifactId: string;
  targetSha256: Sha256;
  reviewerId: string;
  reviewerRole: "admin" | "editor";
  reviewedAt: string;
};

export type RevisionArtifact = {
  id: string;
  sha256: Sha256;
  authorId: string;
  humanReview: HumanReview | null;
};

export type SourceSnapshotEvidence = {
  ref: string;
  sha256: Sha256;
  verifiedByteSha256: Sha256;
  capturedAt: string;
  status: "verified" | "unverified" | "challenged";
};

export type ComponentEvidence = {
  componentId: string;
  kind: "WORK_CONTENT" | "EDITION_CONTENT" | "TRANSLATION" | "ASSET" | "SOURCE_WRAPPER" | "EDITORIAL_ADDITION";
  included: boolean;
  decision: "cleared" | "excluded" | "blocked" | "review_required";
  evidenceSha256?: Sha256;
  // Exact archived/generated media byte hash, independent of literary source bytes.
  artifactSha256?: Sha256;
  reviewedAt?: string;
  jurisdictions?: string[];
  sourceSnapshotSha256: Sha256;
};

export type RightsDossier = {
  id: string;
  sha256: Sha256;
  status: "independently_reviewed" | "pending" | "challenged";
  reviewedBy: string;
  reviewedAt: string;
  expiresAt: string;
  sourceSnapshotSha256: Sha256;
  components: ComponentEvidence[];
};

export type ReaderQaEvidence = {
  verdict: "passed" | "pending" | "failed";
  textRevisionId: string;
  textSha256: Sha256;
  reviewedAt: string;
  reviewerId: string;
  checkedModes: string[];
};

export type OpenIssue = {
  id: string;
  status: "open" | "resolved";
  severity: "minor" | "blocking";
  revisionId: string;
};

export type LegacyCutoverProof = {
  workId: string;
  slug: string;
  proposedWorkId: string;
  proposedSlug: string;
  legacyObservedSha256: Sha256 | null;
  rawSourceSha256: Sha256 | null;
  sourceComparison: {
    legacyObservedSha256: Sha256;
    rawSourceSha256: Sha256;
    verdict: "matched" | "explained_difference" | "unresolved";
    reviewedExplanation?: string;
  } | null;
  newSemanticTextSha256: Sha256 | null;
  readerQaTextSha256: Sha256 | null;
  readerQaPassed: boolean;
  originalReaderStateCount: number;
  mappedReaderStateCount: number;
  approximateLocationCount: number;
  originalPositionFallbackKept: boolean;
};

export type LegacyCutoverBlocker =
  | "identity_changed"
  | "legacy_snapshot_missing"
  | "original_snapshot_missing"
  | "source_difference_unresolved"
  | "recomposition_missing"
  | "reader_qa_missing"
  | "reader_state_unprotected";

export function inspectLegacyCutover(proof: LegacyCutoverProof): {
  readyForGovernedRelease: boolean;
  blockers: LegacyCutoverBlocker[];
  retainedWorkId: string;
  retainedSlug: string;
} {
  const b = new Set<LegacyCutoverBlocker>();
  if (!nonempty(proof.workId) || !nonempty(proof.slug) ||
      proof.workId !== proof.proposedWorkId || proof.slug !== proof.proposedSlug) {
    b.add("identity_changed");
  }
  if (!validSha(proof.legacyObservedSha256)) b.add("legacy_snapshot_missing");
  if (!validSha(proof.rawSourceSha256)) b.add("original_snapshot_missing");
  const compare = proof.sourceComparison;
  if (!compare || (compare.verdict !== "matched" &&
      !(compare.verdict === "explained_difference" && nonempty(compare.reviewedExplanation))) ||
      compare.legacyObservedSha256 !== proof.legacyObservedSha256 ||
      compare.rawSourceSha256 !== proof.rawSourceSha256) {
    b.add("source_difference_unresolved");
  }
  if (!validSha(proof.newSemanticTextSha256)) b.add("recomposition_missing");
  if (!proof.readerQaPassed || !validSha(proof.readerQaTextSha256) ||
      proof.readerQaTextSha256 !== proof.newSemanticTextSha256) {
    b.add("reader_qa_missing");
  }
  if (!Number.isSafeInteger(proof.originalReaderStateCount) ||
      !Number.isSafeInteger(proof.mappedReaderStateCount) ||
      !Number.isSafeInteger(proof.approximateLocationCount) ||
      proof.originalReaderStateCount < 0 || proof.mappedReaderStateCount < 0 ||
      proof.approximateLocationCount < 0 ||
      proof.mappedReaderStateCount + proof.approximateLocationCount !== proof.originalReaderStateCount ||
      (proof.approximateLocationCount > 0 && !proof.originalPositionFallbackKept)) {
    b.add("reader_state_unprotected");
  }
  const blockers = [...b];
  return {
    readyForGovernedRelease: blockers.length === 0,
    blockers,
    retainedWorkId: proof.workId,
    retainedSlug: proof.slug,
  };
}

export type ReleasePreflight = {
  workId: string;
  intent: "first_release" | "update_release" | "restore";
  availability: Availability;
  actorId: string;
  actorRole: TrustedActorRole;
  explicitConfirmation: boolean;
  expectedWorkVersion: number;
  observedWorkVersion: number;
  at: string;
  targetJurisdictions: string[];
  sourceSnapshot: SourceSnapshotEvidence;
  text: RevisionArtifact;
  textSourceSnapshotSha256: Sha256;
  metadata: RevisionArtifact;
  visualAssets: RevisionArtifact[];
  visualRequired: boolean;
  readerQa: ReaderQaEvidence;
  rights: RightsDossier;
  issues: OpenIssue[];
  origin: "new_candidate" | "legacy";
  legacyCutover?: LegacyCutoverProof;
};

export type ReleaseBlocker =
  | "work_identity_missing"
  | "unauthorized_actor"
  | "confirmation_missing"
  | "concurrent_work_change"
  | "invalid_evaluation_time"
  | "availability_not_releasable"
  | "jurisdiction_missing"
  | "source_snapshot_unverified"
  | "source_snapshot_mismatch"
  | "text_review_unapproved"
  | "metadata_review_unapproved"
  | "visual_review_unapproved"
  | "visual_selection_missing"
  | "visual_rights_unverified"
  | "reviewer_not_independent"
  | "reader_qa_unapproved"
  | "rights_dossier_unapproved"
  | "rights_dossier_stale"
  | "rights_component_uncleared"
  | "rights_component_missing_evidence"
  | "unresolved_blocking_issue"
  | "legacy_cutover_unverified";

export function validSha(value: unknown): value is Sha256 {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function timestamp(value: unknown): number {
  if (!nonempty(value)) return NaN;
  const d = Date.parse(value);
  return Number.isFinite(d) ? d : NaN;
}
function isSignedReview(artifact: RevisionArtifact | null | undefined): boolean {
  if (!artifact || !nonempty(artifact.id) || !validSha(artifact.sha256) ||
      !nonempty(artifact.authorId)) return false;
  const r = artifact.humanReview;
  return !!r && r.state === "approved" && r.targetArtifactId === artifact.id &&
    r.targetSha256 === artifact.sha256 && nonempty(r.reviewerId) &&
    (r.reviewerRole === "admin" || r.reviewerRole === "editor") &&
    Number.isFinite(timestamp(r.reviewedAt));
}

/**
 * A preview of *potential* readiness. Absolutely not a grant or publish action.
 * Future server RPC must acquire and re-read source, rights, user, work version,
 * approved artifacts, unresolved flags and reader-availability under locks.
 */
export function inspectReleasePreflight(input: ReleasePreflight): {
  eligibleForServerSideDecision: boolean;
  blockers: ReleaseBlocker[];
} {
  const b = new Set<ReleaseBlocker>();
  const now = timestamp(input.at);
  if (!nonempty(input.workId)) b.add("work_identity_missing");
  if (!nonempty(input.actorId) || input.actorRole !== "admin") b.add("unauthorized_actor");
  if (!input.explicitConfirmation) b.add("confirmation_missing");
  if (!Number.isSafeInteger(input.expectedWorkVersion) || input.expectedWorkVersion < 0 ||
      input.observedWorkVersion !== input.expectedWorkVersion) b.add("concurrent_work_change");
  if (!Number.isFinite(now)) b.add("invalid_evaluation_time");
  if (input.intent === "restore" ? input.availability !== "held" :
      (input.intent === "first_release" ? input.availability !== "unreleased" : input.availability !== "live")) {
    b.add("availability_not_releasable");
  }
  if (!Array.isArray(input.targetJurisdictions) || input.targetJurisdictions.length === 0 ||
      input.targetJurisdictions.some((x) => !nonempty(x))) b.add("jurisdiction_missing");

  const source = input.sourceSnapshot;
  if (!nonempty(source.ref) || source.ref !== "sha256:" + source.sha256 ||
      !validSha(source.sha256) || source.verifiedByteSha256 !== source.sha256 ||
      source.status !== "verified" || !Number.isFinite(timestamp(source.capturedAt))) {
    b.add("source_snapshot_unverified");
  }
  if (input.textSourceSnapshotSha256 !== source.sha256) b.add("source_snapshot_mismatch");

  if (!isSignedReview(input.text)) b.add("text_review_unapproved");
  if (!isSignedReview(input.metadata)) b.add("metadata_review_unapproved");
  if (input.text.humanReview?.reviewerId === input.text.authorId ||
      input.metadata.humanReview?.reviewerId === input.metadata.authorId) {
    b.add("reviewer_not_independent");
  }
  if (input.visualRequired && (!input.visualAssets || input.visualAssets.length === 0)) {
    b.add("visual_selection_missing");
  }
  for (const asset of input.visualAssets || []) {
    if (!isSignedReview(asset)) b.add("visual_review_unapproved");
    if (asset.humanReview?.reviewerId === asset.authorId) b.add("reviewer_not_independent");
  }
  if (input.readerQa.verdict !== "passed" ||
      input.readerQa.textRevisionId !== input.text.id ||
      input.readerQa.textSha256 !== input.text.sha256 ||
      !nonempty(input.readerQa.reviewerId) ||
      !Number.isFinite(timestamp(input.readerQa.reviewedAt)) ||
      !input.readerQa.checkedModes.includes("full") ||
      !input.readerQa.checkedModes.includes("preview")) {
    b.add("reader_qa_unapproved");
  }

  const rights = input.rights;
  if (rights.status !== "independently_reviewed" ||
      !nonempty(rights.id) || !validSha(rights.sha256) ||
      !nonempty(rights.reviewedBy) || !Number.isFinite(timestamp(rights.reviewedAt)) ||
      rights.sourceSnapshotSha256 !== source.sha256) {
    b.add("rights_dossier_unapproved");
  }
  if (!Number.isFinite(now) || !Number.isFinite(timestamp(rights.expiresAt)) ||
      timestamp(rights.expiresAt) <= now ||
      timestamp(rights.reviewedAt) < timestamp(source.capturedAt) ||
      timestamp(rights.reviewedAt) > now) {
    b.add("rights_dossier_stale");
  }
  const ids = new Set<string>();
  let hasWorkText = false;
  for (const component of rights.components || []) {
    if (!nonempty(component.componentId) || ids.has(component.componentId) ||
        component.sourceSnapshotSha256 !== source.sha256 ||
        component.decision === "blocked" || component.decision === "review_required" ||
        (component.included && component.decision !== "cleared") ||
        (!component.included && component.decision !== "excluded")) {
      b.add("rights_component_uncleared");
    }
    ids.add(component.componentId);
    if (component.included && component.kind === "WORK_CONTENT" && component.decision === "cleared") {
      hasWorkText = true;
    }
    if (component.included &&
        (!validSha(component.evidenceSha256) || !Number.isFinite(timestamp(component.reviewedAt)) ||
         timestamp(component.reviewedAt) < timestamp(source.capturedAt) ||
         timestamp(component.reviewedAt) > now ||
         input.targetJurisdictions.some((zone) => !component.jurisdictions?.includes(zone)))) {
      b.add("rights_component_missing_evidence");
    }
  }
  if (!hasWorkText) b.add("rights_component_uncleared");
  // Human sign-off of a cover is not a licence. Bind every selected asset to
  // independently evidenced, cleared rights for exactly those rendered bytes.
  const selectedAssetIds = new Set<string>();
  for (const asset of input.visualAssets || []) {
    if (selectedAssetIds.has(asset.id) ||
        !rights.components.some((c) =>
          c.kind === "ASSET" && c.included && c.decision === "cleared" &&
          c.componentId === asset.id && validSha(c.artifactSha256) &&
          c.artifactSha256 === asset.sha256)) {
      b.add("visual_rights_unverified");
    }
    selectedAssetIds.add(asset.id);
  }
  for (const c of rights.components || []) {
    if (c.kind === "ASSET" && c.included &&
        !(input.visualAssets || []).some((asset) =>
          asset.id === c.componentId && asset.sha256 === c.artifactSha256)) {
      b.add("visual_rights_unverified");
    }
  }
  if (input.issues.some((issue) => issue.status === "open" && issue.severity === "blocking")) {
    b.add("unresolved_blocking_issue");
  }
  if (input.origin === "legacy" &&
      (!input.legacyCutover ||
       input.legacyCutover.workId !== input.workId ||
       input.legacyCutover.rawSourceSha256 !== source.sha256 ||
       input.legacyCutover.newSemanticTextSha256 !== input.text.sha256 ||
       !inspectLegacyCutover(input.legacyCutover).readyForGovernedRelease)) {
    b.add("legacy_cutover_unverified");
  }
  const blockers = [...b];
  return { eligibleForServerSideDecision: blockers.length === 0, blockers };
}

export type HoldPreflight = {
  workId: string;
  currentReleaseId: string;
  availability: Availability;
  actorId: string;
  actorRole: TrustedActorRole;
  reason: string;
  explicitConfirmation: boolean;
  expectedWorkVersion: number;
  observedWorkVersion: number;
};

export type HoldBlocker = "work_identity_missing" | "release_missing" |
  "unauthorized_actor" | "reason_missing" | "confirmation_missing" |
  "concurrent_work_change" | "not_live";

export function inspectHoldPreflight(input: HoldPreflight): {
  eligibleForServerSideDecision: boolean;
  nextAvailability: "held";
  blockers: HoldBlocker[];
} {
  const b = new Set<HoldBlocker>();
  if (!nonempty(input.workId)) b.add("work_identity_missing");
  if (!nonempty(input.currentReleaseId)) b.add("release_missing");
  if (!nonempty(input.actorId) || (input.actorRole !== "editor" && input.actorRole !== "admin")) b.add("unauthorized_actor");
  if (!nonempty(input.reason) || input.reason.trim().length < 12) b.add("reason_missing");
  if (!input.explicitConfirmation) b.add("confirmation_missing");
  if (!Number.isSafeInteger(input.expectedWorkVersion) || input.expectedWorkVersion < 0 ||
      input.expectedWorkVersion !== input.observedWorkVersion) b.add("concurrent_work_change");
  if (input.availability !== "live") b.add("not_live");
  return {eligibleForServerSideDecision:b.size===0,nextAvailability:"held",blockers:[...b]};
}

export type UntrustedFlag = {
  workId: string;
  releaseId: string;
  reporterId: string | null;
  category: "rights" | "safety" | "text" | "metadata" | "visual";
  detail: string;
};
export function inspectUntrustedFlag(input: UntrustedFlag): {
  acceptedForTriage: boolean;
  priority: "urgent_review" | "normal_review";
  mayDirectlyChangeAvailability: false;
} {
  const acceptedForTriage = nonempty(input.workId) && nonempty(input.releaseId) &&
    nonempty(input.detail) && input.detail.trim().length >= 8 &&
    input.detail.length <= 4000;
  return {
    acceptedForTriage,
    priority: (input.category === "rights" || input.category === "safety") ?
      "urgent_review" : "normal_review",
    mayDirectlyChangeAvailability: false,
  };
}
