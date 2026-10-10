import type { CandidateSourceOption } from "@/lib/candidateSources"

export type DraftOriginType = "public_domain" | "original" | "translation" | "other"
export type DraftSourceLabel = "gutenberg" | "web" | "manual" | "original"

export type SourceProvenanceReview = {
  source_id: string
  candidate_id: string
  draft_origin_type: DraftOriginType | null
  draft_source_label: DraftSourceLabel | null
  provenance_basis: string | null
  provenance_reviewed_by: string | null
  provenance_reviewed_at: string | null
  source_updated_at: string | null
}

export type SourceProvenanceBlocker =
  | "source_provenance_missing"
  | "source_provenance_mismatch"
  | "source_provenance_unverified"
  | "source_provenance_stale"

/**
 * A read-only UI preflight, not legal advice or authorization.
 * The DB transaction must repeat all checks using locked, persisted rows.
 * Never infer copyright eligibility from a provider, URL, or publication year.
 */
export function getSourceProvenanceBlockers(
  source: CandidateSourceOption | null,
  review: SourceProvenanceReview | null,
): SourceProvenanceBlocker[] {
  if (!source || !review) return ["source_provenance_missing"]
  if (review.source_id !== source.id || review.candidate_id !== source.candidate_id) {
    return ["source_provenance_mismatch"]
  }

  const blockers: SourceProvenanceBlocker[] = []
  if (
    !review.draft_origin_type ||
    !review.draft_source_label ||
    !review.provenance_basis ||
    review.provenance_basis.trim().length < 20 ||
    !review.provenance_reviewed_by ||
    !review.provenance_reviewed_at
  ) {
    blockers.push("source_provenance_unverified")
  }

  const reviewedAt = review.provenance_reviewed_at
    ? Date.parse(review.provenance_reviewed_at) : NaN
  const sourceUpdatedAt = review.source_updated_at
    ? Date.parse(review.source_updated_at) : NaN

  if (!Number.isFinite(reviewedAt) || !Number.isFinite(sourceUpdatedAt) ||
      reviewedAt < sourceUpdatedAt) {
    blockers.push("source_provenance_stale")
  }
  return blockers
}
