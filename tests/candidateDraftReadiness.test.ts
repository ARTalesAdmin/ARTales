import assert from "node:assert/strict"
import test from "node:test"
import { getCandidateDraftReadiness } from "../lib/candidateDraftReadiness"
import type { WorkCandidate } from "../lib/dbCandidates"
import type { CandidateSourceOption } from "../lib/candidateSources"
import type { CandidateComponentRight } from "../lib/candidateComponentRights"

const candidate: WorkCandidate = {
  id: "00000000-0000-4000-8000-000000000201",
  proposed_title: "Example", proposed_author_name: "Author",
  normalized_title: "Example", normalized_author_name: "Author",
  identity_status: "matched", origin: "manual", origin_reference: null,
  status: "ready", priority: 50,
  matched_author_id: "00000000-0000-4000-8000-000000000301",
  matched_work_id: null, discovery_status: "complete", rights_status: "clear",
  rights_reason: null, jurisdiction: "EU_CZ", not_before: null,
  review_required: false, selected_source_type: "ebook",
  selected_source_reference: "sample", selected_source_url: null,
  preferred_source_id: "00000000-0000-4000-8000-000000000401",
  created_at: "", updated_at: "",
}
const source: CandidateSourceOption = {
  id: candidate.preferred_source_id!, candidate_id: candidate.id,
  provider: "Fixture", source_type: "ebook", reference: "sample",
  url: null, language: "en", publication_facts: null,
  identity_match: "strong", status: "preferred", note: null,
}
const rights: CandidateComponentRight[] = [
  {id:"text",candidate_id:candidate.id,source_id:source.id,component:"WORK_CONTENT",
    label:"Text",decision:"usable",publication_effect:"allow",reason:"fixture"},
  {id:"edition",candidate_id:candidate.id,source_id:source.id,component:"EDITION_CONTENT",
    label:"Edition",decision:"exclude",publication_effect:"exclude_component",reason:"fixture"},
  {id:"wrapper",candidate_id:candidate.id,source_id:source.id,component:"SOURCE_WRAPPER",
    label:"Wrapper",decision:"exclude",publication_effect:"exclude_component",reason:"fixture"},
]
const evaluate = (c=candidate, s=source, r=rights) =>
  getCandidateDraftReadiness(c,[s],r)

test("eligible when work, edition, identity and linked author are verified", () => {
  assert.deepEqual(evaluate(), {eligible:true,blockers:[]})
})
test("no linked author blocks draft creation", () => {
  const result=evaluate({...candidate,matched_author_id:null})
  assert.equal(result.eligible,false)
  assert.ok(result.blockers.includes("author_match_required"))
})
test("unmatched normalized identity blocks draft creation", () => {
  assert.ok(evaluate({...candidate,identity_status:"needs_review"}).blockers.includes("author_identity_unverified"))
})
test("source language is mandatory and checked", () => {
  assert.ok(evaluate(candidate,{...source,language:null}).blockers.includes("source_language_required"))
  assert.ok(evaluate(candidate,{...source,language:"??"}).blockers.includes("source_language_required"))
})
test("source marked rejected is not a valid preferred source", () => {
  assert.ok(evaluate(candidate,{...source,status:"rejected"}).blockers.includes("preferred_source_missing"))
})
test("translation requiring review prevents promotion", () => {
  const translation: CandidateComponentRight = {
    id:"translation",candidate_id:candidate.id,source_id:source.id,
    component:"TRANSLATION",label:"Translation",decision:"review_required",
    publication_effect:"review",reason:"unverified rights"
  }
  assert.ok(evaluate(candidate,source,[...rights,translation]).blockers.includes("component_rights_review"))
})
