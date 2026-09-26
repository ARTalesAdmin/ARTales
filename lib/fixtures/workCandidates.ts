import type { WorkCandidate } from "@/lib/dbCandidates"

export function isCandidatesFixturePreview() {
  return (
    process.env.ARTALES_FIXTURE_MODE === "candidates" &&
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "develop"
  )
}

export const fixtureEditorProfile = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "fixture-editor@invalid.example",
  handle: "fixture-editor",
  display_name: "Fixture editor",
  role: "editor",
  is_active: true,
  invited_by_user_id: null,
  invite_id: null,
  preferred_locale: "cs",
  reader_theme: null,
  reader_width: null,
  reader_density: null,
  reader_font_scale: null,
  reader_controls_collapsed: null,
  profile_completed_at: null,
}

export const fixtureWorkCandidates: WorkCandidate[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    proposed_title: "The House of the Wolfings",
    proposed_author_name: "William Morris",
    origin: "internal_list",
    origin_reference: "Project Gutenberg #2885",
    status: "checking",
    priority: 80,
    matched_author_id: null,
    matched_work_id: null,
    discovery_status: "pending",
    rights_status: "review_required",
    rights_reason: "Fixture: work-level EU/CZ triage and concrete edition/component review are intentionally still pending.",
    jurisdiction: "EU_CZ",
    not_before: null,
    review_required: true,
    selected_source_type: "ebook",
    selected_source_reference: "Project Gutenberg #2885",
    selected_source_url: "https://www.gutenberg.org/ebooks/2885",
    created_at: "2026-09-26T00:00:00.000Z",
    updated_at: "2026-09-26T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    proposed_title: "Fixture: kandidát připravený k přijetí",
    proposed_author_name: "Ukázkový autor",
    origin: "manual",
    origin_reference: null,
    status: "ready",
    priority: 60,
    matched_author_id: null,
    matched_work_id: null,
    discovery_status: "complete",
    rights_status: "clear",
    rights_reason: "Fixture pro vizuální kontrolu stavu ready/clear.",
    jurisdiction: "EU_CZ",
    not_before: null,
    review_required: false,
    selected_source_type: "fixture",
    selected_source_reference: "fixture-ready",
    selected_source_url: null,
    created_at: "2026-09-26T00:00:00.000Z",
    updated_at: "2026-09-26T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    proposed_title: "Fixture: blokovaný kandidát",
    proposed_author_name: "Ukázkový autor",
    origin: "reader_request",
    origin_reference: "fixture-request",
    status: "deferred",
    priority: 30,
    matched_author_id: null,
    matched_work_id: null,
    discovery_status: "needs_review",
    rights_status: "blocked",
    rights_reason: "Fixture pro kontrolu blokovaného/deferred stavu.",
    jurisdiction: "EU_CZ",
    not_before: null,
    review_required: true,
    selected_source_type: null,
    selected_source_reference: null,
    selected_source_url: null,
    created_at: "2026-09-26T00:00:00.000Z",
    updated_at: "2026-09-26T00:00:00.000Z",
  },
]

export function getFixtureCandidate(id: string) {
  return fixtureWorkCandidates.find((candidate) => candidate.id === id) ?? null
}
