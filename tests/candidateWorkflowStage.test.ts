import test from "node:test";
import assert from "node:assert/strict";
import {candidateWorkflowStage,candidateWorkflowDestination,candidateWorkflowLabels} from "../lib/editorial/candidateWorkflowStage";
const base={intakeStatus:"new",latestVerdict:null,legalLocked:false,snapshotStatus:null,hasRevision:false,published:false} as const;
test("legacy intake NEW never overrides completed legal / snapshot / editorial evidence",()=>{
 assert.equal(candidateWorkflowStage({...base}),"new");
 assert.equal(candidateWorkflowStage({...base,legalLocked:true}),"legal_ready");
 assert.equal(candidateWorkflowStage({...base,legalLocked:true,snapshotStatus:"verified"}),"archived");
 assert.equal(candidateWorkflowStage({...base,legalLocked:true,snapshotStatus:"verified",hasRevision:true}),"editorial");
 assert.equal(candidateWorkflowStage({...base,legalLocked:true,hasRevision:true,published:true}),"published");
});
test("uncertainty and rejected decisions are not silently represented as approved",()=>{
 assert.equal(candidateWorkflowStage({...base,latestVerdict:"needs_evidence"}),"uncertainty");
 assert.equal(candidateWorkflowStage({...base,latestVerdict:"rejected"}),"rejected");
 assert.equal(candidateWorkflowStage({...base,snapshotStatus:"attention"}),"archive_attention");
});
test("one canonical next destination for actual lifecycle",()=>{
 const id="00000000-0000-4000-8000-000000000001";
 assert.equal(candidateWorkflowDestination(id,"legal_ready"),"/member/snapshot/"+id);
 assert.equal(candidateWorkflowDestination(id,"archived"),"/member/snapshot/"+id);
 assert.equal(candidateWorkflowDestination(id,"editorial"),"/member/editorial-detail/"+id);
 assert.equal(candidateWorkflowDestination(id,"uncertainty"),"/member/legal/"+id);
 assert.equal(candidateWorkflowLabels.archived,"Archiv připraven");
});
test("candidate overview displays downstream status and linked evidence in the source",async()=>{
 const {readFileSync}=await import("node:fs");
 const s=readFileSync("app/member/candidates/page.tsx","utf8");
 assert.match(s,/candidateWorkflowStage\(/);
 assert.match(s,/candidate_snapshots/);
 assert.match(s,/candidate_legal_locks/);
 assert.match(s,/candidate_semantic_revisions/);
 assert.match(s,/candidateWorkflowDestination/);
});
