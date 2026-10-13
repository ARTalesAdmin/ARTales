/** Read-only E1 reconciliation gate. Never accepts a fixture identity as a live work. */
export type ExistingWorkIdentity = Readonly<{
  id: string; slug: string; status: "published"|"draft"|"archived";
}>;
export type PinnedSourceEvidence = Readonly<{
  work_id: string; snapshot_ref: string; source_sha256: string;
  rights_state: "pending"|"review_required"|"blocked"|"verified";
}>;
export type DraftSemanticBinding = Readonly<{
  work_id: string; work_slug: string; snapshot_ref: string;
  source_sha256: string; revision_ref: string; release_allowed: false;
}>;
export type LegacyWorkReadiness = Readonly<{
  work_id: string; slug: string; snapshot_ref: string;
  revision_ref: string|null; can_edit: boolean;
  can_cutover: false; blockers: string[];
}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest=/^[a-f0-9]{64}$/i;
export function reconcileLegacyWorkReadOnly(
  work: ExistingWorkIdentity, source: PinnedSourceEvidence|null,
  draft: DraftSemanticBinding|null,
): LegacyWorkReadiness {
  if(!uuid.test(work.id)||!work.slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(work.slug))
    throw new Error("Existing persisted work identity required");
  const blockers:string[]=[];
  if(!source)blockers.push("pinned_source_required");
  else {
    if(source.work_id!==work.id)throw new Error("foreign pinned source work");
    if(source.snapshot_ref!=="sha256:"+source.source_sha256||!digest.test(source.source_sha256))
      throw new Error("untrusted pinned source digest");
    if(source.rights_state!=="verified")blockers.push("independent_rights_review_required");
  }
  if(!draft)blockers.push("semantic_revision_required");
  else {
    if(draft.work_id!==work.id||draft.work_slug!==work.slug)
      throw new Error("foreign semantic revision identity");
    if(!source||draft.snapshot_ref!==source.snapshot_ref||draft.source_sha256!==source.source_sha256)
      throw new Error("revision source mismatch");
    if(!/^sha256:[a-f0-9]{64}$/i.test(draft.revision_ref)||draft.release_allowed!==false)
      throw new Error("untrusted or release-enabled draft revision");
  }
  blockers.push("signed_revision_persistence_required","editorial_approval_required","release_gate_required","real_legacy_evidence_required");
  return Object.freeze({work_id:work.id,slug:work.slug,
    snapshot_ref:source?.snapshot_ref??"",revision_ref:draft?.revision_ref??null,
    can_edit:Boolean(source&&draft),can_cutover:false,blockers});
}
