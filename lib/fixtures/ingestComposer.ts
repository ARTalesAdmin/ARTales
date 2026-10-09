import type { WorkBlock } from "@/lib/blocks";

export type CapturedKind = "WORK_CONTENT" | "EDITION_CONTENT" | "TRANSLATION" | "SOURCE_WRAPPER" | "EDITORIAL_ADDITION" | "ASSET";
export type RightsDecision = "usable" | "exclude" | "review_required" | "blocked";
export type CapturedComponent = {
  id: string; sourceId: string; kind: CapturedKind; label: string; raw: string;
  rights?: { decision: RightsDecision; jurisdiction: string; reason: string };
};
export type FixtureCapture = { sourceId: string; sourceLabel: string; title: string; author: string; components: CapturedComponent[] };
export type AnchoredBlock = {
  block: WorkBlock; sourceId: string; componentId: string; start: number; end: number;
  recipe: "chapter" | "prose" | "verse";
};
export type ExcludedComponent = { id: string; kind: CapturedKind; label: string; decision: RightsDecision | "missing"; reason: string };

const originalText = [
  "I. Cesta za řekou", "",
  "Za posledním domem se pěšina ztratila v kapradí. Hana se zastavila a naslouchala; od řeky přicházel zvuk, který připomínal pomalé obracení stránek.", "",
  "Na kameni ležel mokrý list. Vítr jej obrátil, ale pod ním nebylo nic než další kámen. Přesto se Hana usmála: právě tak začínaly všechny příběhy, kterým kdysi věřila.", "",
  "  Přes vodu jde tichý hlas,",
  "  noc ukrývá jej mezi nás,",
  "  a kdo se ráno vydá dál,",
  "  ten najde cestu, již si přál.", "",
  "Když zazněl poslední verš, řeka už byla vidět. Na protějším břehu stál někdo s lucernou a čekal, až Hana udělá první krok.",
].join("\n");

export const INGEST_FIXTURE: FixtureCapture = {
  sourceId: "fixture:river-chapter:v1",
  sourceLabel: "Fiktivní rukopis · testovací edice v1",
  title: "Cesta za řekou (ukázková kapitola)",
  author: "Fiktivní autorský text pro QA",
  components: [
    { id: "original-chapter", sourceId: "fixture:river-chapter:v1", kind: "WORK_CONTENT", label: "Původní literární text", raw: originalText,
      rights: { decision: "usable", jurisdiction: "fixture-only", reason: "Nově vytvořený fiktivní text; nejde o cizí edici." } },
    { id: "edition-intro", sourceId: "fixture:river-chapter:v1", kind: "EDITION_CONTENT", label: "Úvod konkrétního vydání", raw: "Úvod editora této ukázkové edice.",
      rights: { decision: "exclude", jurisdiction: "fixture-only", reason: "Není součástí původního literárního textu." } },
    { id: "translation", sourceId: "fixture:river-chapter:v1", kind: "TRANSLATION", label: "Cizí překlad",
      raw: "An unrelated translated passage that must not reach the book blocks.",
      rights: { decision: "blocked", jurisdiction: "fixture-only", reason: "Chybí samostatné povolení k překladu." } },
    { id: "wrapper", sourceId: "fixture:river-chapter:v1", kind: "SOURCE_WRAPPER", label: "Obal zdroje / licence",
      raw: "START OF SAMPLE EBOOK / publisher notes / license notice",
      rights: { decision: "exclude", jurisdiction: "fixture-only", reason: "Obal není knižní obsah." } },
    { id: "editor-note", sourceId: "fixture:river-chapter:v1", kind: "EDITORIAL_ADDITION", label: "Ediční poznámka",
      raw: "Redakční komentář doplněný pozdějším vydavatelem.",
      rights: { decision: "exclude", jurisdiction: "fixture-only", reason: "Oddělená ediční vrstva." } },
    { id: "illustration", sourceId: "fixture:river-chapter:v1", kind: "ASSET", label: "Ilustrace",
      raw: "fixture-illustration-placeholder.png",
      rights: { decision: "review_required", jurisdiction: "fixture-only", reason: "Práva ilustrátora nejsou posouzena." } },
  ],
};

