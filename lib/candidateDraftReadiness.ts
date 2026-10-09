import type { WorkCandidate } from "@/lib/dbCandidates"
import type { CandidateSourceOption } from "@/lib/candidateSources"
import type { CandidateComponentRight } from "@/lib/candidateComponentRights"
import { getCandidatePromotionGate } from "@/lib/candidatePromotionGate"

export type CandidateDraftReadinessBlocker =
  | ReturnType<typeof getCandidatePromotionGate>["blockers"][number]
  | "author_match_required"
  | "author_identity_unverified"
  | "source_language_required"

export type CandidateDraftReadiness = {
  eligible: boolean
  blockers: CandidateDraftReadinessBlocker[]
}

/**
 * Read-only presentation check. The final decision must be recomputed inside
 * the atomic SQL promotion operation under database row locks.
 *
 * A linked author is not proof of legal rights to the selected edition.
 * Rights are independently evaluated by the source-scoped promotion gate.
 */
export function getCandidateDraftReadiness(
  candidate: WorkCandidate,
  sources: CandidateSourceOption[],
  rights: CandidateComponentRight[],
): CandidateDraftReadiness {
  const gate = getCandidatePromotionGate(candidate, sources, rights)
  const blockers: CandidateDraftReadinessBlocker[] = [...gate.blockers]

  if (!candidate.matched_author_id) blockers.push("author_match_required")
  if (candidate.identity_status !== "matched") blockers.push("author_identity_unverified")

  const source = gate.preferredSource
  if (!source?.language || !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(source.language)) {
    blockers.push("source_language_required")
  }

  return { eligible: blockers.length === 0, blockers }
}
