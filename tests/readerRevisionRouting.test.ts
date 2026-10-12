import test from "node:test";
import assert from "node:assert/strict";
import {inspectReaderRevisionRouting,type ReaderRoutingProof} from "../lib/publication/readerRevisionRouting";
const h="a".repeat(64),s="b".repeat(64),t="c".repeat(64);
const input:ReaderRoutingProof={
 workId:"11111111-1111-4111-8111-111111111111",slug:"alice",currentPublishedReleaseId:"legacy-a",
 activeRevision:"legacy",proposedRevision:"semantic_v2",targetReleaseId:"semantic-b",
 editorialState:"approved",rightsState:"approved",readerQaState:"passed",
 expectedWorkVersion:12,observedWorkVersion:12,explicitAdminAuthorization:true,
 cutover:{
  workId:"11111111-1111-4111-8111-111111111111",slug:"alice",
  proposedWorkId:"11111111-1111-4111-8111-111111111111",proposedSlug:"alice",
  legacyObservedSha256:h,rawSourceSha256:s,
  sourceComparison:{legacyObservedSha256:h,rawSourceSha256:s,verdict:"matched"},
  newSemanticTextSha256:t,readerQaTextSha256:t,readerQaPassed:true,
  originalReaderStateCount:2,mappedReaderStateCount:1,
  approximateLocationCount:1,originalPositionFallbackKept:true,
 }
};
test("complete shadow evidence qualifies but never changes public routing",()=>{
 const r=inspectReaderRevisionRouting(input);
 assert.equal(r.eligibleForAtomicSwitch,true);
 assert.equal(r.mode,"legacy");
 assert.equal(r.retainLegacyRollback,true);
 assert.deepEqual(r.blockers,[]);
});
test("draft, missing rights, stale work version and absent approval block switching",()=>{
 for(const patch of [
  {editorialState:"draft" as const},{rightsState:"pending" as const},
  {readerQaState:"pending" as const},{observedWorkVersion:13},
  {explicitAdminAuthorization:false},{cutover:null},
 ]){
  const r=inspectReaderRevisionRouting({...input,...patch});
  assert.equal(r.eligibleForAtomicSwitch,false,JSON.stringify(patch));
  assert.equal(r.mode,"legacy");
 }
});
test("foreign work and broken note fallback cannot switch release",()=>{
 const foreign=inspectReaderRevisionRouting({...input,workId:"another-work"});
 assert.equal(foreign.eligibleForAtomicSwitch,false);
 assert.ok(foreign.blockers.includes("cutover_identity_mismatch"));
 const changed=inspectReaderRevisionRouting({...input,cutover:{...input.cutover!,originalPositionFallbackKept:false}});
 assert.equal(changed.eligibleForAtomicSwitch,false);
 assert.ok(changed.blockers.includes("reader_state_unprotected"));
});
