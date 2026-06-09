import type { WorkBlock } from "@/lib/blocks";
import type { ReaderSettings } from "./readerSettings";

export type ReaderPage = {
  blocks: WorkBlock[];
  estimatedWeight: number;
};

const PAGE_BREAK_BLOCKS = new Set<WorkBlock["type"]>(["book_part", "chapter"]);
const KEEP_TOGETHER_BLOCKS = new Set<WorkBlock["type"]>([
  "headline",
  "place_line",
  "separator",
  "image",
]);

function getPageBudget(settings: ReaderSettings) {
  const widthMultiplier =
    settings.width === "wide" ? 1.08 : settings.width === "narrow" ? 0.86 : 1;
  const densityMultiplier = settings.density === "compact" ? 1.08 : 0.94;
  const fontMultiplier = Math.max(0.68, Math.min(1.18, 1 / settings.fontScale));

  // Conservative text capacity for one visible paper sheet. The page UI has
  // a header/footer safe area, so the paginator must leave margin instead of
  // trying to fill the sheet to the last pixel.
  return Math.round(1220 * widthMultiplier * densityMultiplier * fontMultiplier);
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

function splitSentences(text: string) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  const matches = normalized.match(/[^.!?…]+[.!?…]+["'”’)]*|[^.!?…]+$/g);
  return (matches ?? [normalized]).map((part) => part.trim()).filter(Boolean);
}

function splitBySoftPunctuation(text: string, maxLength: number) {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= maxLength) return [normalized];

  const pieces = normalized
    .split(/(?<=[,;:—–-])[ ]+/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (pieces.length <= 1) {
    return splitByWordLimit(normalized, maxLength);
  }

  const chunks: string[] = [];
  let current = "";

  for (const piece of pieces) {
    const candidate = current ? `${current} ${piece}` : piece;
    if (candidate.length > maxLength && current) {
      chunks.push(current);
      current = piece;
    } else if (candidate.length > maxLength) {
      chunks.push(...splitByWordLimit(candidate, maxLength));
      current = "";
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
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
  if (sentences.length <= 1) return splitBySoftPunctuation(text, maxLength);

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const sentenceParts = splitBySoftPunctuation(sentence, maxLength);

    for (const part of sentenceParts) {
      const candidate = current ? `${current} ${part}` : part;
      if (candidate.length > maxLength && current) {
        chunks.push(current);
        current = part;
      } else if (candidate.length > maxLength) {
        chunks.push(...splitByWordLimit(candidate, maxLength));
        current = "";
      } else {
        current = candidate;
      }
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

function splitBlock(block: WorkBlock, budget: number): WorkBlock[] {
  const text = getBlockText(block);
  if (!text || KEEP_TOGETHER_BLOCKS.has(block.type)) return [block];

  if (block.type === "poem" || block.type === "newspaper_article") {
    const lines = splitLines(text);
    if (lines.length <= 1) return [block];

    const lineBudget = Math.max(8, Math.floor(budget / 150));
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
  const chunkLimit = Math.max(360, Math.round(budget * 0.42));
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
    case "note":
    case "footnote":
      return base * 1.26 + 120;
    case "place_line":
      return 210;
    default:
      return base + 90;
  }
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
): ReaderPage[] {
  const budget = getPageBudget(settings);
  const softBudget = Math.round(budget * 0.82);
  const maxBudget = Math.round(budget * 0.96);
  const splitBlocks = blocks.flatMap((block) => splitBlock(block, budget));
  const pages: ReaderPage[] = [];
  let currentBlocks: WorkBlock[] = [];
  let currentWeight = 0;

  for (const block of splitBlocks) {
    const weight = getBlockWeight(block);
    const shouldStartNewPage =
      currentBlocks.length > 0 &&
      (PAGE_BREAK_BLOCKS.has(block.type) || currentWeight + weight > maxBudget);

    if (shouldStartNewPage) {
      pushPage(pages, currentBlocks, currentWeight);
      currentBlocks = [];
      currentWeight = 0;
    }

    currentBlocks.push(block);
    currentWeight += weight;

    if (currentWeight >= softBudget) {
      pushPage(pages, currentBlocks, currentWeight);
      currentBlocks = [];
      currentWeight = 0;
    }
  }

  pushPage(pages, currentBlocks, currentWeight);

  return pages.length > 0 ? pages : [{ blocks: [], estimatedWeight: 0 }];
}
