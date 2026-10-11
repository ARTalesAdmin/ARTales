/**
 * ARTales Semantic Reader / Composer v2.
 * This is NOT WorkBlock JSON. Immutable revision identity and source provenance
 * are separate from layout, page indexes and legacy work identity.
 */
export const SEMANTIC_SCHEMA = "artales.semantic-text.v2" as const;

export type InlineMarkKind = "italic" | "bold" | "emphasis" | "small_caps" |
  "indent" | "hard_break" | "page_break_before";
export type InlineMark = {
  kind: InlineMarkKind;
  start: number; // UTF-16 offsets within the exact atom, [start, end)
  end: number;
  amount?: "small" | "medium" | "large"; // for indent only
};
export type SourceAnchorV2 = {
  snapshot_ref: string;
  component_id: string;
  normalized_start: number; // relative to this approved component
  normalized_end: number;
  original_byte_start: number; // original archived UTF-8 bytes, [start, end)
  original_byte_end: number;
};
export type SemanticAtom = {
  id: string;                // stable source-anchored ID across style revisions
  raw: string;               // exact source substring; no implicit .trim()
  anchor: SourceAnchorV2;
  source_sha256: string;     // hash of original raw fragment
  marks: InlineMark[];      // bounded display intent, never arbitrary HTML/CSS
};
export type SemanticGap = {
  kind: "source_gap";
  atom: SemanticAtom;       // preserved separators and soft line boundaries
  role: "paragraph_gap" | "stanza_gap" | "line_break" | "unclassified";
};
export type SemanticTextBlock = {
  kind: "paragraph" | "quote" | "epigraph" | "footnote";
  id: string;
  atom: SemanticAtom;
  footnote_label?: string;
};
export type SemanticVerseLine = { kind: "verse_line"; atom: SemanticAtom };
export type SemanticStanza = {
  kind: "stanza";
  id: string;
  lines: SemanticVerseLine[];
};
export type SemanticPoem = {
  kind: "poem";
  id: string;
  stanzas: SemanticStanza[];
  /** source-anchored exact poem span; not an extra text leaf */
  anchor: SourceAnchorV2;
  layout: "stanza_natural" | "stanza_airy";
};
export type SemanticSection = {
  kind: "chapter" | "section";
  id: string;
  heading: SemanticAtom;
  children: SemanticNode[];
};
export type SemanticNode = SemanticTextBlock | SemanticPoem | SemanticSection;
export type SemanticSource = {
  source_snapshot_ref: string;
  source_bytes_sha256: string;
  component_id: string;
  original_byte_start: number;
  original_byte_end: number;
  normalized_text: string;
  normalized_text_sha256: string;
};
export type SemanticRevision = {
  schema: typeof SEMANTIC_SCHEMA;
  work_id: string;                  // stable work UUID for real handoffs, synthetic in tests
  work_slug: string;
  source: SemanticSource;
  blocks: SemanticNode[];
  gaps: SemanticGap[];
  revision_sha256: string;          // content hash includes parent & edition recipe
  revision_ref: string;
  parent_revision_ref: string | null;
  composer_recipe: "semantic-deterministic-v2.0";
  round: number;
  review_issues: SemanticReviewIssue[];
  state: "draft_qa_only";
  release_allowed: false;
};
export type SemanticReviewIssue = {
  id: string;
  parent_revision_ref: string;
  round: number;
  target_atom_id: string;
  kind: "typography" | "verse_spacing" | "structure" | "readability";
  reason: string;
  requested_layout: "stanza_airy" | "stanza_natural" | "indent_small" | "indent_medium" | "indent_large";
  disposition: "returned_for_changes";
  source_anchor: SourceAnchorV2;
};
export type SemanticPageUnit = {
  id: string;
  kind: "chapter_heading" | "section_heading" | "paragraph" | "quote" | "epigraph" | "footnote" | "poem";
  node: SemanticTextBlock | SemanticPoem | SemanticSection;
  chapter_id: string | null;
  source_atom_ids: string[];
  estimated_height: number;
};
export type SemanticPage = {
  index: number;
  units: SemanticPageUnit[];
  overflow: "none" | "scroll_unit";
  estimated_height: number;
};
export type ReaderAnchorV2 = {
  work_id: string;
  work_slug: string;
  revision_ref: string;
  snapshot_ref: string;
  component_id: string;
  atom_id: string;
  original_byte_start: number;
  original_byte_end: number;
  offset_in_atom: number;
};
