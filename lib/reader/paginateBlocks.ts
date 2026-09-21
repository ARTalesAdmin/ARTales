import {
  getTableBlockPlainText,
  normalizeTableBlockFields,
  type WorkBlock,
} from "@/lib/blocks";
import type { ReaderSettings } from "./readerSettings";

export type ReaderPage = {
  blocks: WorkBlock[];
  estimatedWeight: number;
};

export type TableBlockMeasurement = {
  availableHeight: number;
  firstChromeHeight: number;
  continuationChromeHeight: number;
  rowHeights: number[];
};

export type TableBlockMeasurements = Record<string, TableBlockMeasurement>;

const PAGE_BREAK_BLOCKS = new Set<WorkBlock["type"]>(["book_part", "chapter"]);
const KEEP_TOGETHER_BLOCKS = new Set<WorkBlock["type"]>([
  "headline",
  "place_line",
  "separator",
  "image",
]);

const TERMINAL_PUNCTUATION = new Set([".", "!", "?", "…"]);
const CLOSING_MARKS = new Set(["\"", "'", "”", "’", ")", "]", "}", "»", "›"]);

function getPageBudget(settings: ReaderSettings) {
  const widthMultiplier =
    settings.width === "wide" ? 1.1 : settings.width === "narrow" ? 0.88 : 1;
  const densityMultiplier = settings.density === "compact" ? 1.12 : 0.98;
  const fontMultiplier = Math.max(0.68, Math.min(1.18, 1 / settings.fontScale));

  // Slightly fuller than the first foundation paginator, but still below a
  // hard visual overflow threshold. The actual page UI keeps a header/footer
  // safe area; this budget is a text-flow approximation, not pixel-perfect PDF.
  return Math.round(1280 * widthMultiplier * densityMultiplier * fontMultiplier);
}

function getBlockText(block: WorkBlock) {
  if (block.type === "letter") {
    return String(block.fields?.body ?? block.content ?? "").trim();
  }

  return String(block.content ?? "").trim();
}

