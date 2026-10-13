import test from "node:test";
import assert from "node:assert/strict";
import {observeExistingAliceReadOnly,ALICE_LEGACY_SLUG} from "../lib/pilots/aliceObservedLegacy";
import type {AliceLegacyWorkInput} from "../lib/pilots/aliceObservedLegacy";
const work:AliceLegacyWorkInput={
 id:"3abbac79-8877-4bb6-ae56-8481d8a336da",slug:ALICE_LEGACY_SLUG,
 status:"published",source_label:"gutenberg",source_reference:"https://www.gutenberg.org/ebooks/11",
 canonical_language:"en",content:"",content_blocks:[
  {id:"chapter-1",type:"chapter",content:"Chapter I",editor_note:null},
  {id:"paragraph-1",type:"paragraph",content:"Synthetic test paragraph.",editor_note:null},
 ],
};
test("real Alice observed content cannot authorize cutover",()=>{
 const v=observeExistingAliceReadOnly(work);
 assert.equal(v.work_id,work.id);assert.equal(v.slug,work.slug);
 assert.equal(v.blocks.length,2);assert.equal(v.publication_authorized,false);
 assert.equal(v.can_cutover,false);assert.equal(v.evidence_status,"unarchived_live_observation");
 assert.ok(v.blockers.includes("immutable_legacy_observed_snapshot_required"));
});
test("foreign work source, unknown edition, path spoofing and language fail closed",()=>{
 assert.throws(()=>observeExistingAliceReadOnly({...work,slug:"unrelated"}),/identity/);
 assert.throws(()=>observeExistingAliceReadOnly({...work,canonical_language:"cs"}),/identity/);
 assert.throws(()=>observeExistingAliceReadOnly({...work,source_reference:"https://www.gutenberg.org/ebooks/110"}),/reference/);
 assert.throws(()=>observeExistingAliceReadOnly({...work,source_reference:"https://www.gutenberg.org.evil.test/ebooks/11"}),/reference/);
 assert.throws(()=>observeExistingAliceReadOnly({...work,source_reference:"https://www.gutenberg.org/ebooks/11?edition=changed"}),/reference/);
});
test("duplicate blocks and oversized or malformed observed input fail closed",()=>{
 assert.throws(()=>observeExistingAliceReadOnly({...work,content_blocks:[work.content_blocks[0],work.content_blocks[0]]}),/Duplicate/);
 assert.throws(()=>observeExistingAliceReadOnly({...work,content_blocks:[{...work.content_blocks[0],content:"x".repeat(2_000_001)}]}),/bounded/);
 assert.throws(()=>observeExistingAliceReadOnly({...work,content_blocks:[{...work.content_blocks[0],content:null as unknown as string}]}),/Malformed/);
});
