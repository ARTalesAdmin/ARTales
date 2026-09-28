import type {
  WorkCandidate,
  WorkCandidateDiscoveryStatus,
  WorkCandidateRightsStatus,
  WorkCandidateStatus,
} from "@/lib/dbCandidates"

export type CandidateTriageBlocker =
  | "discovery_incomplete"
  | "rights_not_clear"
  | "not_before_future"

export function getCandidateTriageBlockers(candidate: Pick<
  WorkCandidate,
  "discovery_status" | "rights_status" | "not_before"
>): CandidateTriageBlocker[] {
  const blockers: CandidateTriageBlocker[] = []

  if (candidate.discovery_status !== "complete") blockers.push("discovery_incomplete")
  if (candidate.rights_status !== "clear") blockers.push("rights_not_clear")

  if (candidate.not_before) {
    const today = new Date().toISOString().slice(0, 10)
    if (candidate.not_before > today) blockers.push("not_before_future")
  }

  return blockers
}

export function canCandidateAdvance(
  status: WorkCandidateStatus,
  discoveryStatus: WorkCandidateDiscoveryStatus,
  rightsStatus: WorkCandidateRightsStatus,
  notBefore: string | null,
) {
  if (status !== "ready" && status !== "accepted") return true

  return getCandidateTriageBlockers({
    discovery_status: discoveryStatus,
    rights_status: rightsStatus,
    not_before: notBefore,
  }).length === 0
}

export function requiresRightsReason(rightsStatus: WorkCandidateRightsStatus) {
  return rightsStatus !== "unknown" && rightsStatus !== "clear"
}
