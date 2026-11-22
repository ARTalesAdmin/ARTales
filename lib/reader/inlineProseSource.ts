/** Source offsets for the exact inline emphasis markup WorkContentRenderer renders.
 * This is not an HTML parser. Unsupported or malformed markup stays on the
 * existing conservative fallback path; original source is never rewritten.
 */
export type LegacyInlineSource = {
  visibleText: string;
  sourceOffsetAtTextOffset: (offset: number) => number | null;
  activeTagAtSourceOffset: (offset: number) => "em" | "i" | null;
};

type InlineTag = { end: number; type: "em" | "i"; closing: boolean };
type TextSlice = {
  sourceStart: number;
  textStart: number;
  textEnd: number;
};

export function parseLegacyInlineProse(source: string): LegacyInlineSource | null {
  // A single source newline remains text in the canonical renderer;
  // only CRLF normalization or multiple paragraph elements require fallback.
  if (!source || source !== source.trim() || /\r|\n\s*\n/.test(source)) return null;

  // Match only tags already supported by renderInlineRichText in the canonical
  // WorkContentRenderer, including Project Gutenberg's escaped emphasis tags.
  const tokens = /<\s*(\/?)\s*(em|i)\s*>|&lt;(\/?(?:em|i))&gt;/gi;
  const slices: TextSlice[] = [];
  const tags: InlineTag[] = [];
  let visibleText = "";
  let cursor = 0;
  let active: "em" | "i" | null = null;

  const append = (start: number, end: number): boolean => {
    if (start === end) return true;
    const text = source.slice(start, end);
    // React renders stray angle brackets literally. Rather than risk a
    // disagreement with its inline markup interpretation, refuse to map them.
    if (/[<>]/.test(text)) return false;
    slices.push({
      sourceStart: start,
      textStart: visibleText.length,
      textEnd: visibleText.length + text.length,
    });
    visibleText += text;
    return true;
  };

  let match: RegExpExecArray | null;
  while ((match = tokens.exec(source)) !== null) {
    if (!append(cursor, match.index)) return null;
    const escaped = match[3]?.toLowerCase();
    const type = (match[2]?.toLowerCase() || escaped?.replace("/", "")) as "em" | "i";
    const closing = match[1] === "/" || Boolean(escaped?.startsWith("/"));
    if (closing) {
      if (active !== type) return null;
      active = null;
    } else {
      if (active !== null) return null; // Renderer does not support nesting.
      active = type;
    }
    tags.push({ end: tokens.lastIndex, type, closing });
    cursor = tokens.lastIndex;
  }
  if (!append(cursor, source.length) || active !== null || !visibleText.trim()) return null;

  return {
    visibleText,
    sourceOffsetAtTextOffset(offset) {
      if (!Number.isInteger(offset) || offset <= 0 || offset > visibleText.length) return null;
      for (const slice of slices) {
        if (offset > slice.textStart && offset <= slice.textEnd) {
          return slice.sourceStart + offset - slice.textStart;
        }
      }
      return null;
    },
    activeTagAtSourceOffset(offset) {
      if (!Number.isInteger(offset) || offset < 0 || offset > source.length) return null;
      let state: "em" | "i" | null = null;
      for (const tag of tags) {
        if (tag.end > offset) break;
        state = tag.closing ? null : tag.type;
      }
      return state;
    },
  };
}
