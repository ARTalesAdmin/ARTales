import type { WorkBlock, WorkBlockType } from "@/lib/blocks";

export type ParserConfidence = "vysoká" | "střední" | "nízká";

export type ParsedWorkBlocksResult = {
  blocks: WorkBlock[];
  stats: {
    totalBlocks: number;
    bookParts: number;
    chapters: number;
    headlines: number;
    paragraphs: number;
    quotes: number;
    poems: number;
    letters: number;
    newspaperArticles: number;
    placeLines: number;
    separators: number;
    notes: number;
    footnotes: number;
    dedications: number;
    prefaces: number;
    afterwords: number;
    acknowledgements: number;
    images: number;
  };
};

type Detection = {
  type: WorkBlockType;
  content: string;
  note?: string;
  fields?: Record<string, string | null>;
};

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `parsed-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createBlock(type: WorkBlockType, content: string, editorNote?: string, fields?: Record<string, string | null>): WorkBlock {
  const normalizedContent = type === "separator" ? "* * *" : content.trim();

  if (type === "letter") {
    return {
      id: createId(),
      type,
      content: normalizedContent,
      editor_note: editorNote ?? null,
      fields: {
        place_year: fields?.place_year ?? "",
        body: fields?.body ?? normalizedContent,
        date_signature: fields?.date_signature ?? "",
      },
    };
  }

  if (type === "image") {
    return {
      id: createId(),
      type,
      content: normalizedContent,
      editor_note: editorNote ?? null,
      fields: {
        image_request: fields?.image_request ?? normalizedContent,
        storage_path: fields?.storage_path ?? "",
        alt: fields?.alt ?? "",
        caption: fields?.caption ?? "",
        alignment: fields?.alignment ?? "center",
        size: fields?.size ?? "normal",
      },
    };
  }

  return {
    id: createId(),
    type,
    content: normalizedContent,
    editor_note: editorNote ?? null,
    fields,
  };
}

function note(confidence: ParserConfidence, reason: string) {
  return `Parser: ${confidence} jistota · ${reason}`;
}

function normalizeRawText(rawText: string) {
  return rawText
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

function splitIntoParagraphCandidates(text: string) {
  return text
    .split(/\n{2,}/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function compactInlineText(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function getNonEmptyLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function stripBlockLabel(text: string) {
  return text
    .replace(/^(věnování|venovani|dedication)\s*[:—-]?\s*/i, "")
    .replace(/^(předmluva|predmluva|preface)\s*[:—-]?\s*/i, "")
    .replace(/^(doslov|afterword|epilog|epilogue)\s*[:—-]?\s*/i, "")
    .replace(/^(poděkování|podekovani|acknowledgement|acknowledgment|thanks)\s*[:—-]?\s*/i, "")
    .trim();
}

function isSeparator(lines: string[]) {
  if (lines.length !== 1) return false;
  return /^(\*\s*){3,}$/.test(lines[0]) || /^[-—–]{3,}$/.test(lines[0]) || /^§{1,3}$/.test(lines[0]);
}

function detectImage(lines: string[]): Detection | null {
  const text = compactInlineText(lines.join("\n"));
  const match = text.match(/^\[(obrázek|obrazek|image|illustration|ilustrace)\s*:\s*(.+)\]$/i);
  if (!match) return null;

  return {
    type: "image",
    content: match[2].trim(),
    fields: {
      image_request: match[2].trim(),
      caption: "",
    },
    note: note("střední", "rozpoznáno podle značky [obrázek: ...]"),
  };
}

function detectFrontBackMatter(lines: string[]): Detection | null {
  if (lines.length > 8) return null;

  const text = compactInlineText(lines.join("\n"));
  const normalized = text.toLowerCase();

  const make = (type: WorkBlockType, reason: string, strip = true): Detection => ({
    type,
    content: strip ? stripBlockLabel(lines.join("\n")).trim() || text : text,
    note: note("vysoká", reason),
  });

  if (/^(věnování|venovani|dedication)\b/i.test(text)) {
    return make("dedication", "rozpoznáno podle nadpisu věnování");
  }

  if (/^(předmluva|predmluva|preface)\b/i.test(text)) {
    return make("preface", "rozpoznáno podle nadpisu předmluva");
  }

  if (/^(doslov|afterword|epilog|epilogue)\b/i.test(text)) {
    return make("afterword", "rozpoznáno podle nadpisu doslov / epilog");
  }

  if (/^(poděkování|podekovani|acknowledgement|acknowledgment|thanks)\b/i.test(text)) {
    return make("acknowledgement", "rozpoznáno podle nadpisu poděkování");
  }

  if (["věnování", "venovani", "dedication"].includes(normalized)) {
    return { type: "dedication", content: text, note: note("vysoká", "samostatný nadpis věnování") };
  }

  if (["předmluva", "predmluva", "preface"].includes(normalized)) {
    return { type: "preface", content: text, note: note("vysoká", "samostatný nadpis předmluva") };
  }

  if (["doslov", "afterword", "epilog", "epilogue"].includes(normalized)) {
    return { type: "afterword", content: text, note: note("vysoká", "samostatný nadpis doslov / epilog") };
  }

  if (["poděkování", "podekovani", "acknowledgement", "acknowledgment"].includes(normalized)) {
    return { type: "acknowledgement", content: text, note: note("vysoká", "samostatný nadpis poděkování") };
  }

  return null;
}

function detectBookPart(lines: string[]): Detection | null {
  if (lines.length > 2) return null;
  const text = compactInlineText(lines.join("\n"));

  if (/^(část|cast|part|book|kniha)\b/i.test(text) && text.length <= 100) {
    return { type: "book_part", content: text, note: note("vysoká", "rozpoznáno jako část knihy") };
  }

  return null;
}

function detectChapter(lines: string[], index: number): Detection | null {
  if (lines.length > 2) return null;

  const text = compactInlineText(lines.join("\n"));
  if (!text || text.length > 140) return null;

  if (/^(kapitola|chapter)\s+([0-9ivxlcdm]+|[a-zá-ž]+)\b/i.test(text)) {
    return { type: "chapter", content: text, note: note("vysoká", "rozpoznáno podle nadpisu kapitoly") };
  }

  if (/^(prolog|prologue|úvod|uvod|introduction)$/i.test(text)) {
    return { type: "chapter", content: text, note: note("vysoká", "rozpoznáno jako úvodní kapitola / prolog") };
  }

  if (/^[IVXLCDM]{1,8}\.?$/i.test(text) || /^\d{1,3}\.?$/.test(text)) {
    return { type: "chapter", content: text, note: note("střední", "samostatné číslo / římská číslice může být kapitola") };
  }

  if (/^\d{1,3}[.)]\s+\S+/.test(text)) {
    return { type: "chapter", content: text, note: note("střední", "číslovaný krátký nadpis") };
  }

  const looksLikeOpeningTitle =
    index === 0 &&
    text.length <= 80 &&
    !/[.!?…]$/.test(text) &&
    text.split(/\s+/).length <= 10;

  if (looksLikeOpeningTitle) {
    return { type: "headline", content: text, note: note("nízká", "první krátký neukončený řádek může být titulek") };
  }

  return null;
}

function detectHeadline(lines: string[]): Detection | null {
  if (lines.length !== 1) return null;
  const text = lines[0];
  if (text.length < 3 || text.length > 90) return null;
  if (/[.!?…]$/.test(text)) return null;
  if (text.split(/\s+/).length > 12) return null;

  if (/^(poznámka|poznamka|note|zpráva|zprava|report|oznámení|oznameni)\b/i.test(text)) {
    return null;
  }

  const mostlyUppercase = text.length > 5 && text === text.toLocaleUpperCase("cs-CZ");
  if (mostlyUppercase || /^[-–—]?[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(text)) {
    return { type: "headline", content: text, note: note("nízká", "krátký samostatný řádek bez tečky může být titulek") };
  }

  return null;
}

function detectPlaceLine(lines: string[]): Detection | null {
  if (lines.length !== 1) return null;
  const text = lines[0];

  const hasYearOrDate = /\b(1[5-9]\d{2}|20\d{2})\b/.test(text) || /\b\d{1,2}\.\s*\d{1,2}\.\s*\d{2,4}\b/.test(text);
  const looksLikePlace = /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][^.!?]{1,70},\s*[^!?]{2,60}\.?$/.test(text);

  if (text.length <= 110 && (hasYearOrDate || looksLikePlace) && !/[!?]$/.test(text)) {
    return { type: "place_line", content: text, note: note("střední", "krátký řádek vypadá jako místo / datace") };
  }

  return null;
}

function detectFootnote(lines: string[]): Detection | null {
  const text = compactInlineText(lines.join("\n"));
  if (/^(\[\d+\]|\d+\)|\d+\.|\*)\s+\S+/.test(text) && text.length <= 900) {
    return { type: "footnote", content: text, note: note("střední", "rozpoznáno podle značení poznámky pod čarou") };
  }

  return null;
}

function detectNote(lines: string[]): Detection | null {
  const text = compactInlineText(lines.join("\n"));
  if (/^(poznámka|poznamka|note|pozn\.?)\s*[:—-]\s+\S+/i.test(text)) {
    return { type: "note", content: text.replace(/^(poznámka|poznamka|note|pozn\.?)\s*[:—-]\s*/i, "").trim(), note: note("vysoká", "rozpoznáno podle značky poznámka") };
  }

  if (/^\((poznámka|poznamka|note)\s*[:—-].+\)$/i.test(text)) {
    return { type: "note", content: text.replace(/^\(|\)$/g, ""), note: note("střední", "text vypadá jako vložená poznámka") };
  }

  return null;
}

function detectQuote(lines: string[]): Detection | null {
  const text = compactInlineText(lines.join("\n"));
  if (text.length > 700) return null;

  if (/^([„“"'‚‘’»«]|—\s*)/.test(text) && /([“"'‘’»«]|[.!?…])$/.test(text)) {
    return { type: "quote", content: text, note: note("střední", "text začíná jako citace / motto") };
  }

  if (lines.length > 1 && lines.every((line) => /^>\s*/.test(line))) {
    return { type: "quote", content: lines.map((line) => line.replace(/^>\s*/, "")).join("\n"), note: note("vysoká", "rozpoznáno podle markdown značky citace") };
  }

  return null;
}

function detectPoem(lines: string[]): Detection | null {
  if (lines.length < 3 || lines.length > 60) return null;

  const averageLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
  const shortLines = lines.filter((line) => line.length <= 72).length;
  const terminalPunctuation = lines.filter((line) => /[.!?…]$/.test(line)).length;
  const commaEnding = lines.filter((line) => /[,;:]$/.test(line)).length;

  const likelyPoem = averageLength <= 60 && shortLines / lines.length >= 0.82 && terminalPunctuation / lines.length < 0.78;
  const stanzaLike = lines.length >= 4 && averageLength <= 52 && commaEnding >= 1;

  if (likelyPoem || stanzaLike) {
    return { type: "poem", content: lines.join("\n"), note: note("střední", "krátké víceřádkové členění vypadá jako veršovaný text") };
  }

  return null;
}

function detectLetter(lines: string[]): Detection | null {
  if (lines.length < 2 || lines.length > 80) return null;

  const first = lines[0];
  const second = lines[1] ?? "";
  const last = lines[lines.length - 1] ?? "";
  const startsWithPlace = Boolean(detectPlaceLine([first]));
  const hasGreeting = /^(mil[ýáe]|drah[ýáe]|vážen[ýáe]|ctěn[ýáe]|dear|my dear)\b/i.test(startsWithPlace ? second : first);
  const hasSignature = /^(s úctou|s pozdravem|tvůj|tvoje|váš|vaše|yours|sincerely|faithfully)\b/i.test(last) || /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-zá-ž]+\.?$/.test(last);

  if (hasGreeting || (startsWithPlace && lines.length >= 4 && hasSignature)) {
    const placeYear = startsWithPlace ? first : "";
    const bodyLines = startsWithPlace ? lines.slice(1) : lines;
    const dateSignature = hasSignature ? last : "";
    const body = hasSignature ? bodyLines.slice(0, -1).join("\n") : bodyLines.join("\n");

    return {
      type: "letter",
      content: body,
      fields: {
        place_year: placeYear,
        body,
        date_signature: dateSignature,
      },
      note: note("střední", "blok vypadá jako dopis podle oslovení, datace nebo podpisu"),
    };
  }

  return null;
}

function detectNewspaperArticle(lines: string[]): Detection | null {
  const text = lines.join("\n");
  const first = lines[0] ?? "";
  const second = lines[1] ?? "";

  if (/^(noviny|newspaper|článek|clanek|zpráva|zprava|tisková zpráva|tiskova zprava)\s*[:—-]/i.test(first)) {
    return { type: "newspaper_article", content: text.replace(/^(noviny|newspaper|článek|clanek|zpráva|zprava|tisková zpráva|tiskova zprava)\s*[:—-]\s*/i, ""), note: note("vysoká", "rozpoznáno podle označení novinového článku") };
  }

  const hasDateline = /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][^.!?]{2,50},\s*\d{1,2}\.?\s*[a-zá-ž]+\s*(1[5-9]\d{2}|20\d{2})/i.test(second);
  const headlineLike = first.length <= 100 && first.length >= 5 && !/[.!?…]$/.test(first);

  if (lines.length >= 3 && headlineLike && hasDateline) {
    return { type: "newspaper_article", content: text, note: note("střední", "nadpis a datace připomínají novinový článek") };
  }

  return null;
}

function detectParagraph(candidate: string): Detection {
  return { type: "paragraph", content: compactInlineText(candidate) };
}

function blockFromCandidate(candidate: string, index: number): WorkBlock {
  const lines = getNonEmptyLines(candidate);

  if (lines.length === 0) {
    return createBlock("paragraph", "");
  }

  const detectors: Array<() => Detection | null> = [
    () => isSeparator(lines) ? { type: "separator", content: "* * *", note: note("vysoká", "rozpoznaný textový předěl") } : null,
    () => detectImage(lines),
    () => detectFrontBackMatter(lines),
    () => detectBookPart(lines),
    () => detectChapter(lines, index),
    () => detectPlaceLine(lines),
    () => detectFootnote(lines),
    () => detectNote(lines),
    () => detectNewspaperArticle(lines),
    () => detectLetter(lines),
    () => detectPoem(lines),
    () => detectQuote(lines),
    () => detectHeadline(lines),
  ];

  for (const detector of detectors) {
    const detected = detector();
    if (detected) {
      return createBlock(detected.type, detected.content, detected.note, detected.fields);
    }
  }

  const paragraph = detectParagraph(candidate);
  return createBlock(paragraph.type, paragraph.content, paragraph.note, paragraph.fields);
}

function calculateStats(blocks: WorkBlock[]): ParsedWorkBlocksResult["stats"] {
  return {
    totalBlocks: blocks.length,
    bookParts: blocks.filter((block) => block.type === "book_part").length,
    chapters: blocks.filter((block) => block.type === "chapter").length,
    headlines: blocks.filter((block) => block.type === "headline").length,
    paragraphs: blocks.filter((block) => block.type === "paragraph").length,
    quotes: blocks.filter((block) => block.type === "quote").length,
    poems: blocks.filter((block) => block.type === "poem").length,
    letters: blocks.filter((block) => block.type === "letter").length,
    newspaperArticles: blocks.filter((block) => block.type === "newspaper_article").length,
    placeLines: blocks.filter((block) => block.type === "place_line").length,
    separators: blocks.filter((block) => block.type === "separator").length,
    notes: blocks.filter((block) => block.type === "note").length,
    footnotes: blocks.filter((block) => block.type === "footnote").length,
    dedications: blocks.filter((block) => block.type === "dedication").length,
    prefaces: blocks.filter((block) => block.type === "preface").length,
    afterwords: blocks.filter((block) => block.type === "afterword").length,
    acknowledgements: blocks.filter((block) => block.type === "acknowledgement").length,
    images: blocks.filter((block) => block.type === "image").length,
  };
}

export function parseRawTextToWorkBlocks(rawText: string): ParsedWorkBlocksResult {
  const text = normalizeRawText(rawText);

  if (!text) {
    return {
      blocks: [],
      stats: calculateStats([]),
    };
  }

  const candidates = splitIntoParagraphCandidates(text);
  const blocks = candidates
    .map((candidate, index) => blockFromCandidate(candidate, index))
    .filter((block) => block.content.trim() !== "" || block.type === "separator" || block.type === "image");

  return {
    blocks,
    stats: calculateStats(blocks),
  };
}
