import { createHash } from "node:crypto";
import type { SemanticRevision } from "./model";
import { verifySemanticRevision, walkSemanticAtoms } from "./compose";
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
export type LegacyAliceEvidence={
  provenance:"legacy_observed"|"synthetic_legacy";
  work_id:string;work_slug:string;blocks:Array<{id:string;text:string}>;
  snapshot_ref:string;content_sha256:string;
};
export type TripleComparison={
  schema:"artales.semantic.triple-qa.v1";
  source_snapshot_ref:string;semantic_revision_ref:string;
  legacy_snapshot_ref:string|null;
  source_composition:"exact"|"blocked";
  legacy_status:"synthetic_comparison"|"legacy_evidence_required"|"source_drift";
  differences:Array<{kind:"missing_in_legacy"|"extra_in_legacy"|"unmatched_source";description:string}>;
  can_cutover:false;
};
export function compareAliceThreeWays(revision:SemanticRevision,legacy?:LegacyAliceEvidence):TripleComparison{
  verifySemanticRevision(revision);
  const composed=walkSemanticAtoms(revision.blocks).map(a=>a.raw).join("");
  // Include deliberate separator atoms for a complete, byte-faithful text view.
  const original=revision.source.normalized_text;
  const composedAll=[...walkSemanticAtoms(revision.blocks),...revision.gaps.map(g=>g.atom)]
    .sort((a,b)=>a.anchor.normalized_start-b.anchor.normalized_start).map(a=>a.raw).join("");
  if(composedAll!==original)throw new Error("Semantic source-composed diff failed.");
  void composed;
  if(!legacy)return{schema:"artales.semantic.triple-qa.v1",source_snapshot_ref:revision.source.source_snapshot_ref,
    semantic_revision_ref:revision.revision_ref,legacy_snapshot_ref:null,source_composition:"exact",
    legacy_status:"legacy_evidence_required",differences:[{kind:"unmatched_source",description:"Actual legacy Alice observed snapshot absent; cannot infer equality from work slug."}],can_cutover:false};
  if(legacy.work_id!==revision.work_id||legacy.work_slug!==revision.work_slug||
    hash(legacy.blocks)!==legacy.content_sha256||!legacy.snapshot_ref)
    throw new Error("Untrusted, cross-work or altered legacy snapshot.");
  const legacyText=legacy.blocks.map(x=>x.text).join("");
  const same=legacyText===original;
  return{schema:"artales.semantic.triple-qa.v1",source_snapshot_ref:revision.source.source_snapshot_ref,
    semantic_revision_ref:revision.revision_ref,legacy_snapshot_ref:legacy.snapshot_ref,
    source_composition:"exact",legacy_status:same&&legacy.provenance==="synthetic_legacy"?
      "synthetic_comparison":"source_drift",
    differences:same?[]:[{kind:"unmatched_source",description:"Legacy and Gutenberg bytes differ; manual alignment and edition review required."}],
    can_cutover:false};
}
export function syntheticLegacyFixture(revision:SemanticRevision):LegacyAliceEvidence{
  const blocks=[{id:"synthetic:legacy-alice:1",text:revision.source.normalized_text}];
  return{provenance:"synthetic_legacy",work_id:revision.work_id,work_slug:revision.work_slug,
    snapshot_ref:"fixture:synthetic-legacy-alice",blocks,content_sha256:hash(blocks)};
}
