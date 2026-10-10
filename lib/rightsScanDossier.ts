/**
 * Synthetic / structural preflight for a machine-generated rights dossier.
 *
 * All inputs must be treated as claims until verified by a trusted capture
 * service. A structurally complete dossier may be proposed for draft staging;
 * this function neither verifies copyright nor authorizes a DB write/publication.
 */
export type RightsComponentKind =
  | "WORK_CONTENT" | "EDITION_CONTENT" | "TRANSLATION"
  | "SOURCE_WRAPPER" | "EDITORIAL_ADDITION" | "ASSET"
  | "SOURCE_METADATA" | "UNKNOWN"

export type CapturedComponent = {
  id: string
  kind: RightsComponentKind
  sourceId: string
  editionId: string
  sha256: string
  byteLength: number
  capturedAt: string
  archiveRef: string
}

export type SourceCaptureManifest = {
  rawSourceSha256: string
  rawSourceByteLength: number
  rawSourceArchiveRef: string
  capturedAt: string
  inventoryComplete: boolean
  collectorVersion: string
}

export type RightsEvidence = {
  id: string
  type: "primary_record" | "license" | "edition_metadata" | "automated_analysis" | "human_opinion"
  sourceId: string
  editionId: string
  componentIds: string[]
  sourceUri: string
  archiveRef: string
  sha256: string
  capturedAt: string
  jurisdiction: string
  claim: string
}

export type ComponentRightsDecision = {
  componentId: string
  action: "include" | "exclude" | "hold"
  finding: "supported" | "unknown" | "denied"
  confidence: "high" | "medium" | "low"
  evidenceIds: string[]
  rationale: string
  exclusionMethod?: "omit_from_ingest"
  disputeFlag?: boolean
}

export type RightsScanDossier = {
  format: "artales-rights-dossier-v1"
  candidateId: string
  sourceId: string
  editionId: string
  snapshotSetId: string
  targetJurisdiction: string
  policyVersion: string
  scanner: { engine: string; version: string; ranAt: string }
  capture: SourceCaptureManifest
  snapshots: CapturedComponent[]
  evidence: RightsEvidence[]
  decisions: ComponentRightsDecision[]
}

export type RightsScanIssue = {
  componentId: string | null
  code:
    | "invalid_dossier" | "missing_text" | "missing_edition_assessment"
    | "missing_decision" | "unknown_component" | "unreliable_snapshot"
    | "source_capture_incomplete" | "duplicate_or_foreign_record"
    | "insufficient_evidence" | "unsupported_inclusion" | "review_requested"
    | "high_risk_inclusion" | "unverified_exclusion"
}

export type RightsScanEvaluation = {
  outcome: "candidate_draft_eligible" | "needs_specialist_review" | "source_blocked"
  issues: RightsScanIssue[]
  // These are only suggested IDs, not an executable ingest authorization.
  includedSnapshotIds: string[]
  excludedSnapshotIds: string[]
  assessmentOrigin: "automated"
  publicationAuthorized: false
}

const sha256Pattern = /^[a-f0-9]{64}$/i
const validTime = (value: string) =>
  typeof value === "string" && Boolean(value) && Number.isFinite(Date.parse(value))
const substantive = (value: string) => typeof value === "string" && value.trim().length >= 20
const primaryEvidence = new Set(["primary_record", "license", "edition_metadata"])

