import assert from "node:assert/strict";
import test from "node:test";
import {
  INGEST_FIXTURE,
  composeFixtureSection,
  inspectSourceIntegrity,
} from "../lib/fixtures/ingestComposer";

const result = composeFixtureSection(INGEST_FIXTURE);

test("bounded literary section becomes deterministic ARTales blocks", () => {
  assert.deepEqual(result.blocks.map((item) => item.block.type), [
    "chapter", "paragraph", "paragraph", "poem", "paragraph",
  ]);
  assert.deepEqual(composeFixtureSection(INGEST_FIXTURE), result);
  assert.equal(new Set(result.blocks.map((item) => item.block.id)).size, result.blocks.length);
});

test("all literary block text and verse line breaks match anchored source", () => {
  const source = INGEST_FIXTURE.components[0];
  assert.ok(result.qa.ok);
  assert.equal(result.qa.verifiedBlocks, result.blocks.length);
  for (const item of result.blocks) {
    assert.equal(item.sourceId, INGEST_FIXTURE.sourceId);
    assert.equal(item.block.content, source.raw.slice(item.start, item.end));
  }
  const poem = result.blocks.find((item) => item.block.type === "poem");
  assert.ok(poem);
  assert.equal(poem.block.content.split("\n").length, 4);
  assert.match(poem.block.content, /^  Přes vodu/u);
});

test("wrapper, translation, editorial text and illustration never enter book blocks", () => {
  assert.equal(result.excluded.length, INGEST_FIXTURE.components.length - 1);
  const allText = result.blocks.map((item) => item.block.content).join("\n");
  for (const excluded of INGEST_FIXTURE.components.slice(1)) {
    assert.ok(!allText.includes(excluded.raw));
    assert.ok(result.excluded.some((item) => item.id === excluded.id));
  }
  assert.equal(result.releaseAllowed, false);
});

test("missing permission and wrong source both fail closed", () => {
  const missingRights = structuredClone(INGEST_FIXTURE);
  missingRights.components[0].rights = undefined;
  assert.equal(composeFixtureSection(missingRights).blocks.length, 0);
  assert.equal(composeFixtureSection(missingRights).qa.ok, false);
  const wrongSource = structuredClone(INGEST_FIXTURE);
  wrongSource.components[0].sourceId = "different-edition";
  assert.equal(composeFixtureSection(wrongSource).blocks.length, 0);
});

test("reordering, tampering and missing spans fail QA", () => {
  const corrupted = result.blocks.map((item) => ({ ...item, block: { ...item.block } }));
  corrupted[1].block.content += " přidaná věta";
  assert.equal(inspectSourceIntegrity(INGEST_FIXTURE, corrupted).ok, false);
  assert.equal(inspectSourceIntegrity(INGEST_FIXTURE, result.blocks.slice(1)).ok, false);
  assert.equal(inspectSourceIntegrity(INGEST_FIXTURE, [...result.blocks, result.blocks[0]]).ok, false);
});