function normalizeWhitespace(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function splitParagraphs(text: string) {
  return normalizeWhitespace(text)
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isTerminalSentenceEnding(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;

  let index = trimmed.length - 1;
  while (index >= 0 && CLOSING_MARKS.has(trimmed[index])) index -= 1;

  return index >= 0 && TERMINAL_PUNCTUATION.has(trimmed[index]);
}

function readClosingMarks(text: string, startIndex: number) {
  let index = startIndex;
  while (index < text.length && CLOSING_MARKS.has(text[index])) index += 1;
  return index;
}

function isSentenceBoundary(text: string, punctuationIndex: number) {
  const afterClosers = readClosingMarks(text, punctuationIndex + 1);
  const nextChar = text[afterClosers];

  // Direct speech often has punctuation inside quotation marks followed by a
  // comma and a speech tag: „Přesně tak!“, řekl Karel. Do not split there.
  if (nextChar === ",") return false;

  return afterClosers >= text.length || /\s/.test(nextChar);
}

function splitSentences(text: string) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  const sentences: string[] = [];
  let start = 0;
  let index = 0;

  while (index < normalized.length) {
    const char = normalized[index];
    if (TERMINAL_PUNCTUATION.has(char) && isSentenceBoundary(normalized, index)) {
      const end = readClosingMarks(normalized, index + 1);
      const sentence = normalized.slice(start, end).trim();
      if (sentence) sentences.push(sentence);
      start = end;
      while (start < normalized.length && /\s/.test(normalized[start])) start += 1;
      index = start;
      continue;
    }
    index += 1;
  }

  const rest = normalized.slice(start).trim();
  if (rest) sentences.push(rest);

  return sentences.length > 0 ? sentences : [normalized];
}

function splitByWordLimit(text: string, maxLength: number) {
  const words = normalizeWhitespace(text).split(" ").filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength && current) {
      chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function splitLines(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((part) => part.trimEnd())
    .filter((part) => part.trim() !== "");
}

function splitLongText(text: string, maxLength: number) {
  const sentences = splitSentences(text);
  if (sentences.length <= 1) {
    // Prefer an oversized complete sentence to a prettier page that ends mid-
    // sentence. Only fall back to word chunks when there is no terminal ending.
    return isTerminalSentenceEnding(text) ? [normalizeWhitespace(text)] : splitByWordLimit(text, maxLength);
  }

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const normalizedSentence = normalizeWhitespace(sentence);
    const candidate = current ? `${current} ${normalizedSentence}` : normalizedSentence;

    if (candidate.length > maxLength && current) {
      chunks.push(current);
      current = normalizedSentence;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function cloneBlock(
  block: WorkBlock,
  content: string,
  suffix: string,
): WorkBlock {
  if (block.type === "letter") {
    return {
      ...block,
      id: `${block.id || block.type}-${suffix}`,
      content,
      fields: {
        ...(block.fields ?? {}),
        body: content,
      },
    };
  }

  return {
    ...block,
    id: `${block.id || block.type}-${suffix}`,
    content,
  };
}

function getTableRowWeight(row: string[]) {
  const textLength = row.reduce((sum, cell) => sum + cell.trim().length, 0);
  const longestCell = row.reduce(
    (longest, cell) => Math.max(longest, cell.trim().length),
    0,
  );

  return Math.max(90, textLength * 0.72 + longestCell * 0.18 + 42);
}

function buildTableFragments(
  block: WorkBlock,
  rows: string[][][],
): WorkBlock[] {
  const fields = normalizeTableBlockFields(block.fields);
  if (rows.length <= 1) return [block];

  return rows.map((chunkRows, index) => {
    const fragmentFields = {
      ...fields,
      rows: chunkRows,
      caption: index === 0 ? fields.caption : "",
    };

    return {
      ...block,
      id: `${block.id || block.type}-table-page-${index}`,
      content: getTableBlockPlainText(fragmentFields),
      fields: fragmentFields,
    };
  });
}

function splitTableBlockMeasured(
  block: WorkBlock,
  measurement: TableBlockMeasurement,
): WorkBlock[] {
  const fields = normalizeTableBlockFields(block.fields);
  if (
    fields.rows.length <= 1 ||
    measurement.rowHeights.length !== fields.rows.length ||
    measurement.availableHeight <= 0
  ) {
    return [block];
  }

  const safeHeight = Math.max(0, measurement.availableHeight - 6);
  const rowChunks: string[][][] = [];
  let currentRows: string[][] = [];
  let currentHeight = measurement.firstChromeHeight;

  fields.rows.forEach((row, index) => {
    const rowHeight = Math.max(0, measurement.rowHeights[index] ?? 0);
    const chromeHeight =
      rowChunks.length === 0
        ? measurement.firstChromeHeight
        : measurement.continuationChromeHeight;

    if (
      currentRows.length > 0 &&
      currentHeight + rowHeight > safeHeight
    ) {
      rowChunks.push(currentRows);
      currentRows = [];
      currentHeight = measurement.continuationChromeHeight;
    }

    if (currentRows.length === 0) {
      currentHeight =
        rowChunks.length === 0 ? measurement.firstChromeHeight : chromeHeight;
    }

    currentRows.push(row);
    currentHeight += rowHeight;
  });

  if (currentRows.length > 0) rowChunks.push(currentRows);
  return buildTableFragments(block, rowChunks);
}

function splitTableBlock(
  block: WorkBlock,
  budget: number,
  settings: ReaderSettings,
  tableMeasurements: TableBlockMeasurements,
): WorkBlock[] {
  const fields = normalizeTableBlockFields(block.fields);
  if (fields.rows.length <= 1) return [block];

  const measured = tableMeasurements[block.id];
  if (measured) {
    const measuredFragments = splitTableBlockMeasured(block, measured);
    if (measuredFragments.length > 1 || measured.rowHeights.length === fields.rows.length) {
      return measuredFragments;
    }
  }

  const headerWeight =
    (fields.headers?.reduce((sum, cell) => sum + cell.trim().length, 0) ?? 0) +
    (fields.caption?.trim().length ?? 0) +
    180;
  const tableBudgetMultiplier =
    settings.layoutMode === "spread" ? 0.63 : 0.72;
  const rowBudget = Math.max(
    360,
    Math.round(budget * tableBudgetMultiplier) - headerWeight,
  );
  const rowChunks: string[][][] = [];
  let currentRows: string[][] = [];
  let currentWeight = 0;

  for (const row of fields.rows) {
    const rowWeight = getTableRowWeight(row);

    if (currentRows.length > 0 && currentWeight + rowWeight > rowBudget) {
      rowChunks.push(currentRows);
      currentRows = [];
      currentWeight = 0;
    }

    currentRows.push(row);
    currentWeight += rowWeight;
  }

  if (currentRows.length > 0) rowChunks.push(currentRows);
  return buildTableFragments(block, rowChunks);
}

function splitBlock(
  block: WorkBlock,
  budget: number,
  settings: ReaderSettings,
  tableMeasurements: TableBlockMeasurements,
): WorkBlock[] {
  if (block.type === "table") {
    return splitTableBlock(block, budget, settings, tableMeasurements);
  }

  const text = getBlockText(block);
  if (!text || KEEP_TOGETHER_BLOCKS.has(block.type)) return [block];

  if (block.type === "poem" || block.type === "newspaper_article") {
    const lines = splitLines(text);
    if (lines.length <= 1) return [block];

    const lineBudget = Math.max(10, Math.floor(budget / 135));
    const chunks: WorkBlock[] = [];
    for (let index = 0; index < lines.length; index += lineBudget) {
      chunks.push(
        cloneBlock(
          block,
          lines.slice(index, index + lineBudget).join("\n"),
          `page-${index}`,
        ),
      );
    }
    return chunks;
  }

  const paragraphs = splitParagraphs(text);
  const chunkLimit = Math.max(520, Math.round(budget * 0.5));
  const chunks: WorkBlock[] = [];

  for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
    const parts = splitLongText(paragraph, chunkLimit);
    for (const [partIndex, part] of parts.entries()) {
      chunks.push(
        cloneBlock(block, part, `page-${paragraphIndex}-${partIndex}`),
      );
    }
  }

  return chunks.length > 0 ? chunks : [block];
}

function getBlockWeight(block: WorkBlock) {
  const text = getBlockText(block);
  const base = Math.max(60, text.length);

  switch (block.type) {
    case "book_part":
      return Math.max(520, base * 2.6);
    case "chapter":
      return Math.max(420, base * 2.2);
    case "headline":
      return Math.max(280, base * 1.9);
    case "quote":
      return base * 1.28 + 120;
    case "letter":
      return base * 1.32 + 180;
    case "newspaper_article":
      return base * 1.28 + 180;
    case "poem":
      return base * 1.42 + 140;
    case "separator":
      return 280;
    case "image":
      return 920;
    case "table": {
      const fields = normalizeTableBlockFields(block.fields);
      const rowsWeight = fields.rows.reduce(
        (sum, row) => sum + getTableRowWeight(row),
        0,
      );
      return rowsWeight + 220;
    }
    case "note":
    case "footnote":
      return base * 1.26 + 120;
    case "place_line":
      return 210;
    default:
      return base + 90;
  }
}

function blockEndsAtSentenceBoundary(block: WorkBlock) {
  if (PAGE_BREAK_BLOCKS.has(block.type) || KEEP_TOGETHER_BLOCKS.has(block.type)) return false;
  return isTerminalSentenceEnding(getBlockText(block));
}

function pageEndsAtSentenceBoundary(blocks: WorkBlock[]) {
  const lastTextBlock = [...blocks]
    .reverse()
    .find((block) => getBlockText(block).length > 0);

  return lastTextBlock ? blockEndsAtSentenceBoundary(lastTextBlock) : false;
}

function pushPage(
  pages: ReaderPage[],
  blocks: WorkBlock[],
  estimatedWeight: number,
) {
  if (blocks.length === 0) return;
  pages.push({ blocks: [...blocks], estimatedWeight });
}

export function paginateReaderBlocks(
  blocks: WorkBlock[],
  settings: ReaderSettings,
  tableMeasurements: TableBlockMeasurements = {},
): ReaderPage[] {
  const budget = getPageBudget(settings);
  const softBudget = Math.round(budget * 0.9);
  const maxBudget = Math.round(budget * 1.08);
  const splitBlocks = blocks.flatMap((block) =>
    splitBlock(block, budget, settings, tableMeasurements),
  );
  const pages: ReaderPage[] = [];
  let currentBlocks: WorkBlock[] = [];
  let currentWeight = 0;

  for (const block of splitBlocks) {
    const weight = getBlockWeight(block);

    if (block.type === "table") {
      pushPage(pages, currentBlocks, currentWeight);
      pushPage(pages, [block], weight);
      currentBlocks = [];
      currentWeight = 0;
      continue;
    }
    const nextWouldOverflow = currentBlocks.length > 0 && currentWeight + weight > maxBudget;
    const shouldStartNewPage =
      currentBlocks.length > 0 &&
      (PAGE_BREAK_BLOCKS.has(block.type) ||
        (nextWouldOverflow && pageEndsAtSentenceBoundary(currentBlocks)));

    if (shouldStartNewPage) {
      pushPage(pages, currentBlocks, currentWeight);
      currentBlocks = [];
      currentWeight = 0;
    }

    currentBlocks.push(block);
    currentWeight += weight;

    if (currentWeight >= softBudget && pageEndsAtSentenceBoundary(currentBlocks)) {
      pushPage(pages, currentBlocks, currentWeight);
      currentBlocks = [];
      currentWeight = 0;
    }
  }

  pushPage(pages, currentBlocks, currentWeight);

  return pages.length > 0 ? pages : [{ blocks: [], estimatedWeight: 0 }];
}
