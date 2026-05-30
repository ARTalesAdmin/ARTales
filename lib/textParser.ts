import type { WorkBlock, WorkBlockType } from "@/lib/blocks";

export type ParsedWorkBlocksResult = {
  blocks: WorkBlock[];
  stats: {
    totalBlocks: number;
    chapters: number;
    paragraphs: number;
    poems: number;
    separators: number;
    quotes: number;
    placeLines: number;
  };
};

function createBlock(type: WorkBlockType, content: string, editorNote?: string): WorkBlock {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `parsed-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    content: content.trim(),
    editor_note: editorNote ?? null,
  };
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

function isSeparator(lines: string[]) {
  if (lines.length !== 1) return false;
  return /^(\*\s*){3,}$/.test(lines[0]) || /^[-—–]{3,}$/.test(lines[0]);
}

function isBookPart(lines: string[]) {
  if (lines.length > 2) return false;
  const text = compactInlineText(lines.join("\n"));

  return (
    /^(část|cast|part|book|kniha)\b/i.test(text) &&
    text.length <= 90
  );
}

function isChapterHeading(lines: string[], index: number) {
  if (lines.length > 2) return false;

  const text = compactInlineText(lines.join("\n"));
  if (!text || text.length > 120) return false;

  if (/^(kapitola|chapter)\s+([0-9ivxlcdm]+|[a-z]+)\b/i.test(text)) return true;
  if (/^(prolog|epilog|úvod|uvod|doslov|předmluva|predmluva)$/i.test(text)) return true;
  if (/^[IVXLCDM]{1,8}\.?$/i.test(text)) return true;
  if (/^\d{1,3}\.?$/.test(text)) return true;
  if (/^\d{1,3}[.)]\s+\S+/.test(text)) return true;

  const looksLikeTitle =
    index === 0 &&
    text.length <= 80 &&
    !/[.!?…]$/.test(text) &&
    text.split(/\s+/).length <= 10;

  return looksLikeTitle;
}

function isPlaceLine(lines: string[]) {
  if (lines.length !== 1) return false;
  const text = lines[0];

  return (
    text.length <= 90 &&
    (/\b(1[5-9]\d{2}|20\d{2})\b/.test(text) || /,\s*[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽa-záčďéěíňóřšťúůýž]+\.?$/.test(text)) &&
    !/[!?]$/.test(text)
  );
}

function isQuote(lines: string[]) {
  const text = compactInlineText(lines.join("\n"));
  if (text.length > 500) return false;

  return (
    /^([„“\"'‚‘’»«]|—\s*)/.test(text) &&
    /([“\"'‘’»«]|\.)$/.test(text)
  );
}

function isLikelyPoem(lines: string[]) {
  if (lines.length < 3) return false;
  if (lines.length > 40) return false;

  const averageLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
  const shortLines = lines.filter((line) => line.length <= 70).length;
  const terminalPunctuation = lines.filter((line) => /[.!?…]$/.test(line)).length;

  return averageLength <= 58 && shortLines / lines.length >= 0.8 && terminalPunctuation / lines.length < 0.75;
}

function blockFromCandidate(candidate: string, index: number): WorkBlock {
  const lines = getNonEmptyLines(candidate);

  if (lines.length === 0) {
    return createBlock("paragraph", "");
  }

  if (isSeparator(lines)) {
    return createBlock("separator", "* * *", "Parser: rozpoznaný předěl.");
  }

  if (isBookPart(lines)) {
    return createBlock("book_part", compactInlineText(candidate), "Parser: rozpoznaná část knihy.");
  }

  if (isChapterHeading(lines, index)) {
    return createBlock("chapter", compactInlineText(candidate), "Parser: rozpoznaný nadpis / kapitola.");
  }

  if (isPlaceLine(lines)) {
    return createBlock("place_line", compactInlineText(candidate), "Parser: možná datace / místo.");
  }

  if (isLikelyPoem(lines)) {
    return createBlock("poem", lines.join("\n"), "Parser: pravděpodobně veršovaný blok. Zkontrolovat ručně.");
  }

  if (isQuote(lines)) {
    return createBlock("quote", compactInlineText(candidate), "Parser: pravděpodobná citace / motto.");
  }

  return createBlock("paragraph", compactInlineText(candidate));
}

function calculateStats(blocks: WorkBlock[]): ParsedWorkBlocksResult["stats"] {
  return {
    totalBlocks: blocks.length,
    chapters: blocks.filter((block) => block.type === "chapter" || block.type === "book_part").length,
    paragraphs: blocks.filter((block) => block.type === "paragraph").length,
    poems: blocks.filter((block) => block.type === "poem").length,
    separators: blocks.filter((block) => block.type === "separator").length,
    quotes: blocks.filter((block) => block.type === "quote").length,
    placeLines: blocks.filter((block) => block.type === "place_line").length,
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
    .filter((block) => block.content.trim() !== "");

  return {
    blocks,
    stats: calculateStats(blocks),
  };
}
