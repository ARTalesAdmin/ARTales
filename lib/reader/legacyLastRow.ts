import {applySemanticProseLastRowJustification} from "@/lib/semantic/domLineGeometry";

/** The legacy Reader uses the same measured, bounded last-row rule as the
 * semantic Reader. Never modify source text or paginate again here.
 * Call ONLY on a visible paper, not an offscreen measurement clone.
 */
export function applyLegacyPaperLastRowJustification(paper: HTMLElement): {
  checked: number;
  justified: number;
} {
  const paragraphs = paper.querySelectorAll<HTMLElement>(
    '.artales-reader__page-content .artales-work-content ' +
    '[data-legacy-block-style="paragraph"] > .artales-paragraph p',
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
