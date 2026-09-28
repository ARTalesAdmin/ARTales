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
  if (!preferredSource) {
    blockers.push("preferred_source_missing")
  } else if (preferredSource.identity_match !== "strong") {
    blockers.push("preferred_source_identity_weak")
  }

  if (componentRights.some((right) => right.publication_effect === "block_source")) {
    blockers.push("component_rights_blocked")
  }

  if (componentRights.length === 0 || componentRights.some((right) => right.publication_effect === "review")) {
    blockers.push("component_rights_review")
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    preferredSource,
  }
}
