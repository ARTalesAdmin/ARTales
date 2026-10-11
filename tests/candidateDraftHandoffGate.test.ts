import test from "node:test"
import assert from "node:assert/strict"
import {inspectCapturedSource, type CaptureEnvelope} from "../lib/candidateDraftHandoffGate"
const h="a".repeat(64)
const base=():CaptureEnvelope=>({
 candidateId:"candidate-1",candidateSourceId:"source-1",snapshotSetRef:"snapshot-1",
 capturedAt:"2026-10-10T09:00:00Z",sourceSha256:h,inventoryComplete:true,
 attestationVerified:true,provenanceReviewedAt:"2026-10-10T10:00:00Z",
 sourceUpdatedAt:"2026-10-10T09:00:00Z",
 components:[
  {componentId:"original",kind:"WORK_CONTENT",sha256:h,archiveRef:"archive/original",included:true,decision:"usable",evidenceSha256:h,rightsReviewedAt:"2026-10-10T10:00:00Z"},
  {componentId:"wrapper",kind:"SOURCE_WRAPPER",sha256:h,archiveRef:"archive/wrapper",included:false,decision:"exclude"}
 ]
})
test("reviewed, attested work text with excluded wrapper has no structural blockers",()=>{
 const x=inspectCapturedSource(base());assert.deepEqual(x,{eligibleForDraftHandoff:true,blockers:[]})
})
test("unverified source and missing evidence fail closed",()=>{
 const e=base(); e.attestationVerified=false;delete e.components[0].evidenceSha256
 const x=inspectCapturedSource(e);assert.equal(x.eligibleForDraftHandoff,false);
 assert.ok(x.blockers.includes("capture_unattested"));assert.ok(x.blockers.includes("rights_evidence_missing"))
})
test("stale review and included translation with blocked decision fail closed",()=>{
 const e=base();e.sourceUpdatedAt="2026-10-11T00:00:00Z"
 e.components.push({componentId:"translation",kind:"TRANSLATION",sha256:h,archiveRef:"archive/translation",included:true,decision:"blocked"})
 const x=inspectCapturedSource(e);assert.ok(x.blockers.includes("stale_provenance"));assert.ok(x.blockers.includes("blocked_component_included"))
})
test("missing original, duplicate components and uncertain exclusions are blocked",()=>{
 const e=base();e.components[0].included=false;e.components[0].decision="exclude"
 e.components.push({...e.components[0]});e.components[1].decision="review_required"
 const x=inspectCapturedSource(e);assert.ok(x.blockers.includes("original_text_missing"));assert.ok(x.blockers.includes("capture_incomplete"));assert.ok(x.blockers.includes("component_rights_not_clear"))
})
test("malformed hashes cannot unlock draft",()=>{
 const e=base();e.sourceSha256="bad"
 assert.ok(inspectCapturedSource(e).blockers.includes("snapshot_hash_missing"))
})
