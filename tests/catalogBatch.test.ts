import assert from "node:assert/strict"
import test from "node:test"
import {runSyntheticCatalogBatch} from "../lib/fixtures/catalogBatch"

test("admin run produces bounded synthetic candidates, editorial shortlist and chronology",()=>{
 const result=runSyntheticCatalogBatch(5,30,"2026-10-10","2026-10-10T11:30:00Z")
 assert.equal(result.mode,"synthetic_fixture")
 assert.equal(result.plan.requested,5)
 assert.ok(result.plan.qualified.length>0)
 assert.ok(result.plan.qualified.length<=5)
 assert.ok(result.plan.decisions.length>=result.candidates.length)
 assert.equal(result.plan.actualPublished,0)
 assert.ok(result.plan.prescreenSpentUsd+result.plan.fullScanSpentUsd+result.plan.editorialReservedUsd<=30)
 for(const q of result.plan.qualified){
   assert.ok(q.sourceSnapshotSetId)
   assert.ok(q.dossierRef)
   assert.equal(q.assignment,"shared_inbox")
 }
})
test("unresolved synthetic translation never enters editorial shortlist",()=>{
 const result=runSyntheticCatalogBatch(10,100,"2026-10-10","2026-10-10T11:30:00Z")
 assert.ok(result.plan.qualified.every(q=>!["poetry-01","drama-02"].includes(q.candidateId)))
})
test("no budget, invalid count and invalid date fail before any operation",()=>{
 assert.throws(()=>runSyntheticCatalogBatch(5,0,"2026-10-10","2026-10-10T11:30:00Z"))
 assert.throws(()=>runSyntheticCatalogBatch(13,30,"2026-10-10","2026-10-10T11:30:00Z"))
 assert.throws(()=>runSyntheticCatalogBatch(1,30,"2026-10-10","bad"))
})
