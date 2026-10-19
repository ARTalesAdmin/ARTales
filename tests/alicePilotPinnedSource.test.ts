import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {captureGutenbergBytes,extractPg11Components,getPg11FixtureRequest,
  PG11_BYTES_SHA256} from "../lib/ingest/gutenbergSnapshot";
import {composeFromCapturedDbA} from "../lib/semantic/dbAComponentBridge";
import {serializeSignedDraft} from "../lib/semantic/selfPilotDraft";

/** Real pinned 2016 Gutenberg/GITenberg bytes, NOT synthetic Alice-shaped text.
 * No network, database access, legal approval, or public Reader mutation. */
test("complete 12-chapter pinned Alice fits the signed private editor envelope", () => {
  const bytes=readFileSync("tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt");
  const snapshot=captureGutenbergBytes(bytes,getPg11FixtureRequest());
  assert.equal(bytes.length,173595);
  assert.equal(snapshot.bytes_sha256,PG11_BYTES_SHA256);
  const boundaries=extractPg11Components(snapshot);
  assert.equal(boundaries.status,"ready_for_fixture",boundaries.review_reasons.join("; "));
  const work=boundaries.content_components.filter(x=>x.kind==="WORK_CONTENT"&&x.disposition==="qa_text_only");
  assert.equal(work.length,1,"Only one twelve-chapter work component may reach editor QA");
  const span=work[0].original;
  assert.ok(span&&span.byte_end<=bytes.length);
  const {revision}=composeFromCapturedDbA({
    work_id:"11111111-1111-4111-8111-111111111111",
    work_slug:"alices-adventures-in-wonderland",
    snapshot_id:"22222222-2222-4222-8222-222222222222",
    snapshot_sha256:PG11_BYTES_SHA256,
    source_bytes:bytes,
    component_id:"33333333-3333-4333-8333-333333333333",
    component_kind:"WORK_CONTENT",
    disposition:"qa_text_only",
    byte_start:span.byte_start,
    byte_end:span.byte_end
  });
  const payload=serializeSignedDraft(revision);
  assert.ok(Buffer.byteLength(payload.serialized,"utf8")<=1_500_000);
  assert.equal(revision.release_allowed,false);
  assert.ok(revision.blocks.length>=12);
  assert.ok(revision.source.normalized_text.includes("CHAPTER XII."));
  assert.ok(!revision.source.normalized_text.includes("Project Gutenberg License"));
  console.log("PINNED_ALICE: snapshotSha256="+PG11_BYTES_SHA256+" sourceBytes="+bytes.length+
    " workSpan="+span.byte_start+":"+span.byte_end+
    " serializedBytes="+Buffer.byteLength(payload.serialized,"utf8")+
    " semanticBlocks="+revision.blocks.length+
    " publicationAllowed=false");
});
