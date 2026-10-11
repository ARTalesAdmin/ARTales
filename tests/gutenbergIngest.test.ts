import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  PG11_BYTES_SHA256, PG11_URI, captureGutenbergBytes, extractPg11Components,
  composePg11Pilot, createPg11IntegrationPayload, getPg11FixtureRequest, retrievePinnedPg11,
} from "../lib/ingest/gutenbergSnapshot";
import {
  createInitialRevision, returnIssue, applyReturnedIssue, acceptAfterReview,
} from "../lib/ingest/revisionReview";

const bytes = readFileSync("tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt");
const request = getPg11FixtureRequest();
const snapshot = captureGutenbergBytes(bytes, request);
const boundaries = extractPg11Components(snapshot);
const pilot = composePg11Pilot(snapshot);

test("full, pinned original CRLF bytes have an immutable SHA-256 snapshot", () => {
  assert.equal(bytes.length, 173595);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), PG11_BYTES_SHA256);
  assert.equal(snapshot.bytes_sha256, PG11_BYTES_SHA256);
  assert.equal(snapshot.snapshot_ref, "sha256:" + PG11_BYTES_SHA256);
  assert.equal(snapshot.raw_utf8.startsWith("\ufeff"), true);
  assert.equal(snapshot.source_uri, PG11_URI);
  assert.equal(captureGutenbergBytes(bytes, request).snapshot_ref, snapshot.snapshot_ref);
  assert.throws(() => captureGutenbergBytes(Buffer.concat([bytes, Buffer.from("!")]), request), /SHA-256/);
  assert.throws(() => captureGutenbergBytes(new Uint8Array(), request), /size/);
  assert.throws(() => captureGutenbergBytes(bytes, { ...request, rights_dossier_ref: "" }));
  assert.throws(() => captureGutenbergBytes(bytes, { ...request, source_uri: "https://gutenberg.org/ebooks/11" }));
});

test("wrapper and edition evidence are retained but excluded from twelve-chapter composition", () => {
  assert.equal(boundaries.status, "ready_for_fixture", boundaries.review_reasons.join("; "));
  const items = boundaries.content_components;
  assert.equal(items.find((x) => x.id === "pg11:work-text")?.disposition, "qa_text_only");
  assert.equal(items.filter((x) => x.kind === "SOURCE_WRAPPER").length, 2);
  assert.ok(items.some((x) => x.kind === "ASSET" && x.disposition === "exclude"));
  const whole = composePg11Pilot(snapshot, false);
  assert.equal(whole.qa.ok, true);
  assert.equal(whole.blocks.filter((x) => x.block.type === "chapter").length, 12);
  assert.ok(whole.blocks.length > 100);
  assert.equal(pilot.blocks[0].block.type, "chapter");
  assert.ok(pilot.blocks.some((x) => x.block.content.includes("Alice was beginning")));
  assert.ok(!whole.blocks.some((x) => /Project Gutenberg License|FULCRUM EDITION/i.test(x.block.content)));
  assert.equal(whole.releaseAllowed, false);
  assert.equal(createPg11IntegrationPayload(snapshot, boundaries).release_allowed, false);
});

test("every normalized block maps exactly to archived original UTF-8 byte/line offsets", () => {
  assert.equal(pilot.qa.ok, true);
  for (const item of pilot.blocks) {
    const raw = bytes.subarray(item.original.byte_start, item.original.byte_end).toString("utf8");
    assert.equal(raw.replace(/\r\n/g, "\n"), item.block.content);
    assert.equal(item.original.bytes_sha256, PG11_BYTES_SHA256);
    assert.equal(item.original.snapshot_ref, snapshot.snapshot_ref);
    assert.ok(item.original.first_line > 20);
    assert.ok(item.original.last_line >= item.original.first_line);
  }
});

