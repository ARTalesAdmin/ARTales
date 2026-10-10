import assert from "node:assert/strict";
import test from "node:test";
import { INGEST_FIXTURE, composeFixtureSection } from "../lib/fixtures/ingestComposer";
import { createPairedFixturePages } from "../lib/fixtures/pairedPages";
const blocks = composeFixtureSection(INGEST_FIXTURE).blocks;

test("multiple ARTales pages keep the same original page until original text advances", () => {
  const pages = createPairedFixturePages(blocks, 3000, 360);
  assert.ok(pages.composedPages.length >= 3);
  assert.equal(pages.composedPages[0].page, 1);
  assert.equal(pages.composedPages[0].sourcePage, 1);
  assert.equal(pages.composedPages[1].sourcePage, 1);
  assert.deepEqual(pages.composedPages.flatMap((p) => p.blocks.map((b) => b.block.id)), blocks.map((b) => b.block.id));
});

test("paired page changes its original only after original page boundary", () => {
  const pages = createPairedFixturePages(blocks, 650, 200);
  assert.ok(pages.sourcePages.length > 1);
  for (const page of pages.composedPages) {
    const sourceBlocks = pages.sourcePages[page.sourcePage - 1];
    assert.ok(page.blocks.every((block) => sourceBlocks.some((source) => source.block.id === block.block.id)));
  }
  assert.throws(() => createPairedFixturePages(blocks, 0, 200));
});
