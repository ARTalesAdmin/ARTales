/** Reversible display-only soft-wrap projection. Never alter canonical source atoms or anchors. */
export function projectSemanticProseText(raw:string):string {
  // Archived edition line endings are soft line wraps inside a paragraph.
  // Keep semantic paragraph breaks, punctuation and words; verse uses raw directly.
  return raw.replace(/([^\n])\n(?=[^\n])/g, "$1 ");
}