function eligible(part: CapturedComponent, sourceId: string) {
  return part.sourceId === sourceId && part.kind === "WORK_CONTENT" &&
    part.rights?.decision === "usable" && Boolean(part.rights.reason.trim()) &&
    Boolean(part.rights.jurisdiction.trim());
}

function splitWithOffsets(raw: string) {
  const spans: { start: number; end: number; text: string }[] = [];
  let start = 0;
  for (const match of raw.matchAll(/\n{2,}/g)) {
    const end = match.index;
    if (end > start) spans.push({ start, end, text: raw.slice(start, end) });
    start = end + match[0].length;
  }
  if (start < raw.length) spans.push({ start, end: raw.length, text: raw.slice(start) });
  return spans;
}

export function inspectSourceIntegrity(capture: FixtureCapture, blocks: AnchoredBlock[]) {
  const issues: string[] = [];
  const ids = new Set<string>();
  let verifiedBlocks = 0;
  let sourceChars = 0;
  const allowed = capture.components.filter((part) => eligible(part, capture.sourceId));
  if (!allowed.length) issues.push("Žádný povolený původní text.");
  for (const part of allowed) {
    const sequence = blocks.filter((item) => item.componentId === part.id);
    if (!sequence.length) issues.push(part.id + ": chybějí bloky.");
    let cursor = 0;
    for (const item of sequence) {
      if (ids.has(item.block.id)) issues.push(item.block.id + ": duplicitní ID.");
      ids.add(item.block.id);
      const gap = part.raw.slice(cursor, item.start);
      if (item.start < cursor || item.end > part.raw.length || item.start >= item.end ||
          item.sourceId !== capture.sourceId || part.raw.slice(item.start, item.end) !== item.block.content ||
          (gap !== "" && !/^\n{2,}$/.test(gap))) {
        issues.push(item.block.id + ": změna, překryv nebo vynechání textu.");
      } else {
        verifiedBlocks++;
        sourceChars += item.block.content.length;
      }
      cursor = item.end;
    }
    const tail = part.raw.slice(cursor);
    if (tail !== "" && !/^\n{2,}$/.test(tail)) issues.push(part.id + ": nepokrytý konec.");
  }
  for (const item of blocks) {
    if (!allowed.some((part) => part.id === item.componentId)) issues.push(item.block.id + ": nepovolená komponenta.");
  }
  return { ok: issues.length === 0, issues, verifiedBlocks, sourceChars };
}

export function composeFixtureSection(capture: FixtureCapture) {
  const blocks: AnchoredBlock[] = [];
  const excluded: ExcludedComponent[] = [];
  for (const part of capture.components) {
    if (!eligible(part, capture.sourceId)) {
      excluded.push({ id: part.id, kind: part.kind, label: part.label,
        decision: part.rights?.decision ?? "missing",
        reason: part.sourceId !== capture.sourceId ? "Jiný zdroj." : part.rights?.reason || "Chybí právní posouzení." });
      continue;
    }
    if (part.raw.includes("\r")) throw new Error("Fixture source must be LF-normalized.");
    splitWithOffsets(part.raw).forEach(({ start, end, text }, index) => {
      const lines = text.split("\n");
      const type: WorkBlock["type"] = index === 0 && /^(?:[IVXLCDM]+\.\s+|Kapitola\s+\S)/iu.test(text)
        ? "chapter" : lines.length > 1 && lines.every((line) => /^[ \t]{2,}\S/u.test(line))
          ? "poem" : "paragraph";
      blocks.push({ sourceId: capture.sourceId, componentId: part.id, start, end,
        recipe: type === "chapter" ? "chapter" : type === "poem" ? "verse" : "prose",
        block: { id: part.id + ":" + start + "-" + end, type, content: text, editor_note: null } });
    });
  }
  return { blocks, excluded, qa: inspectSourceIntegrity(capture, blocks), releaseAllowed: false as const };
}
