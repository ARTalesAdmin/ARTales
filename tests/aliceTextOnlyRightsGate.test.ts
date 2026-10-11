import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessAliceTextOnlyDraft} from "../lib/pilots/aliceTextOnlyRightsGate";
const bytes=readFileSync("tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt");
test("real pinned Alice original text eligible for draft with component exclusions",()=>{
 const result=assessAliceTextOnlyDraft(bytes,"2026-10-11T19:30:00.000Z");
 assert.equal(result.decision,"eligible_for_editorial_draft");
 assert.equal(result.chapter_count,12);
 assert.deepEqual(result.included,["pg11:work-text"]);
 assert.equal(result.excluded.length,5);
 assert.equal(result.publication_authorized,false);
 assert.equal(result.release_review_required,true);
 assert.equal(result.component_sha256,"e5c49c189514b6ebe8544b6da3fc36cd207e1fd63f7f77f2921b664aec5bc501");
});
test("tampered source and missing date fail closed",()=>{
 const changed=Buffer.from(bytes);changed[90]^=1;
 assert.throws(()=>assessAliceTextOnlyDraft(changed,"2026-10-11T19:30:00.000Z"),/SHA-256/);
 assert.throws(()=>assessAliceTextOnlyDraft(bytes,"invalid"),/timestamp/);
});
