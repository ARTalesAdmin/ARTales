import assert from "node:assert/strict"
import test from "node:test"
import { planCatalogProduction, type CatalogCandidate, type CatalogPolicy } from "../lib/catalogProductionPlanner"

const clearance=[
 {kind:"WORK_CONTENT" as const,clearance:"usable" as const,commercialUseVerified:true},
 {kind:"EDITION_CONTENT" as const,clearance:"excluded" as const,commercialUseVerified:false},
 {kind:"ASSET" as const,clearance:"excluded" as const,commercialUseVerified:false},
 {kind:"TRANSLATION" as const,clearance:"not_applicable" as const,commercialUseVerified:false},
]
const candidate=(id:string,genre:CatalogCandidate["genre"]="prose",authorId=id):CatalogCandidate=>({
 id,title:"Candidate "+id,authorId,author:"Author "+authorId,genre,priority:50,
 prescreen:"promising",prescreenCostUsd:.01,fullScanCostUsd:.1,
 estimatedEditorialCostUsd:2,
 screen:{outcome:"provisionally_clear",snapshotSetId:"snapshot-"+id,dossierRef:"dossier-"+id,
 evidenceCurrentThrough:"2026-10-10",components:clearance,
 recommendedEdition:"Original text without images",recommendationReason:"Use verified text; exclude uncertain additions"}
})
const policy:CatalogPolicy={targetTitles:2,prescreenBudgetUsd:1,fullScanBudgetUsd:1,
 editorialBudgetUsd:10,maxFullScans:10,maxPerAuthor:1,genreTargets:{poetry:1,drama:1},
 assignment:"shared_inbox",editorIds:[],asOf:"2026-10-10"}

test("prefers catalog balance and yields editorial titles, never claims publication",()=>{
 const result=planCatalogProduction([candidate("prose"),candidate("poem","poetry"),candidate("play","drama")],policy)
 assert.equal(result.qualified.length,2)
 assert.deepEqual(result.qualified.map(q=>q.genre),["drama","poetry"])
 assert.equal(result.actualPublished,0)
 assert.equal(result.stopReason,"target_reached")
})
test("no license for commercial text means no usable editorial title",()=>{
 const c=candidate("unlicensed")
 c.screen!.components=[{kind:"WORK_CONTENT",clearance:"usable",commercialUseVerified:false},clearance[1]]
 const result=planCatalogProduction([c],policy)
 assert.equal(result.qualified.length,0)
 assert.deepEqual(result.needsHumanReview,["unlicensed"])
})
test("wrong translation can be excluded but not silently included",()=>{
 const c=candidate("translation")
 c.screen!.components=[...clearance.slice(0,2),{kind:"TRANSLATION",clearance:"blocked",commercialUseVerified:false}]
 assert.equal(planCatalogProduction([c],policy).qualified.length,0)
})
test("budget stops scanning and never starts an unauthorised spending action",()=>{
 const result=planCatalogProduction([candidate("a"),candidate("b")],{...policy,fullScanBudgetUsd:.1})
 assert.equal(result.qualified.length,1)
 assert.equal(result.fullScanSpentUsd,.1)
 assert.equal(result.refillRequested,false)
})
test("refill request is a suggestion, not a new candidate or actual AI action",()=>{
 const result=planCatalogProduction([candidate("a")],policy)
 assert.equal(result.refillRequested,true)
 assert.equal(result.refillTarget,1)
 assert.equal(result.qualified.length,1)
})
test("editor assignment may be planned but no task or DB is changed",()=>{
 const result=planCatalogProduction([candidate("a"),candidate("b")],{...policy,genreTargets:{},assignment:"round_robin",editorIds:["ed-1","ed-2"]})
 assert.deepEqual(result.qualified.map(x=>x.assignment),["ed-1","ed-2"])
})
test("source requiring further scan does not count toward target",()=>{
 const c=candidate("pending");c.screen=null
 const result=planCatalogProduction([c],policy)
 assert.equal(result.qualified.length,0)
 assert.equal(result.decisions.at(-1)?.reason,"full_scan_requested_result_pending")
})
