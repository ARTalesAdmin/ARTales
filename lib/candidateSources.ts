import type { WorkCandidate } from "@/lib/dbCandidates"
import { isCandidatesFixturePreview } from "@/lib/fixtures/workCandidates"

export type CandidateSourceStatus = "candidate" | "preferred" | "needs_review" | "rejected"
export type CandidateSourceIdentityMatch = "strong" | "partial" | "uncertain"

export type CandidateDiscoveryIdentity = {
  normalized_title: string
  normalized_author: string
  author_life_dates: string | null
  first_publication: string | null
  identity_note: string | null
}

export type CandidateSourceOption = {
  id: string
  candidate_id: string
  provider: string
  source_type: string
  reference: string
  url: string | null
  language: string | null
  publication_facts: string | null
  identity_match: CandidateSourceIdentityMatch
  status: CandidateSourceStatus
  note: string | null
}

const fixtureSources: CandidateSourceOption[] = [
  {
    id: "fixture-source-wolfings-gutenberg",
    candidate_id: "00000000-0000-4000-8000-000000000101",
    provider: "Project Gutenberg",
    source_type: "ebook / transcription",
    reference: "eBook #2885",
    url: "https://www.gutenberg.org/ebooks/2885",
    language: "en",
    publication_facts: "Reference source candidate for the work; edition/component review is still required.",
    identity_match: "strong",
    status: "preferred",
    note: "Fixture: canonical source identifier and title/author match are strong. Concrete edition/component rights remain a later step.",
  },
  {
    id: "fixture-source-wolfings-scan",
    candidate_id: "00000000-0000-4000-8000-000000000101",
    provider: "Fixture archive",
    source_type: "scan candidate",
    reference: "secondary-scan-fixture",
    url: null,
    language: "en",
    publication_facts: "Secondary edition candidate with incomplete metadata.",
    identity_match: "partial",
    status: "needs_review",
    note: "Fixture-only alternative used to exercise contradictory/incomplete source handling.",
  },
  {
    id: "fixture-source-wolfings-alt",
    candidate_id: "00000000-0000-4000-8000-000000000101",
    provider: "Fixture source",
    source_type: "alternate edition",
    reference: "alternate-edition-fixture",
    url: null,
    language: "en",
    publication_facts: null,
    identity_match: "uncertain",
    status: "rejected",
    note: "Fixture-only result with insufficient identity evidence.",
  },
]

export function getCandidateSourceOptions(candidate: WorkCandidate): CandidateSourceOption[] {
  if (isCandidatesFixturePreview()) {
    const options = fixtureSources.filter((source) => source.candidate_id === candidate.id)
    if (options.length) return options
  }

  if (!candidate.selected_source_reference && !candidate.selected_source_url && !candidate.selected_source_type) {
    return []
  }

  return [
    {
      id: `legacy-selected-${candidate.id}`,
      candidate_id: candidate.id,
      provider: "Selected source",
      source_type: candidate.selected_source_type ?? "unknown",
      reference: candidate.selected_source_reference ?? "selected source",
      url: candidate.selected_source_url,
      language: null,
      publication_facts: null,
      identity_match: "strong",
      status: "preferred",
      note: "Projected from the current single-source candidate fields until P1-1C persistence is normalized.",
    },
  ]
}


export function getCandidateDiscoveryIdentity(candidate: WorkCandidate): CandidateDiscoveryIdentity {
  if (isCandidatesFixturePreview() && candidate.id === "00000000-0000-4000-8000-000000000101") {
    return {
      normalized_title: "The House of the Wolfings",
      normalized_author: "William Morris",
      author_life_dates: "1834–1896",
      first_publication: "1889",
      identity_note: "Fixture: normalized work/author identity is treated as a strong match for exercising the discovery workflow.",
    }
  }

  return {
    normalized_title: candidate.proposed_title,
    normalized_author: candidate.proposed_author_name,
    author_life_dates: null,
    first_publication: null,
    identity_note: "Using candidate identity until normalized discovery metadata is persisted.",
  }
}
