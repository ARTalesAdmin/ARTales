import test from "node:test";
import assert from "node:assert/strict";
import {
  FLOW_DEMO_COMPOSITION, FLOW_DEMO_DEFECTS, FLOW_DEMO_KEY,
  claimFlowDemo, finishFlowDemo, flowDemoInboxCount, freshFlowDemo,
  queueFlowDemo, readFlowDemo, repairFlowDemo,
} from "../lib/fixtures/editorialFlowDemo";
import { INGEST_FIXTURE, inspectSourceIntegrity } from "../lib/fixtures/ingestComposer";

const at = "2026-10-13T08:00:00.000Z";

test("fixture has three structurally anchored and distinct defects, original remains exact", () => {
  assert.equal(FLOW_DEMO_DEFECTS.length, 3);
  assert.equal(new Set(FLOW_DEMO_DEFECTS.map((d) => d.blockId)).size, 3);
  assert.equal(FLOW_DEMO_COMPOSITION.qa.ok, true);
  assert.equal(inspectSourceIntegrity(INGEST_FIXTURE, FLOW_DEMO_COMPOSITION.blocks).ok, true);
  for (const defect of FLOW_DEMO_DEFECTS)
    assert.ok(FLOW_DEMO_COMPOSITION.blocks.some((block) => block.block.id === defect.blockId));
});

test("candidate -> badge 1 -> inbox -> two repairs -> complete -> badge 0", () => {
  const fresh = freshFlowDemo();
  assert.equal(flowDemoInboxCount(fresh), 0);
  const queued = queueFlowDemo(fresh, at);
  assert.equal(queued.status, "queued");
  assert.equal(flowDemoInboxCount(queued), 1);
  assert.equal(queueFlowDemo(queued, at), queued);
  const claimed = claimFlowDemo(queued);
  assert.equal(claimed.status, "in_review");
  assert.equal(flowDemoInboxCount(claimed), 1);
  const repaired1 = repairFlowDemo(claimed, "chapter", "Opravit nadpis", at);
  const repaired2 = repairFlowDemo(repaired1, "poem", "Rozdělit verše", at);
  assert.equal(repaired2.repairs.chapter?.note, "Opravit nadpis");
  assert.equal(repaired2.repairs.poem?.note, "Rozdělit verše");
  assert.equal(repaired2.status, "in_review");
  const done = finishFlowDemo(repaired2, at);
  assert.equal(done.status, "done");
  assert.equal(flowDemoInboxCount(done), 0);
  assert.equal(readFlowDemo(JSON.stringify(done)).status, "done");
  assert.equal(FLOW_DEMO_KEY.startsWith("artales:editorial-flow-demo:"), true);
});

test("no skip, impossible complete, invalid note, unknown block and corrupted state fail closed", () => {
  assert.throws(() => repairFlowDemo(freshFlowDemo(), "chapter", "Nadpis", at));
  const claimed = claimFlowDemo(queueFlowDemo(freshFlowDemo(), at));
  assert.throws(() => finishFlowDemo(claimed, at));
  assert.throws(() => repairFlowDemo(claimed, "chapter", "a", at));
  assert.throws(() => repairFlowDemo(claimed, "alien" as "chapter", "Test", at));
  assert.equal(readFlowDemo("{oops").status, "new");
  assert.equal(readFlowDemo(JSON.stringify({ ...claimed, status: "done" })).status, "new");
  assert.equal(readFlowDemo(JSON.stringify({ ...claimed, repairs: { alien: {note:"test", appliedAt:at} } })).status, "new");
  assert.equal(readFlowDemo(JSON.stringify({ ...claimed, createdAt:undefined })).status, "new");
});
