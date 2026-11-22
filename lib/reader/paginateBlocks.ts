import {
  getAdaptiveTableColumnWidths,
  getTableBlockPlainText,
  normalizeTableBlockFields,
  type WorkBlock,
} from "@/lib/blocks";
import type { ReaderSettings } from "./readerSettings";
import type {LegacyReaderDomGeometry} from "./domPageGeometry";
import {parseLegacyInlineProse} from "./inlineProseSource";
import {chooseSemanticFittingRowCut} from "@/lib/semantic/readerProjection";
import {getProtectedTextSpans} from "@/lib/semantic/protectedSpans";
import {DEFAULT_LEGACY_BLOCK_STYLES,legacyBlockWeightMultiplier,type LegacyBlockStyleMap,type LegacyBlockStyle} from "@/lib/rendering/legacyBlockStyles";

export type ReaderPage = {
  blocks: WorkBlock[];
  estimatedWeight: number;
  /** Exceptional indivisible content must remain readable, never clipped. */
  overflow?: "scroll_unit";
};

export type TableBlockMeasurement = {
  availableHeight: number;
  firstChromeHeight: number;
  continuationChromeHeight: number;
  rowHeights: number[];
};

export type TableBlockMeasurements = Record<string, TableBlockMeasurement>;


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
    // Keep complete sentences when they fit. A sentence that cannot possibly
    // fit is split at word boundaries rather than clipped by the page.
    const normalized=normalizeWhitespace(text);
    return isTerminalSentenceEnding(normalized) && normalized.length<=maxLength
      ? [normalized] : splitByWordLimit(normalized,maxLength);
  }

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const normalizedSentence = normalizeWhitespace(sentence);
    const candidate = current ? `${current} ${normalizedSentence}` : normalizedSentence;

    if (normalizedSentence.length > maxLength) {
      if(current){chunks.push(current);current="";}
      const fragments=splitByWordLimit(normalizedSentence,maxLength);
      chunks.push(...fragments);
    } else if(candidate.length > maxLength && current) {
      chunks.push(current);
      current=normalizedSentence;
    } else {
      current=candidate;
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
  const columnWidths = getAdaptiveTableColumnWidths(fields);
  if (rows.length <= 1) {
    return [
      {
        ...block,
        fields: {
          ...fields,
          column_widths: columnWidths,
        },
      },
    ];
  }

  return rows.map((chunkRows, index) => {
    const fragmentFields = {
      ...fields,
      rows: chunkRows,
      caption: index === 0 ? fields.caption : "",
      column_widths: columnWidths,
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
  style: LegacyBlockStyle,
): WorkBlock[] {
  if (block.type === "table") {
    return splitTableBlock(block, budget, settings, tableMeasurements);
  }
  // A media path cannot be split as prose even if the editor changes page policy.
  if (block.type === "image") return [block];

  const text = getBlockText(block);
  // A keep-together request is enforced while the block is reasonably small.
  // Never hide or discard exceptionally long content in a fixed-height paper.
  const estimatedBlockCost=getBlockWeight(block)*legacyBlockWeightMultiplier(style);
  if (!text || ((style.keep_together || style.own_page) && estimatedBlockCost <= budget * .85)) return [block];

  if (block.type === "poem" || block.type === "newspaper_article") {
    const lines = splitLines(text);
    if (lines.length <= 1) return [block];

    const lineBudget = Math.max(2, Math.floor(budget / 135));
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
  const chunkLimit = Math.max(100, Math.round(budget * 0.5));
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

function blockEndsAtSentenceBoundary(block: WorkBlock,styles:LegacyBlockStyleMap) {
  if (styles[block.type].keep_together || styles[block.type].own_page) return false;
  return isTerminalSentenceEnding(getBlockText(block));
}

function pageEndsAtSentenceBoundary(blocks: WorkBlock[],styles:LegacyBlockStyleMap) {
  const lastTextBlock = [...blocks]
    .reverse()
    .find((block) => getBlockText(block).length > 0);

  return lastTextBlock ? blockEndsAtSentenceBoundary(lastTextBlock,styles) : false;
}

function pushPage(
  pages: ReaderPage[],
  blocks: WorkBlock[],
  estimatedWeight: number,
) {
  if (blocks.length === 0) return;
  pages.push({ blocks: [...blocks], estimatedWeight });
}

/** Keep the pre-existing legacy splitting policy. This work changes ONLY
 * the way already-created fragments are assigned to sheets.
 */
export function prepareLegacyReaderFragments(
  blocks: WorkBlock[],
  settings: ReaderSettings,
  tableMeasurements: TableBlockMeasurements = {},
  styles: LegacyBlockStyleMap = DEFAULT_LEGACY_BLOCK_STYLES,
  preservePlainParagraphs = false,
): WorkBlock[] {
  const budget = getPageBudget(settings);
  return blocks.flatMap(block => {
    // WorkContentRenderer does not render empty prose / headings. Keeping
    // invisible fragments in the measurement input breaks exact DOM counts
    // and forces ALL later paragraphs into the character-estimate fallback.
    if(block.type!=="separator" && block.type!=="table" && block.type!=="image"
       && !getBlockText(block))return [];
    if(block.type==="image" && !getBlockText(block) &&
       !String(block.fields?.storage_path??"").trim())return [];
    const style = styles[block.type];
    // Supported prose (plain or with inline emphasis) must reach the browser
    // intact. Unsupported syntax retains the existing conservative splitter.
    if (preservePlainParagraphs && block.type === "paragraph" &&
      !style.keep_together && !style.own_page &&
      parseLegacyInlineProse(block.content)) return [block];
    const effectiveBudget = Math.max(120,
      Math.round(budget / Math.max(.4, legacyBlockWeightMultiplier(style))));
    return splitBlock(block, effectiveBudget, settings, tableMeasurements, style);
  });
}

/** The same canonical paginator can pack fragments by actual browser geometry
 * once Chromium has measured them. No new source fragment or block type.
 */
function paginateMeasuredLegacyFragments(
  fragments: readonly WorkBlock[],
  styles: LegacyBlockStyleMap,
  geometry: LegacyReaderDomGeometry,
): {pages:ReaderPage[];localFallbackBlocks:number} | null {
  const {contentHeightPx,blockHeightsPx,blockRows,paragraphRows} = geometry;
  if (!Number.isFinite(contentHeightPx) || contentHeightPx < 80 ||
    fragments.length !== blockHeightsPx.length ||
    blockRows.length !== fragments.length) return null;
  if (blockHeightsPx.some(h => !Number.isFinite(h) || h <= 0 || h > 100000)) return null;
  const capacity=Math.max(60,contentHeightPx-6);
  const pages:ReaderPage[]=[];
  let current:WorkBlock[]=[];
  let currentHeight=0;
  let currentOverflow=false;
  let localFallbackBlocks=0;
  const flush=()=>{
    if(!current.length)return;
    pages.push({blocks:current,estimatedWeight:currentHeight,
      ...(currentOverflow?{overflow:"scroll_unit" as const}:{})});
    current=[];currentHeight=0;currentOverflow=false;
  };
  const add=(block:WorkBlock,height:number)=>{
    current.push(block);
    currentHeight+=height;
    if(height>capacity)currentOverflow=true;
  };
  fragments.forEach((block,index)=>{
    const style=styles[block.type];
    const height=blockHeightsPx[index];
    if((style.page_break_before||style.own_page)&&current.length)flush();

    // Strictly one unmarked paragraph: source offsets from measured DOM rows.
    // These slices are display-only and cover exactly the original UTF-16
    // content (no normalization, dropped whitespace or stored mutations).
    const paragraph=block.type==="paragraph" && !style.keep_together && !style.own_page
      ?paragraphRows?.[index]:null;
    const raw=block.content;
    const inline=block.type==="paragraph" ? parseLegacyInlineProse(raw) : null;
    // Source slices remain byte-for-byte contiguous. Rendering-only affixes
    // restore an emphasis tag that spans a physical page boundary.
    const makeSlice=(start:number,end:number,reason:string,
      pageEndReason?:"punctuation_80"):WorkBlock=>{
      const startTag=inline?.activeTagAtSourceOffset(start);
      const endTag=inline?.activeTagAtSourceOffset(end);
      return {
        ...block,
        id:block.id+"-"+reason+"-"+start+"-"+end,
        content:raw.slice(start,end),
        fields:{
          ...(block.fields??{}),
          legacyReaderContinuation:start>0,
          ...(pageEndReason?{legacyReaderPageEndReason:pageEndReason}:{}),
          legacyReaderInlinePrefix:startTag?"<"+startTag+">":"",
          legacyReaderInlineSuffix:endTag?"</"+endTag+">":"",
        },
      };
    };
    const rows=paragraph?.rows;
    const validRows=rows && rows.length>1 &&
      rows.every((row,i)=>row.sourceEnd>0 && row.sourceEnd<=raw.length &&
        row.bottomPx>0 && (i===0 ||
          (row.sourceEnd>rows[i-1].sourceEnd && row.bottomPx>rows[i-1].bottomPx)));
    if (!validRows || !paragraph || !rows) {
      // Only THIS block uses the conservative indivisible fallback. Do not
      // discard physical geometry for every other paragraph in the book.
      if(block.type==="paragraph" && !style.keep_together && !style.own_page &&
        (!rows || rows.length!==1))localFallbackBlocks++;
      if(current.length && currentHeight+height>capacity)flush();
      add(block,height);
      if(style.own_page)flush();
      return;
    }
    const chrome=Math.max(0,height-paragraph.textHeightPx);
    let rowStart=0;
    let charStart=0;
    let displayStart=0;
    let guard=0;
    while(rowStart<rows.length && guard++<rows.length*3){
      const previousBottom=rowStart?rows[rowStart-1].bottomPx:0;
      const space=capacity-currentHeight;
      let endRow=rowStart-1;
      for(let j=rowStart;j<rows.length;j++){
        const needed=chrome+rows[j].bottomPx-previousBottom;
        if(needed>space-1)break;
        endRow=j;
      }
      // Mirror semantic DOM paging: retain the furthest real physical row
      // that fits. A two-line widow/orphan preference must never pull a
      // correctly fitting row back onto the next page.
      if(endRow<rowStart) {
        if(current.length){flush();continue;}
        // A single physical line is taller than the paper. Preserve access.
        endRow=rowStart;
      }
      const atEnd=endRow===rows.length-1;
      const fittingRow=rows[endRow];
      let charEnd=atEnd?raw.length:fittingRow.sourceEnd;
      let chosenDisplayEnd=atEnd?inline?.visibleText.length:fittingRow.displayEnd;
      let pageEndReason:"punctuation_80"|undefined;

      // The semantic Reader selects a measured period/semicolon at >=80% of
      // the LAST fitting physical row, not an earlier row or guessed character.
      // Adapt its existing decision to inline-markup source offsets. Plain
      // source and <em>/<i> follow the same policy.
      if(!atEnd && inline && fittingRow.displayEnd!==undefined &&
        fittingRow.punctuationCuts?.length){
        const visible=inline.visibleText;
        const legalEnds=new Set<number>([...visible.matchAll(/\s+/gu)]
          .map(hit=>hit.index!+hit[0].length));
        const selected=chooseSemanticFittingRowCut({
          end:fittingRow.displayEnd,sourceEnd:fittingRow.displayEnd,
          top:0,bottom:fittingRow.bottomPx,
          fill:fittingRow.fill??0,words:fittingRow.words??0,
          punctuationCuts:fittingRow.punctuationCuts.map(mark=>({
            sourceEnd:mark.displayEnd,fill:mark.fill,
          })),
        },visible,displayStart,visible.length,legalEnds,
        getProtectedTextSpans(visible));
        const mapped=selected.reason==="punctuation_80"
          ? inline.sourceOffsetAtTextOffset(selected.end) : null;
        if(mapped!==null && mapped>charStart && mapped<fittingRow.sourceEnd){
          charEnd=mapped;
          chosenDisplayEnd=selected.end;
          pageEndReason="punctuation_80";
        }
      }
      if(charEnd<=charStart || charEnd>raw.length){
        // Unreliable DOM offsets: do not risk a lost or duplicated character.
        if(current.length)flush();
        add(makeSlice(charStart,raw.length,"dom-invalid"),capacity+1);
        charStart=raw.length;
        break;
      }
      const piece:WorkBlock=charStart===0 && atEnd
        ? block : makeSlice(charStart,charEnd,"dom",pageEndReason);
      const measuredHeight=chrome+rows[endRow].bottomPx-previousBottom;
      if(current.length && currentHeight+measuredHeight>capacity)flush();
      add(piece,measuredHeight);
      // A punctuation cut may move the trailing words of the SAME physical
      // row to the next sheet. Count that row again there: it is a safe
      // conservative height bound until the browser reflows the remainder.
      rowStart=pageEndReason?endRow:endRow+1;
      charStart=charEnd;
      displayStart=chosenDisplayEnd??displayStart;
      if(!atEnd)flush();
    }
    // The measurement cursor must never consume some but not all of a source
    // paragraph. If browser rows cannot be trusted, retain its whole tail as
    // an accessible overflow unit rather than silently dropping characters.
    if(charStart<raw.length){
      if(current.length)flush();
      add(makeSlice(charStart,raw.length,"dom-remainder"),capacity+1);
    }
  });
  flush();
  return {pages:pages.length?pages:[{blocks:[],estimatedWeight:0}],localFallbackBlocks};
}

export type LegacyPaginationDiagnostics = {
  mode:"dom"|"estimated";
  reason:"measured"|"geometry-unavailable"|"geometry-invalid";
  localFallbackBlocks:number;
};

export function paginateReaderBlocksWithDiagnostics(
  blocks: WorkBlock[],
  settings: ReaderSettings,
  tableMeasurements: TableBlockMeasurements = {},
  styles: LegacyBlockStyleMap = DEFAULT_LEGACY_BLOCK_STYLES,
  measuredGeometry?: LegacyReaderDomGeometry | null,
): {pages:ReaderPage[];diagnostics:LegacyPaginationDiagnostics} {
  const budget = getPageBudget(settings);
  const softBudget = Math.round(budget * 0.9);
  const maxBudget = Math.round(budget * 1.08);
  // A missing ROW is not a book-wide failure. Existing DOM geometry still
  // packs every other block; only absent or invalid BOOK geometry falls back.
  let reason:LegacyPaginationDiagnostics["reason"] = "geometry-unavailable";
  if (measuredGeometry) {
    const uncut = prepareLegacyReaderFragments(
      blocks,settings,tableMeasurements,styles,true);
    const measured=paginateMeasuredLegacyFragments(uncut,styles,measuredGeometry);
    if (measured) return {
      pages:measured.pages,
      diagnostics:{mode:"dom",reason:"measured",localFallbackBlocks:measured.localFallbackBlocks},
    };
    reason="geometry-invalid";
  }
  const splitBlocks = prepareLegacyReaderFragments(
    blocks,settings,tableMeasurements,styles);
  const pages: ReaderPage[] = [];
  let currentBlocks: WorkBlock[] = [];
  let currentWeight = 0;

  for (const block of splitBlocks) {
    const style=styles[block.type];
    const weight = getBlockWeight(block)*legacyBlockWeightMultiplier(style)
      + (style.space_before_em+style.space_after_em)*16*settings.fontScale;

    if (block.type === "table" && style.own_page) {
      pushPage(pages, currentBlocks, currentWeight);
      pushPage(pages, [block], weight);
      currentBlocks = [];
      currentWeight = 0;
      continue;
    }
    // Page policy belongs to the same edited style used by WorkContentRenderer.
    if ((style.page_break_before || style.own_page) && currentBlocks.length) {
      pushPage(pages,currentBlocks,currentWeight);
      currentBlocks=[];currentWeight=0;
    }
    const nextWouldOverflow = currentBlocks.length > 0 && currentWeight + weight > maxBudget;
    // Hard safety budget overrides sentence preference: otherwise long
    // unpunctuated text chunks can be put back onto one clipped paper.
    const shouldStartNewPage = currentBlocks.length > 0 && nextWouldOverflow;

    if (shouldStartNewPage) {
      pushPage(pages, currentBlocks, currentWeight);
      currentBlocks = [];
      currentWeight = 0;
    }

    currentBlocks.push(block);
    currentWeight += weight;

    if (style.own_page || (currentWeight >= softBudget && pageEndsAtSentenceBoundary(currentBlocks,styles))) {
      pushPage(pages, currentBlocks, currentWeight);
      currentBlocks = [];
      currentWeight = 0;
    }
  }

  pushPage(pages, currentBlocks, currentWeight);

  return {
    pages:pages.length > 0 ? pages : [{ blocks: [], estimatedWeight: 0 }],
    diagnostics:{mode:"estimated",reason,localFallbackBlocks:0},
  };
}

/** Compatibility entrypoint: all callers share the same canonical paginator. */
export function paginateReaderBlocks(
  blocks:WorkBlock[],
  settings:ReaderSettings,
  tableMeasurements:TableBlockMeasurements = {},
  styles:LegacyBlockStyleMap = DEFAULT_LEGACY_BLOCK_STYLES,
  measuredGeometry?:LegacyReaderDomGeometry | null,
):ReaderPage[] {
  return paginateReaderBlocksWithDiagnostics(
    blocks,settings,tableMeasurements,styles,measuredGeometry).pages;
}
