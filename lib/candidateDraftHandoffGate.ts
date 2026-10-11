import type {TextRightsSnapshot} from "./rights/sourceTextEligibility";
/**
 * Server-side preflight inputs are loaded from trusted persisted records.
 * This module is NOT legal clearance: a caller must verify signatures, binary
 * hashes and rights ownership at the transactional database boundary.
 */
export type CapturedComponent = {
  componentId: string
  kind: "WORK_CONTENT" | "EDITION_CONTENT" | "TRANSLATION" | "ASSET" | "SOURCE_WRAPPER" | "EDITORIAL_ADDITION"
  sha256: string
  archiveRef: string
  included: boolean
  decision: "usable" | "exclude" | "blocked" | "review_required"
  evidenceSha256?: string
  rightsReviewedAt?: string
}
export type CaptureEnvelope = {
  candidateId: string
  candidateSourceId: string
  snapshotSetRef: string
  capturedAt: string
  sourceSha256: string
  components: CapturedComponent[]
  inventoryComplete: boolean
  attestationVerified: boolean
  provenanceReviewedAt?: string
  sourceUpdatedAt: string
}
export type CaptureBlocker =
  | "source_identity_missing" | "snapshot_missing" | "snapshot_hash_missing"
  | "capture_incomplete" | "capture_unattested" | "stale_provenance"
  | "original_text_missing" | "rights_evidence_missing"
  | "blocked_component_included" | "component_rights_not_clear"
const sha = (s: string | undefined) => !!s && /^[a-f0-9]{64}$/i.test(s)
const validDate = (s: string | undefined) => !!s && Number.isFinite(Date.parse(s))
const nonempty = (s: string | undefined) => !!s?.trim()
/**
 * Conservative static gate. Never returns an approval to publish, spend,
 * or bypass the DB's locked source/rights re-read.
 */
export function inspectCapturedSource(e: CaptureEnvelope): {eligibleForDraftHandoff: boolean; blockers: CaptureBlocker[]} {
  const b = new Set<CaptureBlocker>()
  if (!nonempty(e.candidateId) || !nonempty(e.candidateSourceId)) b.add("source_identity_missing")
  if (!nonempty(e.snapshotSetRef)) b.add("snapshot_missing")
  if (!sha(e.sourceSha256)) b.add("snapshot_hash_missing")
  if (!e.inventoryComplete || !e.components.length) b.add("capture_incomplete")
  if (!e.attestationVerified) b.add("capture_unattested")
  if (!validDate(e.provenanceReviewedAt) || !validDate(e.sourceUpdatedAt) ||
      Date.parse(e.provenanceReviewedAt!) < Date.parse(e.sourceUpdatedAt)) b.add("stale_provenance")
  if (!e.components.some(c => c.kind === "WORK_CONTENT" && c.included && c.decision === "usable")) b.add("original_text_missing")
  const seen = new Set<string>()
  for (const c of e.components) {
    if (!nonempty(c.componentId) || seen.has(c.componentId) ||
        !sha(c.sha256) || !nonempty(c.archiveRef)) b.add("capture_incomplete")
    seen.add(c.componentId)
    if (c.included && c.decision !== "usable") b.add("blocked_component_included")
    if (c.included && (!sha(c.evidenceSha256) || !validDate(c.rightsReviewedAt))) b.add("rights_evidence_missing")
    if (c.decision === "blocked" || c.decision === "review_required" ||
        (!c.included && c.decision !== "exclude")) b.add("component_rights_not_clear")
  }
  const blockers=[...b]
  return {eligibleForDraftHandoff:blockers.length===0,blockers}
}

/**
 * Mandatory second preflight for generic captured text before draft handoff.
 * Not a DB authorization: signed locked SQL must separately enforce the result.
 */
export function inspectTextRightsDraftHandoff(capture:CaptureEnvelope,rights:TextRightsSnapshot){
 const base=inspectCapturedSource(capture);
 const blockers:string[]=[...base.blockers];
 if(rights.candidate_id!==capture.candidateId||
  rights.source_sha256!==capture.sourceSha256||
  rights.captured_at!==capture.capturedAt||
  rights.decision!=="eligible_for_editorial_draft"||
  rights.publication_authorized!==false)blockers.push("text_rights_ineligible");
 if(rights.included.length===0||rights.included.some(id=>
  !capture.components.some(c=>c.componentId===id&&c.included&&c.decision==="usable")))
  blockers.push("included_component_mismatch");
 if(capture.components.some(c=>
  c.included&&!rights.included.includes(c.componentId))||
  rights.components.some(c=>c.action==="hold"&&capture.components.some(x=>x.componentId===c.id&&x.included)))
  blockers.push("excluded_or_held_component_included");
 return {eligibleForDraftHandoff:blockers.length===0,blockers:[...new Set(blockers)]};
}
