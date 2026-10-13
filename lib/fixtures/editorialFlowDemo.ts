/**
 * Browser-local redaction walkthrough. The underlying semantic Gutenberg
 * revision is never changed, signed, approved, or sent to a live queue.
 * v2 intentionally does not read any v1 session.
 */
export const FLOW_DEMO_KEY = "artales:editorial-flow-demo:v2";
export const FLOW_DEMO_TITLE = "Alice's Adventures in Wonderland";
export const FLOW_DEMO_AUTHOR = "Lewis Carroll";
export const FLOW_DEMO_BASE = "/preview/editorial-flow";

export type DemoBookBlock = {
  id: string;
  kind: "chapter" | "section" | "paragraph" | "poem" | "quote" | "epigraph" | "footnote";
  /** Normalized-but-exact Gutenberg source span; no edits allowed. */
  original: string;
  /** Reversible soft-wrap display projection for the ARTales pane. */
  display: string;
  gapBefore: string;
  start: number;
  end: number;
};
export type EditorialFlowBook = {
  title: string;
  author: string;
  sourceLabel: string;
  blocks: DemoBookBlock[];
  sourceTail: string;
  sourceLength: number;
  chapterOnly: true;
  releaseAllowed: false;
};
export type DemoDefectKey = "chapter" | "prose" | "spacing";
export type DemoDefect = { key: DemoDefectKey; blockId: string };

/** Fixed layout-only mistakes spread across the *whole* first chapter. No hints in UI. */
export function editorialFlowDefects(book: EditorialFlowBook): DemoDefect[] {
  const chapter = book.blocks.find((block) => block.kind === "chapter");
  const paragraphs = book.blocks.filter((block) => block.kind === "paragraph");
  if (!chapter || paragraphs.length < 8) {
    throw new Error("Pinned Alice fixture needs a complete first chapter.");
  }
  const early = paragraphs[3];
  const later = paragraphs[Math.max(7, Math.floor(paragraphs.length * 0.68))];
  if (!early || !later || early.id === later.id) {
    throw new Error("Cannot place distinct source-anchored demo defects.");
  }
  return [
    { key: "chapter", blockId: chapter.id },
    { key: "prose", blockId: early.id },
    { key: "spacing", blockId: later.id },
  ];
}

export const FLOW_DEMO_RIGHTS = [
  { label: "Text díla", value: "Předběžná kontrola zdroje" },
  { label: "Konkrétní edice", value: "Čeká na právní prověření" },
  { label: "Překlady a ilustrace", value: "Nezařazeny" },
  { label: "Publikace", value: "Pozastavena" },
] as const;

export type DemoNote = { text: string; recordedAt: string };
export type FlowDemoStatus = "new" | "queued" | "in_review" | "done";
export type FlowDemoSession = {
  schema: "artales.editorial-flow-demo.v2";
  status: FlowDemoStatus;
  createdAt?: string;
  completedAt?: string;
  repairs: Partial<Record<DemoDefectKey, DemoNote>>;
  observations: Record<string, DemoNote>;
};

export function freshFlowDemo(): FlowDemoSession {
  return { schema: "artales.editorial-flow-demo.v2", status: "new", repairs: {}, observations: {} };
}

function validNote(value: unknown): value is DemoNote {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const note = value as Partial<DemoNote>;
  return typeof note.text === "string" && note.text.trim().length >= 3 &&
    note.text.length <= 500 && typeof note.recordedAt === "string" &&
    note.recordedAt.length <= 64;
}

