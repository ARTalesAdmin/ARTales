import {applySemanticProseLastRowJustification} from "@/lib/semantic/domLineGeometry";

/** The legacy Reader uses the same measured, bounded last-row rule as the
 * semantic Reader. Never modify source text or paginate again here.
 * Call ONLY on a visible paper, not an offscreen measurement clone.
 */
export function applyLegacyPaperLastRowJustification(paper: HTMLElement): {
  checked: number;
  justified: number;
} {
  // WorkContentRenderer has several prose containers which can be
  // editorially justified (e.g. italic quotations and introductory matter).
  // The former paragraph-only selector silently skipped their last rows.
  // Keep source blocks and their alignment policy authoritative; the
  // canonical helper checks computed text-align before applying the class.
  const paragraphs = paper.querySelectorAll<HTMLElement>(
    '.artales-reader__page-content .artales-work-content ' +
    '[data-legacy-block-style] ' +
    ':is(.artales-paragraph, .artales-quote, .artales-letter-body, ' +
    '.artales-newspaper, .artales-preface, .artales-afterword, ' +
    '.artales-acknowledgement) > p',
  );
  let checked = 0;
  let justified = 0;
  for (const paragraph of paragraphs) {
    if (!paragraph.getClientRects().length) continue;
    checked++;
    if (applySemanticProseLastRowJustification(paragraph)) justified++;
  }
  paper.dataset.legacyLastRowChecked = String(checked);
  paper.dataset.legacyLastRowJustified = String(justified);
  return {checked,justified};
}
