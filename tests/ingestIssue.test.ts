import assert from "node:assert/strict";
import test from "node:test";
import { INGEST_FIXTURE, composeFixtureSection } from "../lib/fixtures/ingestComposer";
import {
  createFixtureIssueReport,
  getFixtureCorrectionLane,
  type FixtureViewContext,
} from "../lib/fixtures/ingestIssue";

const blocks = composeFixtureSection(INGEST_FIXTURE).blocks;
const context: FixtureViewContext = {
  renderer: "fixture-static-spread-v1",
  readerMode: "comparison",
  fontScale: 1.1,
  viewportWidth: 1366,
  viewportHeight: 768,
};
const blockAnchor = { kind: "block" as const, blockId: blocks[1].block.id };
const boundaryAnchor = {
  kind: "boundary_after" as const,
  blockId: blocks[1].block.id,
  nextBlockId: blocks[2].block.id,
};
function makeIssue(
  anchor: typeof blockAnchor | typeof boundaryAnchor = blockAnchor,
  category: "unsure" | "pagination" | "line_break" | "typography" = "unsure",
) {
  return createFixtureIssueReport({
    capture: INGEST_FIXTURE,
    blocks,
    anchor,
    category,
    editorNote: "Něco se tu láme nevhodně, nevím přesně co.",
    viewContext: context,
    recordedAt: "2026-10-10T08:38:00.000Z",
  });
}

test("unknown category is first-class, carries note and viewing context", () => {
  const record = makeIssue();
  assert.equal(record.category, "unsure");
  assert.equal(record.editorNote, "Něco se tu láme nevhodně, nevím přesně co.");
  assert.equal(record.sourceSpan.start, blocks[1].start);
  assert.equal(record.viewContext.fontScale, 1.1);
  assert.equal(record.viewContext.viewportWidth, 1366);
  assert.equal(record.status, "recorded_locally");
  assert.equal(record.deliveredToNexus, false);
  assert.equal(record.correctionPerformed, false);
  assert.ok(!JSON.stringify(record).includes(blocks[1].block.content));
});

test("page boundary is anchored between two stable blocks, not a page number", () => {
  const record = makeIssue(boundaryAnchor, "pagination");
  assert.deepEqual(record.anchor, boundaryAnchor);
  assert.equal(record.category, "pagination");
  assert.equal(getFixtureCorrectionLane(record.category, record.anchor), "needs_future_ai");
  assert.equal(getFixtureCorrectionLane("line_break", blockAnchor), "needs_future_ai");
  assert.equal(getFixtureCorrectionLane("typography", blockAnchor), "local_recipe");
});

test("annotation rejects stale boundary, missing source clearance and tampered text", () => {
  assert.throws(() => makeIssue({ ...boundaryAnchor, nextBlockId: blocks[4].block.id }));
  const unapproved = structuredClone(INGEST_FIXTURE);
  unapproved.components[0].rights = undefined;
  assert.throws(() => createFixtureIssueReport({
    capture: unapproved, blocks, anchor: blockAnchor, category: "unsure",
    editorNote: "Nesedí stránka.", viewContext: context,
    recordedAt: "2026-10-10T08:38:00.000Z",
  }));
  const changed = blocks.map((item) => ({ ...item, block: { ...item.block } }));
  changed[1].block.content += " přidaný text";
  assert.throws(() => createFixtureIssueReport({
    capture: INGEST_FIXTURE, blocks: changed, anchor: blockAnchor, category: "unsure",
    editorNote: "Nesedí stránka.", viewContext: context,
    recordedAt: "2026-10-10T08:38:00.000Z",
  }));
});

test("annotation refuses invalid category, note and display context", () => {
  const base = {
    capture: INGEST_FIXTURE, blocks, anchor: blockAnchor, category: "unsure" as const,
    editorNote: "Vadné zalomení.", viewContext: context,
    recordedAt: "2026-10-10T08:38:00.000Z",
  };
  assert.throws(() => createFixtureIssueReport({ ...base, editorNote: " " }));
  assert.throws(() => createFixtureIssueReport({ ...base, category: "not-a-category" as "unsure" }));
  assert.throws(() => createFixtureIssueReport({
    ...base, viewContext: { ...context, viewportWidth: 0 },
  }));
});
