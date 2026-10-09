import assert from "node:assert/strict";
import test from "node:test";
import {
  INGEST_FIXTURE,
  composeFixtureSection,
  inspectSourceIntegrity,
  recomposeFixtureRegion,
} from "../lib/fixtures/ingestComposer";
import { createFixtureReviewRecord } from "../lib/fixtures/ingestReview";

const before = composeFixtureSection(INGEST_FIXTURE).blocks;
const verse = before.find((block) => block.block.type === "poem")!;
const paragraph = before.find((block) => block.block.type === "paragraph")!;
const chapter = before.find((block) => block.block.type === "chapter")!;
const acceptedAt = "2026-10-09T19:15:00.000Z";

function review(after = recomposeFixtureRegion(INGEST_FIXTURE, before, verse.block.id), note = "Verše jsou příliš sevřené.") {
  return createFixtureReviewRecord({
    capture: INGEST_FIXTURE,
    before, after, blockId: verse.block.id,
    issue: "typography", editorNote: note, acceptedAt,
  });
}

test("fixture can recompose precisely one poem, paragraph or chapter layout", () => {
  for (const [target, expected] of [[verse, "airy_verse"], [paragraph, "comfortable_prose"], [chapter, "open_chapter"]] as const) {
    const revised = recomposeFixtureRegion(INGEST_FIXTURE, before, target.block.id);
    assert.equal(inspectSourceIntegrity(INGEST_FIXTURE, revised).ok, true);
    for (let index = 0; index < before.length; index++) {
      assert.strictEqual(revised[index], before[index].block.id === target.block.id ? revised[index] : before[index]);
      assert.deepEqual(revised[index].block, before[index].block);
    }
    assert.equal(revised.find((item) => item.block.id === target.block.id)?.layoutVariant, expected);
    assert.deepEqual(recomposeFixtureRegion(INGEST_FIXTURE, revised, target.block.id), revised);
  }
});

test("accepted feedback is versioned, anchored and metadata-only", () => {
  const record = review();
  assert.equal(record.schema, "artales.fixture.editorial-feedback.v1");
  assert.equal(record.sourceId, INGEST_FIXTURE.sourceId);
  assert.equal(record.blockId, verse.block.id);
  assert.deepEqual(record.sourceSpan, { start: verse.start, end: verse.end });
  assert.equal(record.originalLayout, "default");
  assert.equal(record.revisedLayout, "airy_verse");
  assert.equal(record.editorNote, "Verše jsou příliš sevřené.");
  assert.equal(record.decision, "accepted");
  assert.equal(record.fixtureOnly, true);
  assert.equal(record.deliveredToNexus, false);
  const serialized = JSON.stringify(record);
  assert.ok(!serialized.includes(verse.block.content));
  assert.ok(!serialized.includes(INGEST_FIXTURE.components[0].raw));
});

test("feedback rejects missing note, lack of change, altered text, other span edits", () => {
  assert.throws(() => review(undefined, " "));
  assert.throws(() => review(before));
  const revised = recomposeFixtureRegion(INGEST_FIXTURE, before, verse.block.id);
  const changedText = revised.map((item) => ({ ...item, block: { ...item.block } }));
  changedText.find((item) => item.block.id === verse.block.id)!.block.content += " navíc";
  assert.throws(() => review(changedText));
  const anotherLayout = revised.map((item) => item.block.id === paragraph.block.id ? { ...item, layoutVariant: "comfortable_prose" as const } : item);
  assert.throws(() => review(anotherLayout));
  assert.throws(() => review([...revised].reverse()));
});

test("feedback refuses review of an unapproved source or missing source span", () => {
  const capture = structuredClone(INGEST_FIXTURE);
  capture.components[0].rights = undefined;
  const after = recomposeFixtureRegion(INGEST_FIXTURE, before, verse.block.id);
  assert.throws(() => createFixtureReviewRecord({ capture, before, after, blockId: verse.block.id, issue: "typography", editorNote: "Nevhodná sazba", acceptedAt }));
  assert.throws(() => recomposeFixtureRegion(INGEST_FIXTURE, before, "missing-block"));
});
