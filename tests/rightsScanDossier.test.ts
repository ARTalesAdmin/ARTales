import assert from "node:assert/strict"
import test from "node:test"
import { evaluateRightsScan, type RightsScanDossier } from "../lib/rightsScanDossier"

const hash = "a".repeat(64)
const base: RightsScanDossier = {
  format:"artales-rights-dossier-v1", candidateId:"candidate",sourceId:"source",
  editionId:"edition",snapshotSetId:"snapshots-1",targetJurisdiction:"EU_CZ",
  policyVersion:"test-1",capture:{rawSourceSha256:hash,rawSourceByteLength:350,rawSourceArchiveRef:"archive/raw",capturedAt:"2026-10-10T07:00:00Z",inventoryComplete:true,collectorVersion:"fixture-1"},scanner:{engine:"fixture",version:"1",ranAt:"2026-10-10T08:00:00Z"},
  snapshots:[
    {id:"text",kind:"WORK_CONTENT",sourceId:"source",editionId:"edition",sha256:hash,
      byteLength:300,capturedAt:"2026-10-10T08:00:00Z",archiveRef:"archive/text"},
    {id:"edition",kind:"EDITION_CONTENT",sourceId:"source",editionId:"edition",sha256:hash,byteLength:40,capturedAt:"2026-10-10T08:00:00Z",archiveRef:"archive/edition"},
    {id:"wrapper",kind:"SOURCE_WRAPPER",sourceId:"source",editionId:"edition",sha256:hash,
      byteLength:50,capturedAt:"2026-10-10T08:00:00Z",archiveRef:"archive/wrapper"}
  ],
  evidence:[{id:"source-evidence",type:"primary_record",sourceId:"source",editionId:"edition",componentIds:["text"],sourceUri:"https://example.invalid/rights",
    archiveRef:"archive/evidence",sha256:hash,capturedAt:"2026-10-10T08:00:00Z",
    jurisdiction:"EU_CZ",claim:"Synthetic documented source and rights statement."}],
  decisions:[
    {componentId:"text",action:"include",finding:"supported",confidence:"high",
      evidenceIds:["source-evidence"],rationale:"Synthetic primary evidence explicitly supports source content."},
    {componentId:"edition",action:"exclude",finding:"unknown",confidence:"low",evidenceIds:[],rationale:"Edition-specific addenda were identified and omitted from ingest.",exclusionMethod:"omit_from_ingest"},
    {componentId:"wrapper",action:"exclude",finding:"unknown",confidence:"low",
      evidenceIds:[],rationale:"Excluded non-literary source terms, not part of the book.",
      exclusionMethod:"omit_from_ingest"}
  ]
}
const check=(changes:Partial<RightsScanDossier>)=>evaluateRightsScan({...base,...changes})
test("machine triage can stage original text without wrapper, never authorize publication",()=>{
 const r=check({});assert.equal(r.outcome,"candidate_draft_eligible");
 assert.deepEqual(r.includedSnapshotIds,["text"]);assert.deepEqual(r.excludedSnapshotIds,["edition","wrapper"]);
 assert.equal(r.publicationAuthorized,false)
})
test("unknown translation rights escalates independently of public-domain original",()=>{
 const s={id:"translation",kind:"TRANSLATION" as const,sourceId:"source",editionId:"edition",
 sha256:hash,byteLength:200,capturedAt:"2026-10-10T08:00:00Z",archiveRef:"archive/translation"};
 const r=check({snapshots:[...base.snapshots,s],
 decisions:[...base.decisions,{componentId:"translation",action:"include",finding:"unknown",confidence:"low",evidenceIds:[],rationale:"Needs translator rights"}]});
 assert.equal(r.outcome,"needs_specialist_review");assert.ok(r.issues.some(i=>i.componentId==="translation"))
})
test("AI opinion alone never clears inclusion",()=>{
 const e={...base.evidence[0],type:"automated_analysis" as const};
 assert.equal(check({evidence:[e]}).outcome,"needs_specialist_review")
})
test("a disputed item always escalates",()=>{
 const decisions=base.decisions.map(x=>x.componentId==="text"?{...x,disputeFlag:true}:x);
 assert.equal(check({decisions}).outcome,"needs_specialist_review")
})
test("invalid content snapshot hash fails closed",()=>{
 const snapshots=base.snapshots.map(x=>x.id==="text"?{...x,sha256:"bad"}:x);
 assert.equal(check({snapshots}).outcome,"needs_specialist_review")
})
test("denied included text blocks source",()=>{
 const decisions=base.decisions.map(x=>x.componentId==="text"?{...x,finding:"denied" as const}:x);
 assert.equal(check({decisions}).outcome,"source_blocked")
})

test("a missing inventory completeness proof cannot clear staging",()=>{
 assert.equal(check({capture:{...base.capture,inventoryComplete:false}}).outcome,"needs_specialist_review")
})
test("edition rights must be assessed separately from original text",()=>{
 assert.equal(check({snapshots:base.snapshots.filter(s=>s.kind!=="EDITION_CONTENT"),decisions:base.decisions.filter(d=>d.componentId!=="edition")}).outcome,"needs_specialist_review")
})
test("evidence about a different edition or component cannot clear source text",()=>{
 const swapped={...base.evidence[0],editionId:"foreign-edition"};
 assert.equal(check({evidence:[swapped]}).outcome,"needs_specialist_review")
})
test("unresolved findings never return a partial usable include list",()=>{
 const rights=base.decisions.map(d=>d.componentId==="edition"?{...d,action:"hold" as const}:d);
 const result=check({decisions:rights});assert.equal(result.outcome,"needs_specialist_review");assert.deepEqual(result.includedSnapshotIds,[])
})
