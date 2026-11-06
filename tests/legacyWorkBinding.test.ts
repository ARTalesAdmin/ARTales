import test from "node:test";
import assert from "node:assert/strict";
import {reconcileLegacyWorkReadOnly} from "../lib/pilots/legacyWorkBinding";
const id="11111111-1111-4111-8111-111111111111", slug="alices-adventures-in-wonderland";
const hash="a".repeat(64), ref="sha256:"+hash, revision="sha256:"+"b".repeat(64);
const work={id,slug,status:"published" as const};
const source={work_id:id,snapshot_ref:ref,source_sha256:hash,rights_state:"verified" as const};
const draft={work_id:id,work_slug:slug,snapshot_ref:ref,source_sha256:hash,revision_ref:revision,release_allowed:false as const};
test("real work identity is retained and release remains prohibited",()=>{
 const r=reconcileLegacyWorkReadOnly(work,source,draft);
 assert.equal(r.work_id,id);assert.equal(r.slug,slug);
 assert.equal(r.can_cutover,false);assert.equal(r.can_edit,true);
 assert.ok(r.blockers.includes("real_legacy_evidence_required"));
});
test("missing source or rights clearance fails closed",()=>{
 const none=reconcileLegacyWorkReadOnly(work,null,null);
 assert.equal(none.can_edit,false);
 assert.ok(none.blockers.includes("pinned_source_required"));
 const pending=reconcileLegacyWorkReadOnly(work,{...source,rights_state:"pending"},draft);
 assert.ok(pending.blockers.includes("independent_rights_review_required"));
});
test("foreign work, forged source and mismatched revisions fail closed",()=>{
 assert.throws(()=>reconcileLegacyWorkReadOnly({...work,id:"fixture:alice"},source,draft));
 assert.throws(()=>reconcileLegacyWorkReadOnly(work,{...source,work_id:"22222222-2222-4222-8222-222222222222"},draft),/foreign/);
 assert.throws(()=>reconcileLegacyWorkReadOnly(work,{...source,source_sha256:"c".repeat(64)},draft),/digest/);
 assert.throws(()=>reconcileLegacyWorkReadOnly(work,source,{...draft,work_slug:"other"}),/foreign/);
 assert.throws(()=>reconcileLegacyWorkReadOnly(work,source,{...draft,snapshot_ref:"sha256:"+"d".repeat(64)}),/source mismatch/);
});
