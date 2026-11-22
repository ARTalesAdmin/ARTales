import type { CSSProperties } from "react";
import { WORK_BLOCK_TYPES, type WorkBlockType } from "@/lib/blocks";

export const LEGACY_BLOCK_STYLE_FIELDS = [
  "font_family", "font_size_em", "line_height", "text_align",
  "text_indent_em", "space_before_em", "space_after_em",
  "hyphenation", "page_break_before", "own_page", "keep_together",
] as const;

export type LegacyBlockStyle = {
  font_family: "serif" | "sans" | "mono";
  /** Multiplier of the Reader's user-selected base font size. */
  font_size_em: number;
  line_height: number;
  text_align: "left" | "center" | "right" | "justify";
  text_indent_em: number;
  space_before_em: number;
  space_after_em: number;
  hyphenation: "auto" | "manual" | "none";
  /** Begin this block on a fresh Reader page. */
  page_break_before: boolean;
  /** The block occupies a dedicated Reader page. */
  own_page: boolean;
  /** Avoid dividing the block when the content fits on one page. */
  keep_together: boolean;
};
export type LegacyBlockStyleMap = Record<WorkBlockType, LegacyBlockStyle>;

const base: LegacyBlockStyle = {
  font_family: "serif", font_size_em: 1, line_height: 1.62,
  text_align: "left", text_indent_em: 0,
  space_before_em: 0, space_after_em: 1.25,
  hyphenation: "manual", page_break_before: false, own_page: false,
  keep_together: false,
};

/** Canonical built-in profiles. Staff edits in the DB override these values. */
const variants: Partial<Record<WorkBlockType, Partial<LegacyBlockStyle>>> = {
  book_part: { font_size_em: 2.2, line_height: 1.12, text_align: "center", space_before_em: 3.5, space_after_em: 2, page_break_before: true, keep_together: true },
  chapter: { font_size_em: 1.8, line_height: 1.18, text_align: "center", space_before_em: 3, space_after_em: 1.75, page_break_before: true, keep_together: true },
  paragraph: { text_align: "justify", text_indent_em: 1.2, space_after_em: .95, hyphenation: "auto" },
  headline: { font_size_em: 1.35, line_height: 1.28, text_align: "center", space_before_em: 2, space_after_em: .85, keep_together: true },
  quote: { font_size_em: 1.03, line_height: 1.62, text_align: "justify", space_before_em: 1.75, space_after_em: 1.75 },
  poem: { line_height: 1.72, text_align: "left", space_before_em: 1.75, space_after_em: 1.75, hyphenation: "none" },
  letter: { line_height: 1.58, text_align: "justify", space_before_em: 2, space_after_em: 2 },
  newspaper_article: { font_size_em: .96, line_height: 1.52, text_align: "justify", space_before_em: 2, space_after_em: 2 },
  place_line: { text_align: "center", space_before_em: 1.6, space_after_em: 1, keep_together: true },
  separator: { text_align: "center", space_before_em: 2.25, space_after_em: .2, keep_together: true },
  note: { font_size_em: .94, line_height: 1.62, space_before_em: .8, space_after_em: 1.25 },
  footnote: { font_size_em: .94, line_height: 1.55, space_before_em: .8, space_after_em: 1.25 },
  dedication: { text_align: "center", space_before_em: 2.25, space_after_em: 2.25, keep_together: true },
  preface: { text_align: "center", space_before_em: 2.75, space_after_em: 2, hyphenation: "auto" },
  afterword: { text_align: "center", space_before_em: 2.75, space_after_em: 2, hyphenation: "auto" },
  acknowledgement: { text_align: "center", space_before_em: 2.75, space_after_em: 2 },
  image: { text_align: "center", space_before_em: 2, space_after_em: 2, keep_together: true },
  table: { font_size_em: .96, line_height: 1.5, space_before_em: 2, space_after_em: 2 },
};

export const DEFAULT_LEGACY_BLOCK_STYLES: LegacyBlockStyleMap = Object.fromEntries(
  WORK_BLOCK_TYPES.map(type => [type, Object.freeze({ ...base, ...variants[type] })])
) as LegacyBlockStyleMap;

export function isLegacyBlockType(value: string): value is WorkBlockType {
  return WORK_BLOCK_TYPES.some(type => type === value);
}

function validNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}
export function parseLegacyBlockStyle(type: WorkBlockType, data: unknown): LegacyBlockStyle | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const input = data as Record<string, unknown>;
  if (Object.keys(input).some(key => !(LEGACY_BLOCK_STYLE_FIELDS as readonly string[]).includes(key))) return null;
  const value = { ...DEFAULT_LEGACY_BLOCK_STYLES[type], ...input };
  if (!["serif", "sans", "mono"].includes(value.font_family) ||
      !validNumber(value.font_size_em, .7, 2.8) ||
      !validNumber(value.line_height, 1, 2.6) ||
      !["left", "center", "right", "justify"].includes(value.text_align) ||
      !validNumber(value.text_indent_em, 0, 4) ||
      !validNumber(value.space_before_em, 0, 7) ||
      !validNumber(value.space_after_em, 0, 7) ||
      !["none", "manual", "auto"].includes(value.hyphenation) ||
      typeof value.page_break_before !== "boolean" ||
      typeof value.own_page !== "boolean" ||
      typeof value.keep_together !== "boolean") return null;
  return value as LegacyBlockStyle;
}

export function legacyBlockStyleVars(style: LegacyBlockStyle): CSSProperties {
  const fonts = {
    serif: 'Georgia, "Times New Roman", serif',
    sans: 'Arial, Helvetica, sans-serif',
    mono: '"Courier New", Courier, monospace',
  };
  return {
    "--artales-block-font": fonts[style.font_family],
    "--artales-block-size": style.font_size_em + "em",
    "--artales-block-leading": String(style.line_height),
    "--artales-block-align": style.text_align,
    "--artales-block-indent": style.text_indent_em + "em",
    "--artales-block-before": style.space_before_em + "em",
    "--artales-block-after": style.space_after_em + "em",
    "--artales-block-hyphens": style.hyphenation,
    breakBefore: style.page_break_before || style.own_page ? "page" : undefined,
    breakAfter: style.own_page ? "page" : undefined,
    breakInside: style.keep_together || style.own_page ? "avoid" : "auto",
  } as CSSProperties;
}

export function legacyBlockWeightMultiplier(style: LegacyBlockStyle): number {
  return style.font_size_em * style.line_height / base.line_height;
}
