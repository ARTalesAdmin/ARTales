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
  for (const fragment of fragments) {
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
    // Text is measured physically, but the exact fragment cut is a later step.
  }
  return {
    contentHeightPx: Math.floor(contentRect.height * 2) / 2,
    contentWidthPx: Math.floor(contentRect.width * 2) / 2,
    blockHeightsPx: heights,
    blockRows: rows,
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
