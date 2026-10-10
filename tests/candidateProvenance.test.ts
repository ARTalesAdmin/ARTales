import assert from "node:assert/strict"
import test from "node:test"
import { getSourceProvenanceBlockers, type SourceProvenanceReview } from "../lib/candidateProvenance"
import type { CandidateSourceOption } from "../lib/candidateSources"

const source: CandidateSourceOption = {
  id:"source-a",candidate_id:"candidate-a",provider:"Fixture",source_type:"ebook",
  reference:"fixture",url:null,language:"en",publication_facts:null,
  identity_match:"strong",status:"preferred",note:null
}
const review: SourceProvenanceReview = {
  source_id:"source-a",candidate_id:"candidate-a",draft_origin_type:"public_domain",
  draft_source_label:"web",provenance_basis:"Reviewed specific synthetic source and edition.",
  provenance_reviewed_by:"editor-a",provenance_reviewed_at:"2026-10-10T10:00:00Z",
  source_updated_at:"2026-10-10T09:00:00Z",
}
test("a complete source-scoped editor review passes read-only preflight",()=> {
  assert.deepEqual(getSourceProvenanceBlockers(source,review),[])
})
test("missing review fails closed",()=>{
  assert.deepEqual(getSourceProvenanceBlockers(source,null),["source_provenance_missing"])
})
test("review from another source cannot be reused",()=>{
  assert.deepEqual(getSourceProvenanceBlockers(source,{...review,source_id:"other"}),["source_provenance_mismatch"])
})
test("uncited work-level approval cannot replace edition-specific evidence",()=>{
  assert.ok(getSourceProvenanceBlockers(source,{...review,provenance_basis:"Public domain"}).includes("source_provenance_unverified"))
})
test("missing origin and reviewer are not inferred from Gutenberg",()=>{
  assert.ok(getSourceProvenanceBlockers(source,{...review,draft_origin_type:null,provenance_reviewed_by:null}).includes("source_provenance_unverified"))
})
test("a later source edit invalidates the previous review",()=>{
  assert.ok(getSourceProvenanceBlockers(source,{...review,source_updated_at:"2026-10-10T11:00:00Z"}).includes("source_provenance_stale"))
})
