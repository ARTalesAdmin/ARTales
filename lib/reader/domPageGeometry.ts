import type {WorkBlock} from "@/lib/blocks";
import {measureSemanticDomRows} from "@/lib/semantic/domLineGeometry";
import {parseLegacyInlineProse} from "./inlineProseSource";

/** Browser geometry for the existing legacy WorkBlock Reader.
 * This measures its ACTUAL rendered CSS boxes. It does not create semantic
 * text atoms, modify source strings, or introduce another pagination engine.
 */
export type LegacyReaderDomGeometry = {
  contentHeightPx: number;
  contentWidthPx: number;
  blockHeightsPx: number[];
  /** Physical Chromium rows, not logical sentences or source line breaks. */
  blockRows: number[];
  /** Real source-word boundaries for prose, including supported inline emphasis. */
  paragraphRows?: Array<{
    textHeightPx: number;
    rows: Array<{
      /** UTF-16 offset in the immutable source, including inline markup. */
      sourceEnd:number;
      /** UTF-16 offset in the actual displayed text, excluding markup. */
      displayEnd?:number;
      bottomPx:number;
      /** Natural (non-justified) line geometry. */
      fill?:number;
      words?:number;
      /** Non-destructive candidate breaks on the SAME physical row. */
      punctuationCuts?:ReadonlyArray<{displayEnd:number;fill:number}>;
    }>;
  } | null>;
};

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value < 100000;
}

/** Actual physical rows in the DOM. One Range may contain many inline spans. */
export function countLegacyRenderedRows(element: HTMLElement): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  const tops: number[] = [];
  for (const rect of Array.from(range.getClientRects())) {
    if (rect.width <= 0.2 || rect.height <= 0.2) continue;
    if (!tops.some(top => Math.abs(top - rect.top) <= 1.5)) {
      tops.push(rect.top);
    }
  }
  range.detach?.();
  return tops.length;
}

/** The measuring paper must have the same width AND height as the visible one. */
export function syncLegacyMeasuringPaper(
  measuringStage: HTMLElement,
  visiblePaper: HTMLElement,
): boolean {
  const visible = visiblePaper.getBoundingClientRect();
  if (!finitePositive(visible.width) || !finitePositive(visible.height)) return false;
  if (visible.width < 200 || visible.height < 240) return false;
  measuringStage.style.width = visible.width + "px";
  measuringStage.style.height = visible.height + "px";
  return true;
}

/** Use a real WorkContentRenderer inside a hidden paper, not an invented font
 * estimate. If any rendered source fragment is absent, reject the measurement
 * rather than silently discarding it from the pages.
 */
export function measureLegacyReaderDom(
  measuringStage: HTMLElement,
  expectedFragmentCount: number,
  sourceFragments?: readonly WorkBlock[],
): LegacyReaderDomGeometry | null {
  const content = measuringStage.querySelector<HTMLElement>(
    ".artales-reader__page-content",
  );
  const book = content?.querySelector<HTMLElement>(".artales-work-content");
  if (!content || !book || expectedFragmentCount < 1) return null;
  const contentRect = content.getBoundingClientRect();
  if (!finitePositive(contentRect.width) || !finitePositive(contentRect.height))
    return null;

  const fragments = Array.from(book.children).filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement && element.hasAttribute("data-legacy-block-style"),
  );
  if (fragments.length !== expectedFragmentCount) return null;
  const heights: number[] = [];
  const rows: number[] = [];
  const paragraphRows: NonNullable<LegacyReaderDomGeometry["paragraphRows"]> = [];
  for (const [index,fragment] of fragments.entries()) {
    const rect = fragment.getBoundingClientRect();
    const css = getComputedStyle(fragment);
    const topMargin = parseFloat(css.marginTop) || 0;
    const bottomMargin = parseFloat(css.marginBottom) || 0;
    const height = rect.height + Math.max(0, topMargin) + Math.max(0, bottomMargin);
    if (!finitePositive(height)) return null;
    heights.push(Math.ceil(height * 2) / 2);

    const textElements = fragment.querySelectorAll<HTMLElement>(
      "p,h2,h3,h4,blockquote",
    );
    let totalRows = 0;
    for (const el of textElements) totalRows += countLegacyRenderedRows(el);
    rows.push(totalRows);
    const source = sourceFragments?.[index];
    const paragraphs = Array.from(fragment.querySelectorAll<HTMLElement>(
      ".artales-paragraph > p",
    ));
    const inline = source?.type === "paragraph"
      ? parseLegacyInlineProse(source.content) : null;
    // The actual React renderer is the authority for paragraph count and
    // visible characters. Unsupported markup falls back for THIS block only.
    const supported = Boolean(inline && paragraphs.length === inline.parts.length &&
      paragraphs.every((p,i)=>p.textContent === inline.parts[i].text));
    if (!supported || !inline || !paragraphs.length) {
      paragraphRows.push(null);continue;
    }
    const firstRect = paragraphs[0].getBoundingClientRect();
    const lastRect = paragraphs[paragraphs.length - 1].getBoundingClientRect();
    const sourceRows = paragraphs.flatMap((p,i) => {
      const part = inline.parts[i];
      const rect = p.getBoundingClientRect();
      const topOffset = rect.top - firstRect.top;
      return measureSemanticDomRows(p,0,p).map(row=>({
        sourceEnd:inline.sourceOffsetAtTextOffset(part.textStart+row.sourceEnd) ?? -1,
        displayEnd:part.textStart+row.sourceEnd,
        bottomPx:topOffset+row.bottom,
        fill:row.fill,
        words:row.words,
        punctuationCuts:row.punctuationCuts?.map(mark=>({
          displayEnd:part.textStart+mark.sourceEnd,
          fill:mark.fill,
        })),
      }));
    });
    const pHeight = lastRect.bottom - firstRect.top;
    if (!(pHeight>0) || sourceRows.length<1 ||
        sourceRows.some((row,i)=>!Number.isFinite(row.bottomPx) ||
          row.sourceEnd<1 || row.sourceEnd>source!.content.length ||
          row.displayEnd<1 || row.displayEnd>inline.visibleText.length ||
          row.fill<0 || row.fill>1 || row.words<1 ||
          (i>0 && (row.sourceEnd<=sourceRows[i-1].sourceEnd ||
            row.displayEnd<=sourceRows[i-1].displayEnd)))) {
      paragraphRows.push(null);continue;
    }
    paragraphRows.push({textHeightPx:pHeight,rows:sourceRows});
  }
  return {
    contentHeightPx: Math.floor(contentRect.height * 2) / 2,
    contentWidthPx: Math.floor(contentRect.width * 2) / 2,
    blockHeightsPx: heights,
    blockRows: rows,
    paragraphRows,
  };
}

/** Visible ink can extend beyond a clipped page even if scrollHeight does not
 * report it (transforms, inline spans, SVG). Mirror semantic Reader protection.
 */
export function legacyPageInkOverflowPx(content: HTMLElement): number | null {
  const rect = content.getBoundingClientRect();
  if (!finitePositive(rect.height)) return null;
  let bottom = -Infinity;
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.textContent?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const box of Array.from(range.getClientRects())) {
      if (box.width > 0.5 && box.height > 0.5) bottom = Math.max(bottom, box.bottom);
    }
    range.detach?.();
  }
  for (const media of Array.from(content.querySelectorAll<HTMLElement>(
    "figure,img,svg,pre,table",
  ))) {
    bottom = Math.max(bottom, media.getBoundingClientRect().bottom);
  }
  return Number.isFinite(bottom) ? Math.max(0, bottom - rect.bottom) : null;
}