test("ambiguous boundary, textual insertion, foreign translation and image markers fail closed", () => {
  const synthetic = (raw: string) => {
    const data = Buffer.from(raw);
    return captureGutenbergBytes(data, {
      ...request, source_uri: "fixture:altered-pg11",
      retrieval_method: "synthetic_fixture_bytes",
      expected_bytes_sha256: createHash("sha256").update(data).digest("hex"),
    });
  };
  const duplicate = synthetic(snapshot.raw_utf8.replace(
    "*** END OF THIS PROJECT GUTENBERG EBOOK",
    "*** START OF THIS PROJECT GUTENBERG EBOOK SOME OTHER EDITION ***\r\n*** END OF THIS PROJECT GUTENBERG EBOOK",
  ));
  assert.equal(extractPg11Components(duplicate).status, "needs_boundary_review");
  assert.throws(() => composePg11Pilot(duplicate));
  const translation = synthetic(snapshot.raw_utf8.replace(
    "CHAPTER II. The Pool of Tears",
    "[Translation: later unreviewed French edition]\r\nCHAPTER II. The Pool of Tears",
  ));
  assert.match(extractPg11Components(translation).review_reasons.join(" "), /translation/i);
  const image = synthetic(snapshot.raw_utf8.replace(
    "CHAPTER II. The Pool of Tears",
    "[Illustration: unlicensed cover]\r\nCHAPTER II. The Pool of Tears",
  ));
  assert.equal(extractPg11Components(image).status, "needs_boundary_review");
  assert.equal(extractPg11Components(synthetic(" ")).status, "needs_boundary_review");
  const tampered = { ...snapshot, raw_utf8: snapshot.raw_utf8 + "X" };
  assert.equal(extractPg11Components(tampered).status, "needs_boundary_review");
});

test("bounded network retrieval only accepts a pinned, hash-verified mirrored blob", async () => {
  const mock = async () => new Response(bytes, {
    status: 200, headers: { "content-length": String(bytes.length), "content-type": "text/plain" },
  });
  const captured = await retrievePinnedPg11(request, mock as typeof fetch);
  assert.equal(captured.bytes_sha256, PG11_BYTES_SHA256);
  await assert.rejects(retrievePinnedPg11(request, async () => new Response("wrong") as Response));
  await assert.rejects(retrievePinnedPg11(request, async () => Response.redirect("https://example.org") as Response));
  await assert.rejects(retrievePinnedPg11(request, async () =>
    new Response("x", { headers: { "content-length": "99999999" } }) as Response));
  await assert.rejects(retrievePinnedPg11({ ...request, source_uri: "https://example.org/" }, mock as typeof fetch));
});

test("two independent reviewer returns bind exact ancestry and change only their target", () => {
  const first = createInitialRevision(pilot);
  const targets = pilot.blocks.filter((b) => b.block.type === "paragraph").slice(0, 2);
  assert.equal(targets.length, 2);
  const issue1 = returnIssue(pilot, first, {
    issue_id: "review_1", block_id: targets[0].block.id, category: "typography",
    reason: "Improve paragraph breathing room.",
  });
  const second = applyReturnedIssue(pilot, first, issue1);
  const acceptance1 = acceptAfterReview(pilot, first, second, issue1);
  assert.equal(acceptance1.release_allowed, false);
  assert.equal(second.parent_revision_ref, first.work_revision_ref);
  assert.deepEqual(first.blocks, createInitialRevision(pilot).blocks);
  assert.throws(() => returnIssue(pilot, second, {
    issue_id: "review_2", block_id: targets[1].block.id, category: "typography",
    reason: "Second independent reviewer return.",
  }), /clean revision/);
  const thirdInput = { ...second, issues: [] as typeof second.issues };
  // A new clean submission (separate verification event) cannot be forged by dropping issue packets:
  assert.throws(() => returnIssue(pilot, thirdInput, {
    issue_id: "review_2", block_id: targets[1].block.id, category: "typography",
    reason: "Second independent reviewer return.",
  }), /Tampered/);
  assert.throws(() => applyReturnedIssue(pilot, second, issue1), /Stale/);
  assert.throws(() => applyReturnedIssue(pilot, first, { ...issue1, source_anchor: { ...issue1.source_anchor, original_byte_end: 0 } }), /Stale/);
  assert.ok(second.blocks.every((block, idx) =>
    block.block.id === targets[0].block.id || JSON.stringify(block) === JSON.stringify(first.blocks[idx])));
  assert.notEqual(first.work_revision_ref, second.work_revision_ref);
});
