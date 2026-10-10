/**
 * A deterministic, read-only machine-screening gate.
 *
 * Model output is untrusted evidence extraction, not a legal authorization.
 * Only a server-side, versioned policy may accept a complete source/edition
 * evidence dossier for draft staging. Publishing remains a separate decision.
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

export type RightsEvidence = {
  id: string
  type: "primary_record" | "license" | "edition_metadata" | "automated_analysis" | "human_opinion"
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
  snapshots: CapturedComponent[]
  evidence: RightsEvidence[]
  decisions: ComponentRightsDecision[]
}

export type RightsScanIssue = {
  componentId: string | null
  code:
    | "invalid_dossier" | "missing_text" | "missing_decision"
    | "unknown_component" | "unreliable_snapshot" | "duplicate_or_foreign_record"
    | "insufficient_evidence" | "unsupported_inclusion" | "review_requested"
    | "high_risk_inclusion" | "unverified_exclusion"
}

export type RightsScanEvaluation = {
  outcome: "candidate_draft_eligible" | "needs_specialist_review" | "source_blocked"
  issues: RightsScanIssue[]
  includedSnapshotIds: string[]
  excludedSnapshotIds: string[]
  assessmentOrigin: "automated"
  publicationAuthorized: false
}

const sha256Pattern = /^[a-f0-9]{64}$/i
const validTime = (s: string) => Boolean(s) && Number.isFinite(Date.parse(s))
const substantive = (s: string) => typeof s === "string" && s.trim().length >= 20
const primaryEvidence = new Set(["primary_record", "license", "edition_metadata"])

export function evaluateRightsScan(d: RightsScanDossier): RightsScanEvaluation {
  const issues: RightsScanIssue[] = []
  const includedSnapshotIds: string[] = []
  const excludedSnapshotIds: string[] = []
  let blocked = false
  const issue = (code: RightsScanIssue["code"], componentId: string | null = null) =>
    issues.push({ code, componentId })

  if (
    d.format !== "artales-rights-dossier-v1" || !d.candidateId || !d.sourceId ||
    !d.editionId || !d.snapshotSetId || !d.targetJurisdiction ||
    !d.policyVersion || !d.scanner.engine || !d.scanner.version ||
    !validTime(d.scanner.ranAt) || d.snapshots.length === 0
  ) {
    issue("invalid_dossier")
  }

  const evidence = new Map<string, RightsEvidence>()
  for (const e of d.evidence) {
    if (evidence.has(e.id) || !e.id || !e.sourceUri || !e.archiveRef ||
        !sha256Pattern.test(e.sha256) || !validTime(e.capturedAt) ||
        !substantive(e.claim) || e.jurisdiction !== d.targetJurisdiction) {
      issue("duplicate_or_foreign_record")
    }
    evidence.set(e.id, e)
  }

  const snapshots = new Map<string, CapturedComponent>()
  for (const s of d.snapshots) {
    if (!s.id || snapshots.has(s.id) || s.sourceId !== d.sourceId ||
        s.editionId !== d.editionId) {
      issue("duplicate_or_foreign_record", s.id)
    }
    snapshots.set(s.id, s)
    if (!sha256Pattern.test(s.sha256) || !Number.isSafeInteger(s.byteLength) ||
        s.byteLength <= 0 || !validTime(s.capturedAt) || !s.archiveRef) {
      issue("unreliable_snapshot", s.id)
    }
    if (s.kind === "UNKNOWN") issue("unknown_component", s.id)
  }

  const decisions = new Map<string, ComponentRightsDecision>()
  for (const decision of d.decisions) {
    if (decisions.has(decision.componentId) || !snapshots.has(decision.componentId)) {
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
      excludedSnapshotIds.push(s.id)
      continue
    }
    // An 'include' may never be approved purely on a generated model opinion.
    if (decision.finding === "denied") {
      issue("unsupported_inclusion", s.id)
      blocked = true
      continue
    }
    if (decision.finding !== "supported" || decision.confidence !== "high" ||
        !substantive(decision.rationale) || decision.evidenceIds.length === 0) {
      issue("insufficient_evidence", s.id)
      continue
    }
    const proofs = decision.evidenceIds.map(id => evidence.get(id))
    if (proofs.some(e => !e) || !proofs.some(e => e && primaryEvidence.has(e.type))) {
      issue("insufficient_evidence", s.id)
      continue
    }
    // Included third-party translation/artwork requires an enhanced, separate
    // license/provenance policy. The AI must escalate rather than assume usage.
    if (s.kind === "TRANSLATION" || s.kind === "ASSET") {
      issue("high_risk_inclusion", s.id)
      continue
    }
    includedSnapshotIds.push(s.id)
  }

  if (!d.snapshots.some(s => s.kind === "WORK_CONTENT" &&
    includedSnapshotIds.includes(s.id))) issue("missing_text")

  return {
    outcome: blocked ? "source_blocked" :
      issues.length > 0 ? "needs_specialist_review" : "candidate_draft_eligible",
    issues, includedSnapshotIds, excludedSnapshotIds,
    assessmentOrigin: "automated",
    publicationAuthorized: false,
  }
}
