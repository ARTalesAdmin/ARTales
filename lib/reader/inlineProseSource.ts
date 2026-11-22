/** Lossless offsets for the inline text rendered by WorkContentRenderer.
 * This is a source map, NOT a second renderer. Only well-formed <em>/<i>
 * markup is interpreted; other tags remain literal, as in the renderer.
 * Multiple original paragraphs are permitted only when each is independently
 * mappable to one rendered <p>. The DOM layer verifies that correspondence.
 */
export type LegacyInlineSourcePart = {
  /** Exact textContent of this rendered paragraph. */
  text: string;
  /** UTF-16 offset of this paragraph in the normalized visible prose. */
  textStart: number;
  /** UTF-16 bounds in the original, immutable source. */
  sourceStart: number;
  sourceEnd: number;
};

export type LegacyInlineSource = {
  visibleText: string;
  parts: ReadonlyArray<LegacyInlineSourcePart>;
  sourceOffsetAtTextOffset: (offset: number) => number | null;
  activeTagAtSourceOffset: (offset: number) => "em" | "i" | null;
};

type InlineTag = {
  end: number;
  type: "em" | "i";
  closing: boolean;
};

type TextSlice = {
  sourceStart: number;
  textStart: number;
  textEnd: number;
};

type ParsedPart = {
  text: string;
  sourceStart: number;
  sourceEnd: number;
  slices: TextSlice[];
  tags: InlineTag[];
};

/** Parse one paragraph exactly like renderInlineRichText: trim surrounding
 * whitespace, decode escaped emphasis delimiters and keep other tags literal.
 */
function parsePart(raw: string, rawStart: number): ParsedPart | null {
  const leading = raw.length - raw.trimStart().length;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const sourceStart = rawStart + leading;
  const sourceEnd = sourceStart + trimmed.length;
  const tokens = /<\s*(\/?)\s*(em|i)\s*>|&lt;(\/?(?:em|i))&gt;/gi;
  const slices: TextSlice[] = [];
  const tags: InlineTag[] = [];
  let text = "";
  let cursor = 0;
  let active: "em" | "i" | null = null;
  const append = (from: number, until: number) => {
    if (from >= until) return;
    const chunk = trimmed.slice(from, until);
    // Unknown markup is LITERAL text in WorkContentRenderer, never HTML.
    // The DOM textContent equality check is the final source-map gate.
    slices.push({
      sourceStart: sourceStart + from,
      textStart: text.length,
      textEnd: text.length + chunk.length,
    });
    text += chunk;
  };
  let token: RegExpExecArray | null;
  while ((token = tokens.exec(trimmed)) !== null) {
    append(cursor, token.index);
    const escaped = token[3]?.toLowerCase();
    const type = (token[2]?.toLowerCase() || escaped?.replace("/", "")) as "em" | "i";
    const closing = token[1] === "/" || Boolean(escaped?.startsWith("/"));
    if (closing) {
      if (active !== type) return null;
      active = null;
    } else {
      if (active !== null) return null;
      active = type;
    }
    tags.push({ end: sourceStart + tokens.lastIndex, type, closing });
    cursor = tokens.lastIndex;
  }
  append(cursor, trimmed.length);
  if (active !== null || !text.trim()) return null;
  return { text, sourceStart, sourceEnd, slices, tags };
}

export function parseLegacyInlineProse(source: string): LegacyInlineSource | null {
  if (!source || !source.trim() || /\r/.test(source)) return null;
  // WorkContentRenderer uses split(/\n{2,}/), trim and filter(Boolean).
  // Preserve ALL delimiters in source offsets; normalized visible prose uses
  // precisely two separators to represent adjacent rendered <p> elements.
  const partRanges: Array<{ start: number; end: number }> = [];
  let start = 0;
  for (const match of source.matchAll(/\n{2,}/g)) {
    partRanges.push({ start, end: match.index! });
    start = match.index! + match[0].length;
  }
  partRanges.push({ start, end: source.length });

  const parsedParts: ParsedPart[] = [];
  for (const range of partRanges) {
    const raw = source.slice(range.start, range.end);
    if (!raw.trim()) continue;
    const parsed = parsePart(raw, range.start);
    if (!parsed) return null;
    parsedParts.push(parsed);
  }
  if (!parsedParts.length) return null;

  const parts: LegacyInlineSourcePart[] = [];
  const slices: TextSlice[] = [];
  let visibleText = "";
  for (const part of parsedParts) {
    if (parts.length) visibleText += "\n\n";
    const textStart = visibleText.length;
    parts.push({
      text: part.text, textStart,
      sourceStart: part.sourceStart,
      sourceEnd: part.sourceEnd,
    });
    for (const slice of part.slices) slices.push({
      ...slice,
      textStart: slice.textStart + textStart,
      textEnd: slice.textEnd + textStart,
    });
    visibleText += part.text;
  }

  return {
    visibleText,
    parts,
    sourceOffsetAtTextOffset(offset) {
      if (!Number.isInteger(offset) || offset <= 0 || offset > visibleText.length) return null;
      // A discretionary cut after punctuation may advance across a paragraph
      // separator. Map that exact visible boundary to the next source part.
      for (const part of parts) {
        if (part.textStart === offset) return part.sourceStart;
      }
      for (const slice of slices) {
        if (offset > slice.textStart && offset <= slice.textEnd) {
          return slice.sourceStart + offset - slice.textStart;
        }
      }
      return null;
    },
    activeTagAtSourceOffset(offset) {
      if (!Number.isInteger(offset) || offset < 0 || offset > source.length) return null;
      const part = parsedParts.find(p => offset >= p.sourceStart && offset <= p.sourceEnd);
      if (!part) return null;
      let state: "em" | "i" | null = null;
      for (const tag of part.tags) {
        if (tag.end > offset) break;
        state = tag.closing ? null : tag.type;
      }
      return state;
    },
  };
}

/** Reader blocks whose content is rendered as direct <p> descendants.
 * The DOM measurement verifies exact source-to-text correspondence before
 * splitting; headings, media and letter metadata stay on their safe paths. */
const LEGACY_MEASURABLE_PROSE = new Set([
  "paragraph", "quote", "newspaper_article", "preface",
  "afterword", "acknowledgement",
]);
export function isLegacyMeasurableProse(type:string):boolean{
  return LEGACY_MEASURABLE_PROSE.has(type);
}
