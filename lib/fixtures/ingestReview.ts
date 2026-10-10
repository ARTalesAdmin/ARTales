import {
  inspectSourceIntegrity,
  type AnchoredBlock,
  type FixtureCapture,
} from "./ingestComposer";

/** Metadata-only fixture acceptance. Does not include the original literary text. */
export type FixtureReviewRecord = {
  schema: "artales.fixture.editorial-feedback.v1";
  sourceId: string;
  componentId: string;
  blockId: string;
  sourceSpan: { start: number; end: number };
  issue: "typography" | "structure" | "readability";
  editorNote: string;
  originalRecipe: string;
  revisedRecipe: string;
  originalLayout: string;
  revisedLayout: string;
  decision: "accepted";
  integrity: "verified";
  acceptedAt: string;
  fixtureOnly: true;
  deliveredToNexus: false;
};

/** Fail closed if anything beyond a single source-anchored layout variant changed. */
export function createFixtureReviewRecord(args: {
  capture: FixtureCapture;
  before: AnchoredBlock[];
  after: AnchoredBlock[];
  blockId: string;
  issue: FixtureReviewRecord["issue"];
  editorNote: string;
  acceptedAt: string;
}): FixtureReviewRecord {
  const { capture, before, after, blockId, issue, acceptedAt } = args;
  const editorNote = args.editorNote.trim();
  if (editorNote.length < 3 || editorNote.length > 1000) {
    throw new Error("Feedback requires a note between 3 and 1000 characters.");
  }
  if (!Number.isFinite(Date.parse(acceptedAt)) || new Date(acceptedAt).toISOString() !== acceptedAt) {
    throw new Error("Invalid acceptance timestamp.");
  }
  if (!inspectSourceIntegrity(capture, before).ok || !inspectSourceIntegrity(capture, after).ok) {
    throw new Error("Feedback refused: text integrity failed.");
  }
  if (before.length !== after.length) throw new Error("Feedback refused: block count changed.");
  let original: AnchoredBlock | undefined;
  let revised: AnchoredBlock | undefined;
  for (let index = 0; index < before.length; index++) {
    const oldBlock = before[index];
    const newBlock = after[index];
    if (oldBlock.block.id !== newBlock.block.id) throw new Error("Feedback refused: order changed.");
    if (oldBlock.block.id === blockId) {
      original = oldBlock;
      revised = newBlock;
      if (oldBlock.layoutVariant === newBlock.layoutVariant) {
        throw new Error("Feedback refused: no targeted layout change.");
      }
      if (JSON.stringify({ ...newBlock, layoutVariant: oldBlock.layoutVariant }) !== JSON.stringify(oldBlock)) {
        throw new Error("Feedback refused: non-layout change in target span.");
      }
    } else if (JSON.stringify(oldBlock) !== JSON.stringify(newBlock)) {
      throw new Error("Feedback refused: other span changed.");
    }
  }
  if (!original || !revised || !revised.layoutVariant) {
    throw new Error("Feedback refused: target span not found.");
  }
  return {
    schema: "artales.fixture.editorial-feedback.v1",
    sourceId: original.sourceId,
    componentId: original.componentId,
    blockId,
    sourceSpan: { start: original.start, end: original.end },
    issue,
    editorNote,
    originalRecipe: original.recipe,
    revisedRecipe: revised.recipe,
    originalLayout: original.layoutVariant ?? "default",
    revisedLayout: revised.layoutVariant,
    decision: "accepted",
    integrity: "verified",
    acceptedAt,
    fixtureOnly: true,
    deliveredToNexus: false,
  };
}
