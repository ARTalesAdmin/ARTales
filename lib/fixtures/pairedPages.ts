import type { AnchoredBlock } from "./ingestComposer";

/** Fixture-only page groups. Source pages are anchors, not printed page numbers. */
export type PairedPage = { page: number; blocks: AnchoredBlock[]; sourcePage: number };
export function createPairedFixturePages(blocks: AnchoredBlock[], sourceCapacity = 3000, composedCapacity = 500): {
  sourcePages: AnchoredBlock[][];
  composedPages: PairedPage[];
} {
  if (!Number.isFinite(sourceCapacity) || !Number.isFinite(composedCapacity) || sourceCapacity <= 0 || composedCapacity <= 0) {
    throw new Error("Invalid pagination capacities");
  }
  const sourcePages: AnchoredBlock[][] = [];
  const sourcePageById = new Map<string, number>();
  let sourceWeight = 0;
  for (const block of blocks) {
    if (sourceWeight > 0 && sourceWeight + block.block.content.length > sourceCapacity) {
      sourceWeight = 0;
    }
    if (sourceWeight === 0) sourcePages.push([]);
    sourcePages[sourcePages.length - 1].push(block);
    sourcePageById.set(block.block.id, sourcePages.length);
    sourceWeight += block.block.content.length;
  }
  const composedPages: PairedPage[] = [];
  let pageBlocks: AnchoredBlock[] = [];
  let composedWeight = 0;
  let sourcePage = 1;
  const flush = () => {
    if (pageBlocks.length) {
      composedPages.push({ page: composedPages.length + 1, sourcePage, blocks: pageBlocks });
      pageBlocks = [];
      composedWeight = 0;
    }
  };
  for (const block of blocks) {
    const nextSource = sourcePageById.get(block.block.id) ?? 1;
    const cost = block.block.content.length;
    if (pageBlocks.length && (nextSource !== sourcePage || composedWeight + cost > composedCapacity)) flush();
    sourcePage = nextSource;
    pageBlocks.push(block);
    composedWeight += cost;
  }
  flush();
  return { sourcePages, composedPages };
}
