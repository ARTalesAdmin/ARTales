import type { WorkCandidate } from "@/lib/dbCandidates"
import type { CandidateSourceOption } from "@/lib/candidateSources"
import { isCandidatesFixturePreview } from "@/lib/fixtures/workCandidates"

export type CandidateRightsComponentType =
  | "WORK_CONTENT"
  | "EDITION_CONTENT"
  | "TRANSLATION"
  | "SOURCE_WRAPPER"
  | "EDITORIAL_ADDITION"
  | "ASSET"
  | "UNKNOWN"

export type CandidateRightsDecision =
  | "usable"
  | "exclude"
  | "review_required"
  | "alternate_edition_required"
  | "blocked"
  | "not_applicable"

export type CandidateComponentRight = {
  id: string
  candidate_id: string
  source_id: string | null
  component: CandidateRightsComponentType
  label: string
  decision: CandidateRightsDecision
  reason: string
  publication_effect: "allow" | "exclude_component" | "block_source" | "review"
}

const wolfingsFixtureRights: CandidateComponentRight[] = [
  {
    id: "wolfings-work-content",
    candidate_id: "00000000-0000-4000-8000-000000000101",
    source_id: "fixture-source-wolfings-gutenberg",
    component: "WORK_CONTENT",
    label: "Original work text",
    decision: "usable",
    reason: "Fixture: William Morris died in 1896; work-level text is treated as usable for the EU/CZ workflow preview.",
    publication_effect: "allow",
  },
  {
    id: "wolfings-edition-content",
    candidate_id: "00000000-0000-4000-8000-000000000101",
    source_id: "fixture-source-wolfings-gutenberg",
    component: "EDITION_CONTENT",
    label: "Edition / transcription text",
    decision: "review_required",
    reason: "Concrete transcription and edition-specific contributions still require provenance review before ingest.",
    publication_effect: "review",
  },
  {
    id: "wolfings-translation",
    candidate_id: "00000000-0000-4000-8000-000000000101",
    source_id: "fixture-source-wolfings-gutenberg",
    component: "TRANSLATION",
    label: "Translation",
    decision: "not_applicable",
    reason: "The selected fixture source is English original-language text, so no translation is selected.",
    publication_effect: "allow",
  },
  {
    id: "wolfings-wrapper",
    candidate_id: "00000000-0000-4000-8000-000000000101",
    source_id: "fixture-source-wolfings-gutenberg",
    component: "SOURCE_WRAPPER",
    label: "Project Gutenberg wrapper",
    decision: "exclude",
    reason: "Project Gutenberg headers, license/footer text, and source wrapper are not part of the literary work and must be removed from ARTales content.",
    publication_effect: "exclude_component",
  },
  {
    id: "wolfings-editorial",
    candidate_id: "00000000-0000-4000-8000-000000000101",
    source_id: "fixture-source-wolfings-gutenberg",
    component: "EDITORIAL_ADDITION",
    label: "Transcriber / editorial notes",
    decision: "exclude",
    reason: "Source-specific transcriber or editorial notes should not be imported unless separately reviewed and intentionally retained.",
    publication_effect: "exclude_component",
  },
  {
    id: "wolfings-assets",
    candidate_id: "00000000-0000-4000-8000-000000000101",
    source_id: "fixture-source-wolfings-gutenberg",
    component: "ASSET",
    label: "Illustrations / source assets",
    decision: "review_required",
    reason: "Any illustrations, cover images, or embedded assets need separate rights provenance. Text clearance does not clear assets.",
    publication_effect: "review",
  },
]

export function getCandidateComponentRights(
  candidate: WorkCandidate,
  sources: CandidateSourceOption[],
): CandidateComponentRight[] {
  if (isCandidatesFixturePreview() && candidate.id === "00000000-0000-4000-8000-000000000101") {
    return wolfingsFixtureRights
  }

  const preferred = sources.find((source) => source.status === "preferred") ?? null
  if (!preferred) return []

  return [
    {
      id: `projected-work-${candidate.id}`,
      candidate_id: candidate.id,
      source_id: preferred.id,
      component: "WORK_CONTENT",
      label: "Work content",
      decision: candidate.rights_status === "clear" ? "usable" : "review_required",
      reason: candidate.rights_reason ?? "Projected from candidate-level rights until component rights are persisted.",
      publication_effect: candidate.rights_status === "clear" ? "allow" : "review",
    },
    {
      id: `projected-edition-${candidate.id}`,
      candidate_id: candidate.id,
      source_id: preferred.id,
      component: "EDITION_CONTENT",
      label: "Edition content",
      decision: "review_required",
      reason: "Edition-specific rights have not been normalized yet.",
      publication_effect: "review",
    },
  ]
}

export function getComponentRightsSummary(rights: CandidateComponentRight[]) {
  const blockers = rights.filter((right) =>
    right.publication_effect === "block_source" || right.publication_effect === "review"
  )
  const excluded = rights.filter((right) => right.publication_effect === "exclude_component")

  return {
    canUseSourceAsIs: blockers.length === 0 && excluded.length === 0,
    requiresReview: blockers.some((right) => right.publication_effect === "review"),
    sourceBlocked: blockers.some((right) => right.publication_effect === "block_source"),
    excludedCount: excluded.length,
    blockerCount: blockers.length,
  }
}
