import type { WorkBlock } from "../blocks";
import type { WorkEditItem } from "../dbWorks";

/**
 * Observed legacy text from the signed-in editor's existing work read.
 * This is deliberately NOT a verified archived legacy snapshot or a semantic revision.
 * Do not use this adapter to approve text equality, legal status or publication.
 */
export const ALICE_LEGACY_SLUG = "alices-adventures-in-wonderland";

export type AliceLegacyWorkInput = Pick<WorkEditItem,
  "id" | "slug" | "status" | "source_label" | "source_reference" |
  "canonical_language" | "content" | "content_blocks"
>;
export type LegacyObservedBlock = Readonly<{
  id: string;
  type: WorkBlock["type"] | "fallback_text";
  content: string;
}>;
export type AliceObservedReadOnly = Readonly<{
  work_id: string;
  slug: typeof ALICE_LEGACY_SLUG;
  work_status: WorkEditItem["status"];
  source_reference: string;
  evidence_status: "unarchived_live_observation";
  blocks: readonly LegacyObservedBlock[];
  non_text_components: number;
  total_characters: number;
  has_legacy_content: boolean;
  can_cutover: false;
  publication_authorized: false;
  blockers: readonly string[];
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_OBSERVED_TEXT = 2_000_000;
const NON_TEXT = new Set<WorkBlock["type"]>(["image", "table"]);

/** 
 * Only the actual Gutenberg #11 English-language legacy Alice is in this pilot.
 * String/title similarity alone never establishes edition or source identity.
 */
export function observeExistingAliceReadOnly(work: AliceLegacyWorkInput): AliceObservedReadOnly {
  if (!UUID.test(work.id) || work.slug !== ALICE_LEGACY_SLUG ||
      !["published", "draft", "review", "archived"].includes(work.status) ||
      work.canonical_language !== "en" || work.source_label !== "gutenberg") {
    throw new Error("Existing Alice identity, language or source type not verified");
  }
  let source: URL;
  try { source = new URL(work.source_reference ?? ""); }
  catch { throw new Error("Existing Alice Gutenberg #11 reference required"); }
  if (source.protocol !== "https:" ||
      !["www.gutenberg.org", "gutenberg.org"].includes(source.hostname) ||
      source.pathname.replace(/\/$/, "") !== "/ebooks/11" || source.search || source.hash) {
    throw new Error("Existing Alice Gutenberg #11 reference required");
  }
  const sourceBlocks = Array.isArray(work.content_blocks) ? work.content_blocks : [];
  const blocks: LegacyObservedBlock[] = sourceBlocks.length
    ? sourceBlocks.map(block => {
        if (!block || typeof block.id !== "string" || !block.id ||
            typeof block.content !== "string") throw new Error("Malformed legacy block");
        return { id: block.id, type: block.type, content: block.content };
      })
    : work.content ? [{ id: "legacy:fallback-text", type: "fallback_text", content: work.content }] : [];
  if (new Set(blocks.map(b => b.id)).size !== blocks.length) {
    throw new Error("Duplicate legacy block identity");
  }
  const total_characters = blocks.reduce((sum, block) => sum + block.content.length, 0);
  if (total_characters > MAX_OBSERVED_TEXT) throw new Error("Legacy preview exceeds bounded text limit");
  const non_text_components = sourceBlocks.filter(block => NON_TEXT.has(block.type)).length;
  return {
    work_id: work.id, slug: ALICE_LEGACY_SLUG, work_status: work.status,
    source_reference: source.toString(),
    evidence_status: "unarchived_live_observation",
    blocks, non_text_components, total_characters,
    has_legacy_content: blocks.length > 0,
    can_cutover: false, publication_authorized: false,
    blockers: [
      "independent_cz_eu_rights_review_required",
      "real_pinned_source_capture_required",
      "immutable_legacy_observed_snapshot_required",
      "signed_semantic_revision_required",
      "independent_editorial_review_required",
      "release_gate_required",
    ],
  };
}
