import { inspectLegacyCutover, type LegacyCutoverProof } from "./releasePreflight";
import type { SemanticRevision, ReaderAnchorV2 } from "../semantic/model";
import { verifySemanticRevision } from "../semantic/compose";
import {
  projectSemanticReader, verifyReaderProjection, remapLegacyPosition,
  type LegacyPosition,
} from "../semantic/readerProjection";

export type ExistingReaderIdentity = Readonly<{
  work_id: string;
  slug: string;
  status: "published" | "draft" | "review" | "archived";
  work_version: number;
}>;

export type ObservedReaderState = Readonly<{
  kind: "progress" | "bookmark" | "note";
  id: string;
  position: LegacyPosition;
  /** Only archival evidence, never a client claim for a future signed RPC. */
  verified_source_position?: Readonly<{
    snapshot_ref: string;
    component_id: string;
    original_byte_offset: number;
  }>;
}>;

export type ReaderCutoverDryRunInput = Readonly<{
  existing: ExistingReaderIdentity;
  revision: SemanticRevision;
  legacy_observed_sha256: string | null;
  comparison: LegacyCutoverProof["sourceComparison"];
  recorded_reader_state_count: number;
  reader_state_inventory_complete: boolean;
  reader_states: readonly ObservedReaderState[];
  preserve_original_positions: boolean;
  /** Both browser modes must be explicitly reviewed, independently of CI projection tests. */
  manual_reader_qa: Readonly<{full: boolean; preview: boolean}>;
}>;

export type ReaderStateRemap = Readonly<{
  kind: ObservedReaderState["kind"];
  id: string;
  status: "exact" | "approximate" | "blocked";
  anchor: ReaderAnchorV2 | null;
  original: LegacyPosition;
  reason: string;
}>;

export type ReaderCutoverDryRunResult = Readonly<{
  status: "shadow_ready" | "blocked";
  blockers: readonly string[];
  work_id: string;
  slug: string;
  current_work_version: number;
  target_revision_ref: string;
  source_snapshot_ref: string;
  projection_qa: Readonly<{
    paged: { pages: number; units: number };
    spread: { pages: number; units: number };
    scroll: { pages: number; units: number };
  }>;
  reader_states: readonly ReaderStateRemap[];
  mapping: Readonly<{exact: number; approximate: number; blocked: number}>;
  /**
   * This is not a publishable pointer nor a database transaction.
   * A later signed server release must independently recheck all conditions.
   */
  publication_authorized: false;
  public_reader_changed: false;
  rollback_preserves_legacy: true;
}>;

const validVersion = (x: number) => Number.isSafeInteger(x) && x >= 0;

/**
 * Inspect a full semantic reader shadow, including legacy-note migration.
 * Never switch a public release pointer, mutate work content or reader state.
 */
export function inspectReaderCutoverDryRun(
  input: ReaderCutoverDryRunInput,
): ReaderCutoverDryRunResult {
  const {existing,revision} = input;
  verifySemanticRevision(revision);
  const blockers: string[] = [];
  if (!existing.work_id || !existing.slug ||
      existing.work_id !== revision.work_id || existing.slug !== revision.work_slug) {
    blockers.push("work_identity_changed");
  }
  if (existing.status !== "published") blockers.push("existing_public_work_not_published");
  if (!validVersion(existing.work_version)) blockers.push("invalid_work_version");
  if (!input.manual_reader_qa.full || !input.manual_reader_qa.preview) {
    blockers.push("browser_reader_qa_missing");
  }
  if (!input.reader_state_inventory_complete ||
      !validVersion(input.recorded_reader_state_count) ||
      input.recorded_reader_state_count !== input.reader_states.length) {
    blockers.push("reader_state_inventory_incomplete");
  }
  if (!input.preserve_original_positions) blockers.push("reader_position_fallback_missing");
  const seen = new Set<string>();
  for (const state of input.reader_states) {
    if (!state.id || seen.has(state.kind + ":" + state.id)) {
      blockers.push("invalid_or_duplicate_reader_state");
      break;
    }
    seen.add(state.kind + ":" + state.id);
  }

  const layouts = {
    paged: {mode:"paged" as const,viewport_width:420,viewport_height:760,font_scale:1},
    spread: {mode:"spread" as const,viewport_width:710,viewport_height:850,font_scale:1},
    scroll: {mode:"scroll" as const,viewport_width:420,viewport_height:760,font_scale:1},
  };
  const paged = verifyReaderProjection(revision,projectSemanticReader(revision,layouts.paged));
  const spread = verifyReaderProjection(revision,projectSemanticReader(revision,layouts.spread));
  const scroll = verifyReaderProjection(revision,projectSemanticReader(revision,layouts.scroll));

  const reader_states: ReaderStateRemap[] = input.reader_states.map(state => {
    const mapped = remapLegacyPosition(revision,state.position,state.verified_source_position);
    return {
      id:state.id,kind:state.kind,status:mapped.status,
      anchor:mapped.anchor,original:mapped.retained_legacy,reason:mapped.reason,
    };
  });
  const counts = {
    exact:reader_states.filter(x=>x.status==="exact").length,
    approximate:reader_states.filter(x=>x.status==="approximate").length,
    blocked:reader_states.filter(x=>x.status==="blocked").length,
  };
  if (counts.blocked) blockers.push("unmapped_reader_positions");
  const proof: LegacyCutoverProof = {
    workId:existing.work_id,slug:existing.slug,
    proposedWorkId:revision.work_id,proposedSlug:revision.work_slug,
    legacyObservedSha256:input.legacy_observed_sha256,
    rawSourceSha256:revision.source.source_bytes_sha256,
    sourceComparison:input.comparison,
    newSemanticTextSha256:revision.source.normalized_text_sha256,
    readerQaTextSha256:revision.source.normalized_text_sha256,
    readerQaPassed:input.manual_reader_qa.full && input.manual_reader_qa.preview,
    originalReaderStateCount:input.recorded_reader_state_count,
    mappedReaderStateCount:counts.exact,
    approximateLocationCount:counts.approximate,
    originalPositionFallbackKept:input.preserve_original_positions,
  };
  blockers.push(...inspectLegacyCutover(proof).blockers);
  return {
    status:blockers.length===0?"shadow_ready":"blocked",
    blockers:[...new Set(blockers)],
    work_id:existing.work_id,slug:existing.slug,
    current_work_version:existing.work_version,
    target_revision_ref:revision.revision_ref,
    source_snapshot_ref:revision.source.source_snapshot_ref,
    projection_qa:{
      paged:{pages:paged.pages,units:paged.units},
      spread:{pages:spread.pages,units:spread.units},
      scroll:{pages:scroll.pages,units:scroll.units},
    },
    reader_states,mapping:counts,
    publication_authorized:false,
    public_reader_changed:false,
    rollback_preserves_legacy:true,
  };
}
