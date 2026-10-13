import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { captureGutenbergBytes, getPg11FixtureRequest } from "@/lib/ingest/gutenbergSnapshot";
import { composeSemanticPg11 } from "@/lib/semantic/compose";
import { projectSemanticProseText } from "@/lib/semantic/displayText";
import { getSemanticPageUnits } from "@/lib/semantic/readerProjection";
import type { EditorialFlowBook, DemoBookBlock } from "@/lib/fixtures/editorialFlowDemo";

/** Read only the pinned complete chapter I. Original normalized bytes remain immutable. */
export function getEditorialFlowBook(): EditorialFlowBook {
  const bytes = readFileSync(join(process.cwd(), "tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt"));
  const snapshot = captureGutenbergBytes(bytes, getPg11FixtureRequest());
  const { revision } = composeSemanticPg11(snapshot, {
    work_id: "fixture:alice:editorial", work_slug: "alices-adventures-in-wonderland",
  });
  if (revision.release_allowed !== false || revision.state !== "draft_qa_only") {
    throw new Error("Alice editorial fixture must remain QA-only.");
  }
  const text = revision.source.normalized_text;
  let cursor = 0;
  const blocks: DemoBookBlock[] = [];
  for (const unit of getSemanticPageUnits(revision)) {
    const node = unit.node;
    if (unit.kind === "title_page") continue;
    const atom = unit.kind === "chapter_heading" || unit.kind === "section_heading"
      ? "heading" in node ? node.heading : null
      : "atom" in node ? node.atom : null;
    if (!atom) continue;
    const start = atom.anchor.normalized_start, end = atom.anchor.normalized_end;
    if (start < cursor || end <= start || end > text.length || atom.raw !== text.slice(start, end)) {
      throw new Error("Alice source anchor mismatch.");
    }
    const kind = unit.kind === "chapter_heading" ? "chapter" : unit.kind === "section_heading" ? "section" : unit.kind;
    blocks.push({
      id: unit.id, kind, original: atom.raw,
      display: kind === "paragraph" ? projectSemanticProseText(atom.raw) : atom.raw,
      gapBefore: text.slice(cursor, start), start, end,
    });
    cursor = end;
  }
  const tail = text.slice(cursor);
  if (!blocks.length || blocks.map(b => b.gapBefore + b.original).join("") + tail !== text) {
    throw new Error("Original Alice chapter coverage mismatch.");
  }
  return {
    title: "Alice's Adventures in Wonderland", author: "Lewis Carroll",
    sourceLabel: "Project Gutenberg #11 · původní anglický text",
    blocks, sourceTail: tail, sourceLength: text.length,
    chapterOnly: true, releaseAllowed: false,
  };
}
