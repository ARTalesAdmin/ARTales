import {
  composeFixtureSection,
  INGEST_FIXTURE,
  inspectSourceIntegrity,
} from "./ingestComposer";

/**
 * Isolated, invented-content editorial walkthrough.
 * Never used as rights evidence, a signed editorial task, or a release revision.
 */
export const FLOW_DEMO_KEY = "artales:editorial-flow-demo:v1";
export const FLOW_DEMO_TITLE = "Cesta za řekou";
export const FLOW_DEMO_AUTHOR = "Fiktivní autor · syntetický rukopis";
export const FLOW_DEMO_BASE = "/preview/editorial-flow";

export const FLOW_DEMO_COMPOSITION = composeFixtureSection(INGEST_FIXTURE);
if (!FLOW_DEMO_COMPOSITION.qa.ok || !inspectSourceIntegrity(
  INGEST_FIXTURE, FLOW_DEMO_COMPOSITION.blocks,
).ok) {
  throw new Error("The synthetic source must pass the exact-text integrity check.");
}

const chapter = FLOW_DEMO_COMPOSITION.blocks.find((item) => item.block.type === "chapter");
const prose = FLOW_DEMO_COMPOSITION.blocks.find((item) => item.block.type === "paragraph");
const poem = FLOW_DEMO_COMPOSITION.blocks.find((item) => item.block.type === "poem");
if (!chapter || !prose || !poem) {
  throw new Error("The demo fixture requires a chapter, prose, and poem.");
}

export type DemoDefectKey = "chapter" | "prose" | "poem";
export type DemoDefect = {
  key: DemoDefectKey;
  blockId: string;
  title: string;
  problem: string;
  example: string;
};
export const FLOW_DEMO_DEFECTS: readonly DemoDefect[] = [
  {
    key: "chapter",
    blockId: chapter.block.id,
    title: "Nadpis kapitoly",
    problem: "Nadpis se tváří jako obyčejný odstavec.",
    example: "Prosím obnovit nadpis a výraznější odstup od textu.",
  },
  {
    key: "prose",
    blockId: prose.block.id,
    title: "Sazba odstavce",
    problem: "Text má nevhodně velká písmena a příliš široké proklady.",
    example: "Tento odstavec má mít normální čitelnou sazbu.",
  },
  {
    key: "poem",
    blockId: poem.block.id,
    title: "Rozpadlé verše",
    problem: "Verše jsou chybně slité do jednoho odstavce.",
    example: "Vrátit zalomení jednotlivých veršů a oddělit báseň.",
  },
] as const;

export const FLOW_DEMO_RIGHTS = [
  { label: "Fiktivní původní text", result: "povolen jen v demonstraci" },
  { label: "Cizí překlad a ediční úvod", result: "vynechány" },
  { label: "Ilustrace", result: "nepřebírat bez samostatných práv" },
  { label: "Publikační oprávnění", result: "NEUDĚLENO" },
] as const;

export type DemoRepair = { note: string; appliedAt: string };
export type FlowDemoStatus = "new" | "queued" | "in_review" | "done";
export type FlowDemoSession = {
  schema: "artales.editorial-flow-demo.v1";
  status: FlowDemoStatus;
  createdAt?: string;
  completedAt?: string;
  repairs: Partial<Record<DemoDefectKey, DemoRepair>>;
};

export function freshFlowDemo(): FlowDemoSession {
  return { schema: "artales.editorial-flow-demo.v1", status: "new", repairs: {} };
}

function validRepair(value: unknown): value is DemoRepair {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DemoRepair>;
  return typeof item.note === "string" && item.note.trim().length >= 3 &&
    item.note.length <= 500 && typeof item.appliedAt === "string" &&
    item.appliedAt.length <= 64;
}

/** Strictly ignore malformed or stale browser-only state. */
export function readFlowDemo(raw: string | null): FlowDemoSession {
  if (!raw || raw.length > 10000) return freshFlowDemo();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return freshFlowDemo();
    const item = value as Partial<FlowDemoSession>;
    if (item.schema !== "artales.editorial-flow-demo.v1" ||
      typeof item.status !== "string" ||
      !["new", "queued", "in_review", "done"].includes(item.status) ||
      !item.repairs || typeof item.repairs !== "object" || Array.isArray(item.repairs)) {
      return freshFlowDemo();
    }
    const repairs: FlowDemoSession["repairs"] = {};
    for (const [key, repair] of Object.entries(item.repairs)) {
      if (!FLOW_DEMO_DEFECTS.some((defect) => defect.key === key) ||
        !validRepair(repair)) return freshFlowDemo();
      repairs[key as DemoDefectKey] = repair;
    }
    const numberFixed = Object.keys(repairs).length;
    if ((item.status === "new" || item.status === "queued") && numberFixed !== 0) return freshFlowDemo();
    if (item.status === "done" && numberFixed < 2) return freshFlowDemo();
    if (item.status !== "new" &&
      (typeof item.createdAt !== "string" || item.createdAt.length > 64)) return freshFlowDemo();
    if (item.status === "done" &&
      (typeof item.completedAt !== "string" || item.completedAt.length > 64)) return freshFlowDemo();
    return {
      schema: "artales.editorial-flow-demo.v1",
      status: item.status,
      repairs,
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

export function repairFlowDemo(
  previous: FlowDemoSession,
  key: DemoDefectKey,
  note: string,
  at: string,
): FlowDemoSession {
  if (previous.status !== "in_review" || !FLOW_DEMO_DEFECTS.some((item) => item.key === key)) {
    throw new Error("Ukázkový úkol není otevřen ke kontrole.");
  }
  const cleaned = note.trim();
  if (cleaned.length < 3 || cleaned.length > 500) {
    throw new Error("Napište poznámku v rozsahu 3 až 500 znaků.");
  }
  if (previous.repairs[key]) return previous;
  return {
    ...previous,
    repairs: { ...previous.repairs, [key]: { note: cleaned, appliedAt: at } },
  };
}

export function finishFlowDemo(previous: FlowDemoSession, at: string): FlowDemoSession {
  if (previous.status !== "in_review" || Object.keys(previous.repairs).length < 2) {
    throw new Error("Pro dokončení ukázky opravte alespoň dva bloky.");
  }
  return { ...previous, status: "done", completedAt: at };
}

export function flowDemoInboxCount(session: FlowDemoSession): number {
  return session.status === "queued" || session.status === "in_review" ? 1 : 0;
}
