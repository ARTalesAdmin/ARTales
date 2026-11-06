import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {composeFromCapturedDbA} from "../lib/semantic/dbAComponentBridge";
const text="CHAPTER I. Test\r\n\r\nA short introduction.\r\n\r\nCHAPTER II. More\r\n\r\nAnother paragraph.";
const raw=Buffer.from("WRAPPER"+text+"TAIL");
const sha=createHash("sha256").update(raw).digest("hex");
const fixture={work_id:"3abbac79-8877-4bb6-ae56-8481d8a336da",work_slug:"alices-adventures-in-wonderland",
 snapshot_id:"11111111-1111-4111-8111-111111111111",snapshot_sha256:sha,source_bytes:raw,
 component_id:"22222222-2222-4222-8222-222222222222",component_kind:"WORK_CONTENT" as const,
 disposition:"qa_text_only" as const,byte_start:7,byte_end:raw.length-4};
test("DB-A bytes and UUID component yield exact, sealed semantic revision",()=>{
 const x=composeFromCapturedDbA(fixture);
 assert.equal(x.original_raw,text);
 assert.equal(x.revision.work_id,fixture.work_id);
 assert.equal(x.revision.source.component_id,fixture.component_id);
 assert.equal(x.revision.source.original_byte_start,7);
 assert.equal(x.revision.source.original_byte_end,raw.length-4);
 assert.equal(x.revision.release_allowed,false);
 assert.equal(x.revision.blocks.filter(b=>b.kind==="chapter").length,2);
});
test("tampered archived bytes, source scope and component fail closed",()=>{
 assert.throws(()=>composeFromCapturedDbA({...fixture,source_bytes:Buffer.from(raw.toString()+"!")}),/digest/);
 assert.throws(()=>composeFromCapturedDbA({...fixture,component_id:"pg11:work-text"}),/identity/);
 assert.throws(()=>composeFromCapturedDbA({...fixture,byte_end:raw.length+1}),/boundary/);
 assert.throws(()=>composeFromCapturedDbA({...fixture,disposition:"exclude" as "qa_text_only"}),/identity/);
 assert.throws(()=>composeFromCapturedDbA({...fixture,work_id:"fixture:alice"}),/identity/);
});
test("malformed UTF-8 is rejected rather than silently replaced",()=>{
 const bad=Buffer.from([0x43,0x48,0x41,0x50,0xff]);
 assert.throws(()=>composeFromCapturedDbA({...fixture,source_bytes:bad,snapshot_sha256:createHash("sha256").update(bad).digest("hex"),byte_start:0,byte_end:bad.length}),/encoded|encoding/i);
});
