import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {composeSemanticRevision,recomposeSemanticLayout,submitSemanticIssue,walkSemanticAtoms} from "../lib/semantic/compose";
import {verifySignedReadback} from "../lib/semantic/verifySignedReadback";
const id="11111111-1111-4111-8111-111111111111";
const snapshot="22222222-2222-4222-8222-222222222222";
const raw="CHAPTER I. First\n\nA paragraph to be reviewed.";
const sha=(x:string)=>createHash("sha256").update(x).digest("hex");
const sourceHash=sha(raw);
const initial=composeSemanticRevision({work_id:id,work_slug:"synthetic-alice",snapshot_ref:"sha256:"+sourceHash,
 source_bytes_sha256:sourceHash,component_id:"33333333-3333-4333-8333-333333333333",original_byte_start:0,original_raw:raw});
function envelope(r:typeof initial,overrides:Record<string,unknown>={}){
 const {revision_sha256,revision_ref,...payload}=r;
 void revision_ref;
 return {result:"ready",publication_allowed:false,work_id:id,work_slug:"synthetic-alice",
  source_snapshot_id:snapshot,source_sha256:sourceHash,draft_id:"44444444-4444-4444-8444-444444444444",
  revision_sha256,serialized_payload:JSON.stringify(payload),round:r.round,
  parent_draft_id:r.round===0?null:"55555555-5555-4555-8555-555555555555",
  pending_issue:null,previous_return:null,...overrides};
}
const expected={work_id:id,slug:"synthetic-alice"};
test("signed first revision is readable only as non-publishing draft",()=>{
 const state=verifySignedReadback(envelope(initial),expected);
 assert.equal(state.revision.revision_ref,initial.revision_ref);
 assert.equal(state.publication_allowed,false);
});
test("modified serial, different work, untrusted source and malformed return reject",()=>{
 assert.throws(()=>verifySignedReadback(envelope(initial,{serialized_payload:"{}"}),expected),/digest/);
 assert.throws(()=>verifySignedReadback(envelope(initial,{work_id:"66666666-6666-4666-8666-666666666666"}),expected),/Untrusted/);
 assert.throws(()=>verifySignedReadback(envelope(initial,{source_sha256:"f".repeat(64)}),expected),/mismatch/);
 assert.throws(()=>verifySignedReadback(envelope(initial,{pending_issue:{id:"bad"}}),expected),/Pending|Unverified/);
});
test("returned child must be linked to a real prior issue",()=>{
 const target=walkSemanticAtoms(initial.blocks).find(x=>x.raw.includes("A paragraph"))!;
 const issue=submitSemanticIssue(initial,{id:"review-a",target_atom_id:target.id,kind:"typography",
  reason:"Adjust paragraph indentation",requested_layout:"indent_small"});
 const child=recomposeSemanticLayout(initial,issue,raw);
 assert.equal(verifySignedReadback(envelope(child,{previous_return:issue}),expected).revision.round,1);
 assert.throws(()=>verifySignedReadback(envelope(child),expected),/ancestor/);
 assert.throws(()=>verifySignedReadback(envelope(child,{previous_return:{...issue,id:"foreign"}}),expected),/ancestor/);
});