/** Fail closed on unknown, truncated, or malformed per-browser fixture state. */
export function readFlowDemo(raw: string | null): FlowDemoSession {
  if (!raw || raw.length > 22000) return freshFlowDemo();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return freshFlowDemo();
    const item = parsed as Partial<FlowDemoSession>;
    if (item.schema !== "artales.editorial-flow-demo.v2" ||
      typeof item.status !== "string" ||
      !["new", "queued", "in_review", "done"].includes(item.status) ||
      !item.repairs || typeof item.repairs !== "object" || Array.isArray(item.repairs) ||
      !item.observations || typeof item.observations !== "object" || Array.isArray(item.observations)) {
      return freshFlowDemo();
    }
    const repairs: FlowDemoSession["repairs"] = {};
    for (const [key, note] of Object.entries(item.repairs)) {
      if (!["chapter", "prose", "spacing"].includes(key) || !validNote(note)) return freshFlowDemo();
      repairs[key as DemoDefectKey] = note;
    }
    const entries = Object.entries(item.observations);
    if (entries.length > 25) return freshFlowDemo();
    const observations: Record<string, DemoNote> = {};
    for (const [id, note] of entries) {
      if (!id || id.length > 128 || !validNote(note)) return freshFlowDemo();
      observations[id] = note;
    }
    const changes = Object.keys(repairs).length + entries.length;
    if ((item.status === "new" || item.status === "queued") && changes !== 0) return freshFlowDemo();
    if (item.status === "done" && Object.keys(repairs).length < 1) return freshFlowDemo();
    if (item.status !== "new" &&
      (typeof item.createdAt !== "string" || item.createdAt.length > 64)) return freshFlowDemo();
    if (item.status === "done" &&
      (typeof item.completedAt !== "string" || item.completedAt.length > 64)) return freshFlowDemo();
    return {
      schema: "artales.editorial-flow-demo.v2",
      status: item.status,
      repairs,
      observations,
      createdAt: item.createdAt,
      completedAt: item.status === "done" ? item.completedAt : undefined,
    };
  } catch {
    return freshFlowDemo();
  }
}

export function queueFlowDemo(previous: FlowDemoSession, at: string): FlowDemoSession {
  if (previous.status !== "new") return previous;
  return { ...freshFlowDemo(), status: "queued", createdAt: at };
}
export function claimFlowDemo(previous: FlowDemoSession): FlowDemoSession {
  return previous.status === "queued" ? { ...previous, status: "in_review" } : previous;
}
function checkedNote(previous: FlowDemoSession, text: string): string {
  if (previous.status !== "in_review") throw new Error("Úkol není otevřen ke kontrole.");
  const cleaned = text.trim();
  if (cleaned.length < 3 || cleaned.length > 500) {
    throw new Error("Připomínka musí mít 3 až 500 znaků.");
  }
  return cleaned;
}
export function repairFlowDemo(
  previous: FlowDemoSession, key: DemoDefectKey, note: string, at: string,
): FlowDemoSession {
  const text = checkedNote(previous, note);
  if (!["chapter", "prose", "spacing"].includes(key)) throw new Error("Neznámý blok.");
  if (previous.repairs[key]) return previous;
  return {
    ...previous,
    repairs: { ...previous.repairs, [key]: { text, recordedAt: at } },
  };
}
export function noteFlowDemo(
  previous: FlowDemoSession, blockId: string, note: string, at: string,
): FlowDemoSession {
  const text = checkedNote(previous, note);
  if (!blockId || blockId.length > 128) throw new Error("Neplatná kotva připomínky.");
  if (!previous.observations[blockId] && Object.keys(previous.observations).length >= 25) {
    throw new Error("Příliš mnoho připomínek v ukázkové relaci.");
  }
  return {
    ...previous,
    observations: { ...previous.observations, [blockId]: { text, recordedAt: at } },
  };
}
export function finishFlowDemo(previous: FlowDemoSession, at: string): FlowDemoSession {
  if (previous.status !== "in_review" || Object.keys(previous.repairs).length < 1) {
    throw new Error("Před uložením kontroly je potřeba dokončit úpravu sazby.");
  }
  return { ...previous, status: "done", completedAt: at };
}
export function flowDemoInboxCount(session: FlowDemoSession): number {
  return session.status === "queued" || session.status === "in_review" ? 1 : 0;
}