export function evaluateRightsScan(d: RightsScanDossier): RightsScanEvaluation {
  const issues: RightsScanIssue[] = []
  const proposedInclude: string[] = []
  const proposedExclude: string[] = []
  let blocked = false
  const issue = (code: RightsScanIssue["code"], componentId: string | null = null) =>
    issues.push({ code, componentId })

  if (
    d.format !== "artales-rights-dossier-v1" || !d.candidateId || !d.sourceId ||
    !d.editionId || !d.snapshotSetId || !d.targetJurisdiction ||
    !d.policyVersion || !d.scanner.engine || !d.scanner.version ||
    !validTime(d.scanner.ranAt) || d.snapshots.length === 0
  ) issue("invalid_dossier")

  const capture = d.capture
  if (
    !capture || !sha256Pattern.test(capture.rawSourceSha256) ||
    !Number.isSafeInteger(capture.rawSourceByteLength) ||
    capture.rawSourceByteLength <= 0 || !capture.rawSourceArchiveRef ||
    !validTime(capture.capturedAt) || !capture.collectorVersion ||
    !capture.inventoryComplete ||
    (validTime(d.scanner.ranAt) && Date.parse(capture.capturedAt) > Date.parse(d.scanner.ranAt))
  ) issue("source_capture_incomplete")

  const snapshots = new Map<string, CapturedComponent>()
  const invalidSnapshots = new Set<string>()
  for (const s of d.snapshots) {
    if (!s.id || snapshots.has(s.id) || s.sourceId !== d.sourceId ||
        s.editionId !== d.editionId) {
      issue("duplicate_or_foreign_record", s.id)
      invalidSnapshots.add(s.id)
    }
    snapshots.set(s.id, s)
    if (!sha256Pattern.test(s.sha256) || !Number.isSafeInteger(s.byteLength) ||
        s.byteLength <= 0 || !validTime(s.capturedAt) || !s.archiveRef ||
        (validTime(s.capturedAt) && validTime(d.scanner.ranAt) &&
        Date.parse(s.capturedAt) > Date.parse(d.scanner.ranAt))) {
      issue("unreliable_snapshot", s.id)
      invalidSnapshots.add(s.id)
    }
    if (s.kind === "UNKNOWN") {
      issue("unknown_component", s.id)
      invalidSnapshots.add(s.id)
    }
  }

  const evidence = new Map<string, RightsEvidence>()
  const invalidEvidence = new Set<string>()
  for (const e of d.evidence) {
    if (
      !e.id || evidence.has(e.id) || e.sourceId !== d.sourceId ||
      e.editionId !== d.editionId || !Array.isArray(e.componentIds) ||
      e.componentIds.length === 0 || e.componentIds.some(id => !snapshots.has(id)) ||
      !e.sourceUri || !/^https:\/\//i.test(e.sourceUri) || !e.archiveRef ||
      !sha256Pattern.test(e.sha256) || !validTime(e.capturedAt) ||
      !substantive(e.claim) || e.jurisdiction !== d.targetJurisdiction ||
      (validTime(e.capturedAt) && validTime(d.scanner.ranAt) &&
       Date.parse(e.capturedAt) > Date.parse(d.scanner.ranAt))
    ) {
      issue("duplicate_or_foreign_record")
      invalidEvidence.add(e.id)
    }
    evidence.set(e.id, e)
  }

  const decisions = new Map<string, ComponentRightsDecision>()
  for (const decision of d.decisions) {
    if (!decision.componentId || decisions.has(decision.componentId) ||
        !snapshots.has(decision.componentId)) {
      issue("duplicate_or_foreign_record", decision.componentId)
    }
    decisions.set(decision.componentId, decision)
  }

  for (const s of d.snapshots) {
    const decision = decisions.get(s.id)
    if (!decision) {
      issue("missing_decision", s.id)
      continue
    }
    if (decision.disputeFlag || decision.action === "hold") {
      issue("review_requested", s.id)
      continue
    }
    if (decision.action === "exclude") {
      if (decision.exclusionMethod !== "omit_from_ingest" || !substantive(decision.rationale)) {
        issue("unverified_exclusion", s.id)
        continue
      }
      proposedExclude.push(s.id)
      continue
    }

    if (decision.finding === "denied") {
      issue("unsupported_inclusion", s.id)
      blocked = true
      continue
    }
    if (decision.finding !== "supported" || decision.confidence !== "high" ||
        !substantive(decision.rationale) || decision.evidenceIds.length === 0 ||
        invalidSnapshots.has(s.id)) {
      issue("insufficient_evidence", s.id)
      continue
    }

    const proofs = decision.evidenceIds.map(id => evidence.get(id))
    if (
      proofs.some(e => !e || invalidEvidence.has(e.id) || !e.componentIds.includes(s.id)) ||
      !proofs.some(e => e && primaryEvidence.has(e.type))
    ) {
      issue("insufficient_evidence", s.id)
      continue
    }

    // A translation or illustration requires a separate verified rights route.
    // It is never cleared just by claiming high AI confidence.
    if (s.kind === "TRANSLATION" || s.kind === "ASSET") {
      issue("high_risk_inclusion", s.id)
      continue
    }
    proposedInclude.push(s.id)
  }

  if (!d.snapshots.some(s => s.kind === "WORK_CONTENT" &&
    proposedInclude.includes(s.id))) issue("missing_text")
  if (!d.snapshots.some(s => s.kind === "EDITION_CONTENT" &&
    (proposedInclude.includes(s.id) || proposedExclude.includes(s.id)))) {
    issue("missing_edition_assessment")
  }

  // A caller must never consume a partial set of "include" IDs while any
  // related legal/capture/identity record is unresolved.
  const outcome = blocked ? "source_blocked" :
    issues.length ? "needs_specialist_review" : "candidate_draft_eligible"
  return {
    outcome, issues,
    includedSnapshotIds: outcome === "candidate_draft_eligible" ? proposedInclude : [],
    excludedSnapshotIds: outcome === "candidate_draft_eligible" ? proposedExclude : [],
    assessmentOrigin: "automated",
    publicationAuthorized: false,
  }
}
