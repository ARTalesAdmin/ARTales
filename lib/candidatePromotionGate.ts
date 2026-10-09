import type { WorkCandidate } from "@/lib/dbCandidates"
import type { CandidateSourceOption } from "@/lib/candidateSources"
import type { CandidateComponentRight } from "@/lib/candidateComponentRights"
import { getCandidateTriageBlockers } from "@/lib/candidateTriage"

export type CandidatePromotionBlocker =
  | "already_promoted"
  | "candidate_not_ready"
  | "triage_blocked"
  | "preferred_source_missing"
  | "preferred_source_identity_weak"
  | "component_rights_review"
  | "component_rights_blocked"

export type CandidatePromotionGate = {
  eligible: boolean
  blockers: CandidatePromotionBlocker[]
  preferredSource: CandidateSourceOption | null
}

export function getCandidatePromotionGate(
  candidate: WorkCandidate,
  sources: CandidateSourceOption[],
  componentRights: CandidateComponentRight[],
): CandidatePromotionGate {
  const blockers: CandidatePromotionBlocker[] = []

  if (candidate.matched_work_id) blockers.push("already_promoted")

  if (candidate.status !== "ready" && candidate.status !== "accepted") {
    blockers.push("candidate_not_ready")
  }

  if (getCandidateTriageBlockers(candidate).length > 0) {
    blockers.push("triage_blocked")
  }

  const preferredSource = sources.find((source) => source.status === "preferred") ?? null
  // The UI may show legacy/fixture source projections, but only the persisted
  // preferred-source relationship is allowed to pass the promotion gate.
  if (!preferredSource || !candidate.preferred_source_id ||
      preferredSource.id !== candidate.preferred_source_id) {
    blockers.push("preferred_source_missing")
  } else if (preferredSource.identity_match !== "strong") {
    blockers.push("preferred_source_identity_weak")
  }

  // Rights belong to a concrete source/edition, not to the candidate as a
  // whole. Decisions about a different source must not affect this one.
  const selectedRights = preferredSource
    ? componentRights.filter((right) => right.source_id === preferredSource.id)
    : []
  const workContentAllowed = selectedRights.some(
    (right) =>
      right.component === "WORK_CONTENT" &&
      right.decision === "usable" &&
      right.publication_effect === "allow",
  )
  const today = new Date().toISOString().slice(0, 10)
  if (
    !workContentAllowed ||
    selectedRights.some((right) =>
      right.publication_effect === "review" ||
      right.decision === "review_required" ||
      right.decision === "alternate_edition_required" ||
      (right.decision === "exclude" && right.publication_effect !== "exclude_component") ||
      (right.publication_effect !== "exclude_component" && Boolean(right.not_before && right.not_before > today))
    )
  ) {
    blockers.push("component_rights_review")
  }

  if (selectedRights.some((right) =>
    right.publication_effect === "block_source" || right.decision === "blocked"
  )) {
    blockers.push("component_rights_blocked")
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    preferredSource,
  }
}
