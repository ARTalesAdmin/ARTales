import assert from "node:assert/strict"
import test from "node:test"
import { getCandidatePromotionGate } from "../lib/candidatePromotionGate"
import type { WorkCandidate } from "../lib/dbCandidates"
import type { CandidateSourceOption } from "../lib/candidateSources"
import type { CandidateComponentRight } from "../lib/candidateComponentRights"

const candidate: WorkCandidate = {
  id: "candidate-1", proposed_title: "Pilot", proposed_author_name: "Author",
  origin: "manual", origin_reference: null, status: "ready", priority: 50,
  matched_author_id: null, matched_work_id: null, discovery_status: "complete",
  rights_status: "clear", rights_reason: null, jurisdiction: "EU_CZ",
  not_before: null, review_required: false, selected_source_type: "ebook",
  selected_source_reference: "source-1", selected_source_url: null,
  preferred_source_id: "source-1", created_at: "", updated_at: "",
}
const source: CandidateSourceOption = {
  id: "source-1", candidate_id: candidate.id, provider: "Archive", source_type: "ebook",
  reference: "source-1", url: null, language: "en", publication_facts: null,
  identity_match: "strong", status: "preferred", note: null,
}
const rights: CandidateComponentRight[] = [
  { id: "right-1", candidate_id: candidate.id, source_id: source.id, component: "WORK_CONTENT",
    label: "Work", decision: "usable", publication_effect: "allow", reason: "checked" },
  { id: "right-2", candidate_id: candidate.id, source_id: source.id, component: "EDITION_CONTENT",
    label: "Edition", decision: "exclude", publication_effect: "exclude_component", reason: "remove additions" },
  { id: "right-3", candidate_id: candidate.id, source_id: source.id, component: "SOURCE_WRAPPER",
    label: "Wrapper", decision: "exclude", publication_effect: "exclude_component", reason: "remove Gutenberg wrapper" },
]
const gate = (
  c: WorkCandidate = candidate,
  sources: CandidateSourceOption[] = [source],
  componentRights: CandidateComponentRight[] = rights,
) => getCandidatePromotionGate(c, sources, componentRights)

test("cleared text with excluded Gutenberg wrapper and edition additions is eligible", () => {
  assert.deepEqual(gate().blockers, [])
  assert.equal(gate().eligible, true)
})

test("missing persisted source relation never passes on legacy projection", () => {
  assert.ok(gate({ ...candidate, preferred_source_id: null }).blockers.includes("preferred_source_missing"))
})

test("a different preferred source cannot satisfy this candidate", () => {
  assert.ok(gate(candidate, [{ ...source, id: "wrong-source" }]).blockers.includes("preferred_source_missing"))
})

test("missing edition rights fails closed even when the main text is clear", () => {
  const result = gate(candidate, [source], rights.filter((r) => r.component !== "EDITION_CONTENT"))
  assert.ok(result.blockers.includes("component_rights_review"))
})

test("a right tied to an alternate source cannot clear the selected edition", () => {
  const result = gate(candidate, [source], rights.map((r) => ({ ...r, source_id: "other-source" })))
  assert.ok(result.blockers.includes("component_rights_review"))
})

test("unknown illustration rights explicitly need review", () => {
  const result = gate(candidate, [source], [...rights, {
    id: "asset", candidate_id: candidate.id, source_id: source.id,
    component: "ASSET" as const, label: "Illustration", decision: "review_required" as const,
    publication_effect: "review" as const, reason: "different author",
  }])
  assert.ok(result.blockers.includes("component_rights_review"))
})

test("blocked translations fail even if the original work is cleared", () => {
  const result = gate(candidate, [source], [...rights, {
    id: "translation", candidate_id: candidate.id, source_id: source.id,
    component: "TRANSLATION" as const, label: "Translation", decision: "blocked" as const,
    publication_effect: "block_source" as const, reason: "no permission",
  }])
  assert.ok(result.blockers.includes("component_rights_blocked"))
})

test("future component clearance fails when the component would be retained", () => {
  const edited = rights.map((r) =>
    r.component === "WORK_CONTENT" ? { ...r, not_before: "2999-01-01" } : r)
  assert.ok(gate(candidate, [source], edited).blockers.includes("component_rights_review"))
})

test("inconsistent rights decision and effect fails closed", () => {
  const edited = rights.map((r) =>
    r.component === "SOURCE_WRAPPER" ? { ...r, publication_effect: "allow" as const } : r)
  assert.ok(gate(candidate, [source], edited).blockers.includes("component_rights_review"))
})

test("a candidate cannot be promoted twice", () => {
  assert.ok(gate({ ...candidate, matched_work_id: "work-123" }).blockers.includes("already_promoted"))
})


test("pending human review is a blocker even when summary triage is clear", () => {
  assert.ok(gate({ ...candidate, review_required: true }).blockers.includes("triage_blocked"))
})

test("rights tied to a different candidate cannot authorize this one", () => {
  const otherCandidateRights = rights.map((right) => ({ ...right, candidate_id: "other-candidate" }))
  assert.ok(gate(candidate, [source], otherCandidateRights).blockers.includes("component_rights_review"))
})

test("a preferred source from a different candidate does not authorize promotion", () => {
  const foreignSource = { ...source, candidate_id: "other-candidate" }
  assert.ok(gate(candidate, [foreignSource], rights).blockers.includes("preferred_source_missing"))
})

test("a candidate already stamped promoted cannot produce another draft", () => {
  assert.ok(gate({ ...candidate, promoted_at: "2026-10-09T18:00:00Z" }).blockers.includes("already_promoted"))
})
