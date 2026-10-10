import {
  inspectSourceIntegrity,
  type AnchoredBlock,
  type FixtureCapture,
} from "./ingestComposer";

/**
 * An annotation is anchored to source data, never to a rendered page number.
 * Fixture view context is diagnostic only: actual Reader pagination is not wired.
 */
export const FIXTURE_ISSUE_CATEGORIES = [
  "unsure",
  "pagination",
  "line_break",
  "typography",
  "structure",
  "readability",
  "other",
] as const;
export type FixtureIssueCategory = (typeof FIXTURE_ISSUE_CATEGORIES)[number];
export type FixtureIssueAnchor =
  | { kind: "block"; blockId: string }
  | { kind: "boundary_after"; blockId: string; nextBlockId: string };
export type FixtureViewContext = {
  renderer: "fixture-static-spread-v1";
  readerMode: "comparison" | "reader_only";
  fontScale: number;
  viewportWidth: number;
  viewportHeight: number;
};
export type FixtureIssueReport = {
  schema: "artales.fixture.editorial-issue.v1";
  sourceId: string;
  componentId: string;
  anchor: FixtureIssueAnchor;
  sourceSpan: { start: number; end: number };
  category: FixtureIssueCategory;
  editorNote: string;
  viewContext: FixtureViewContext;
  recordedAt: string;
  status: "recorded_locally";
  fixtureOnly: true;
  deliveredToNexus: false;
  correctionPerformed: false;
};

export function getFixtureCorrectionLane(
  category: FixtureIssueCategory,
  anchor: FixtureIssueAnchor,
): "local_recipe" | "needs_future_ai" {
  return anchor.kind === "block" && category === "typography"
    ? "local_recipe"
    : "needs_future_ai";
}

export function createFixtureIssueReport(args: {
  capture: FixtureCapture;
  blocks: AnchoredBlock[];
  anchor: FixtureIssueAnchor;
  category: FixtureIssueCategory;
  editorNote: string;
  viewContext: FixtureViewContext;
  recordedAt: string;
}): FixtureIssueReport {
  const { capture, blocks, anchor, category, viewContext, recordedAt } = args;
  const editorNote = args.editorNote.trim();

  if (!inspectSourceIntegrity(capture, blocks).ok) {
    throw new Error("Issue record refused: source integrity failed.");
  }
  if (!FIXTURE_ISSUE_CATEGORIES.includes(category)) {
    throw new Error("Issue record refused: unknown issue category.");
  }
  if (editorNote.length < 3 || editorNote.length > 1000) {
    throw new Error("Issue record requires a note between 3 and 1000 characters.");
  }
  if (!Number.isFinite(Date.parse(recordedAt)) || new Date(recordedAt).toISOString() !== recordedAt) {
    throw new Error("Issue record refused: invalid timestamp.");
  }
  if (viewContext.renderer !== "fixture-static-spread-v1" ||
      (viewContext.readerMode !== "comparison" && viewContext.readerMode !== "reader_only") ||
      !Number.isFinite(viewContext.fontScale) || viewContext.fontScale < 0.5 ||
      viewContext.fontScale > 2 ||
      !Number.isInteger(viewContext.viewportWidth) || viewContext.viewportWidth < 1 ||
      viewContext.viewportWidth > 20000 ||
      !Number.isInteger(viewContext.viewportHeight) || viewContext.viewportHeight < 1 ||
      viewContext.viewportHeight > 20000) {
    throw new Error("Issue record refused: invalid preview display context.");
  }

  const index = blocks.findIndex((item) => item.block.id === anchor.blockId);
  if (index < 0) {
    throw new Error("Issue record refused: source block not found.");
  }
  if (anchor.kind === "boundary_after" &&
      (index + 1 >= blocks.length || blocks[index + 1].block.id !== anchor.nextBlockId)) {
    throw new Error("Issue record refused: unstable boundary anchor.");
  }
  if (anchor.kind !== "block" && anchor.kind !== "boundary_after") {
    throw new Error("Issue record refused: unsupported anchor.");
  }

  const item = blocks[index];
  return {
    schema: "artales.fixture.editorial-issue.v1",
    sourceId: item.sourceId,
    componentId: item.componentId,
    anchor,
    sourceSpan: { start: item.start, end: item.end },
    category,
    editorNote,
    viewContext: { ...viewContext },
    recordedAt,
    status: "recorded_locally",
    fixtureOnly: true,
    deliveredToNexus: false,
    correctionPerformed: false,
  };
}
