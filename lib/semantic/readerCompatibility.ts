import type {SemanticRevision,ReaderAnchorV2,SemanticPage,SemanticAtom} from "./model";
import {walkSemanticAtoms,verifySemanticRevision} from "./compose";
import {getSemanticPageUnits} from "./readerProjection";
import {normalizeReaderSettings,defaultReaderSettings,type ReaderSettings} from "../reader/readerSettings";
import type {ReaderNote,ReaderBookmark,ReaderProgress} from "../reader/readerStorage";
import {getProfileReaderSettings,type FixtureProfileReaderDefaults} from "../fixtures/readerPreferences";

export type ReaderStateKind="note"|"bookmark"|"progress";
export type AnchorConfidence="exact"|"approximate"|"blocked";
export type ExactSourceEvidence={
  snapshot_ref:string;
  component_id:string;
  original_byte_offset:number;
};
export type ReaderLegacyState = ReaderNote | ReaderBookmark | ReaderProgress;
export type SemanticReaderStateBridge<T extends ReaderLegacyState> = {
  schema:"artales.semantic.reader-compat.v1";
  kind:ReaderStateKind;
  /** An untouched canonical Reader note/bookmark/progress record, retained for fallback. */
  legacy:T;
  anchor:ReaderAnchorV2|null;
  confidence:AnchorConfidence;
  reason:string;
};

const relevantAtoms=(rev:SemanticRevision)=>{
  // Literary atoms only. Source-only newline gaps and synthetic title pages
  // do not create note/bookmark targets.
  return walkSemanticAtoms(rev.blocks);
};
function anchorForAtom(revision:SemanticRevision,atom:SemanticAtom,offset:number):ReaderAnchorV2 {
  return {
    work_id:revision.work_id,work_slug:revision.work_slug,revision_ref:revision.revision_ref,
    snapshot_ref:atom.anchor.snapshot_ref,component_id:atom.anchor.component_id,atom_id:atom.id,
    original_byte_start:atom.anchor.original_byte_start,original_byte_end:atom.anchor.original_byte_end,
    offset_in_atom:offset,
  };
}

/** Legacy page number is never a verified source offset. Preserve it as fallback. */
export function bridgeLegacyReaderState<T extends ReaderLegacyState>(
  revision:SemanticRevision,kind:ReaderStateKind,legacy:T,
  options:{evidence?:ExactSourceEvidence;expectedUserId?:string}={},
):SemanticReaderStateBridge<T> {
  verifySemanticRevision(revision);
  const base={schema:"artales.semantic.reader-compat.v1" as const,kind,legacy};
  if(legacy.slug!==revision.work_slug)return {...base,anchor:null,confidence:"blocked",reason:"work_slug_mismatch"};
  if(kind==="note"){
    const note=legacy as ReaderNote;
    if(!note.id||!note.createdAt||!note.updatedAt)
      return {...base,anchor:null,confidence:"blocked",reason:"invalid_note_identity"};
    if(options.expectedUserId&&note.userId&&note.userId!==options.expectedUserId)
      return {...base,anchor:null,confidence:"blocked",reason:"user_scope_mismatch"};
  }
  const atoms=relevantAtoms(revision);
  if(options.evidence){
    const proof=options.evidence;
    if(!Number.isInteger(proof.original_byte_offset)||proof.original_byte_offset<0||
      proof.snapshot_ref!==revision.source.source_snapshot_ref||
      proof.component_id!==revision.source.component_id)
      return {...base,anchor:null,confidence:"blocked",reason:"unverifiable_source_evidence"};
    const atom=atoms.find(a=>a.anchor.snapshot_ref===proof.snapshot_ref &&
      a.anchor.component_id===proof.component_id&&
      a.anchor.original_byte_start<=proof.original_byte_offset &&
      proof.original_byte_offset<a.anchor.original_byte_end);
    if(!atom)return {...base,anchor:null,confidence:"blocked",reason:"source_offset_outside_literary_atom"};
    // Original byte offset to exact UTF-16 character offset needs archived
    // byte-level codepoint mapping. Do not pretend a Unicode byte count is a char count.
    if(proof.original_byte_offset!==atom.anchor.original_byte_start)
      return {...base,anchor:anchorForAtom(revision,atom,0),confidence:"approximate",
        reason:"byte_span_verified_interior_offset_requires_raw_byte_map"};
    return {...base,anchor:anchorForAtom(revision,atom,0),confidence:"exact",reason:"source_start_verified"};
  }
  if(!Number.isFinite(legacy.progressPercent)||legacy.progressPercent<0||
    legacy.progressPercent>100)return {...base,anchor:null,confidence:"blocked",reason:"invalid_legacy_progress"};
  if(!atoms.length)return {...base,anchor:null,confidence:"blocked",reason:"no_semantic_source_atoms"};
  const idx=Math.min(atoms.length-1,Math.floor(legacy.progressPercent/100*(atoms.length-1)));
  return {...base,anchor:anchorForAtom(revision,atoms[idx],0),confidence:"approximate",
    reason:"page_percent_only_original_position_preserved"};
}

/** Rebase a stable content anchor after editorial typography or title-page review.
 * Revision hashes may differ, but the source identity and per-atom bytes must agree.
 */
export function rebindReaderAnchor(
  previous:ReaderAnchorV2,revision:SemanticRevision,
):{status:"exact"|"blocked";anchor:ReaderAnchorV2|null;reason:string}{
  verifySemanticRevision(revision);
  if(previous.work_id!==revision.work_id||previous.work_slug!==revision.work_slug)
    return {status:"blocked",anchor:null,reason:"work_identity_changed"};
  if(previous.snapshot_ref!==revision.source.source_snapshot_ref||
    previous.component_id!==revision.source.component_id)
    return {status:"blocked",anchor:null,reason:"source_snapshot_changed"};
  const atom=relevantAtoms(revision).find(x=>x.id===previous.atom_id);
  if(!atom||
    atom.anchor.original_byte_start!==previous.original_byte_start||
    atom.anchor.original_byte_end!==previous.original_byte_end||
    !Number.isInteger(previous.offset_in_atom)||previous.offset_in_atom<0||
    previous.offset_in_atom>atom.raw.length)
    return {status:"blocked",anchor:null,reason:"original_atom_changed"};
  return {status:"exact",anchor:anchorForAtom(revision,atom,previous.offset_in_atom),
    reason:"same_immutable_source_atom"};
}

/** Resolve a note/bookmark by immutable content, not obsolete page index. */
export function findReaderAnchorPage(
  revision:SemanticRevision,pages:readonly SemanticPage[],anchor:ReaderAnchorV2,
):{pageIndex:number;unitId:string}|null{
  const rebased=rebindReaderAnchor(anchor,revision);
  if(rebased.status!=="exact")return null;
  for(const page of pages){
    for(const unit of page.units){
      if(!unit.source_atom_ids.includes(anchor.atom_id))continue;
      if(unit.fragment){
        if(unit.fragment.atom_id!==anchor.atom_id||
          anchor.offset_in_atom<unit.fragment.start ||
          anchor.offset_in_atom>=unit.fragment.end)continue;
      }
      return {pageIndex:page.index,unitId:unit.id};
    }
  }
  // At the exclusive end of an atom, prefer its last displayed fragment.
  const atom=relevantAtoms(revision).find(a=>a.id===anchor.atom_id);
  if(atom&&anchor.offset_in_atom===atom.raw.length){
    for(let i=pages.length-1;i>=0;i--){
      const last=pages[i].units.findLast(unit=>unit.source_atom_ids.includes(anchor.atom_id));
      if(last)return {pageIndex:pages[i].index,unitId:last.id};
    }
  }
  return null;
}

export type CanonicalSemanticPreferences={
  settings:ReaderSettings;
  authority:"device"|"profile"|"default";
  effectiveLayout:"scroll"|"spread";
};
/** The same normalized ReaderSettings shape used by /reader and /account/settings.
 * Never store the QA-only airy density or a third public `paged` mode.
 */
export function resolveSemanticReaderPreferences(input:{
  savedDeviceSettings?:ReaderSettings|null;
  profileDefaults?:FixtureProfileReaderDefaults|null;
  physicalViewportWidth:number;
}):CanonicalSemanticPreferences {
  if(!Number.isFinite(input.physicalViewportWidth)||input.physicalViewportWidth<=0)
    throw Error("Invalid physical Reader viewport");
  const profile=getProfileReaderSettings(input.profileDefaults);
  const authority=input.savedDeviceSettings?"device":profile?"profile":"default";
  const settings=normalizeReaderSettings(input.savedDeviceSettings??profile??defaultReaderSettings);
  return {settings,authority,effectiveLayout:settings.layoutMode==="spread" &&
    input.physicalViewportWidth>=700?"spread":"scroll"};
}

/** Notes and bookmarks retain complete original fields; no implicit account writes.
 * A sidecar is required for durable anchors in main-thread DB and user scope.
 */
export function preservedLegacyReaderState<T extends ReaderLegacyState>(
  entry:SemanticReaderStateBridge<T>,
):T{
  return entry.legacy;
}

export function assertNoReaderStateMutation<T extends ReaderLegacyState>(
  expected:T,actual:T,
){
  if(JSON.stringify(expected)!==JSON.stringify(actual))
    throw Error("Legacy Reader state must be preserved losslessly.");
  return true as const;
}

/** Editorial contract: anchors always originate from real source units.
 * This diagnostic never examines auth tokens or reads user account notes.
 */
export function getReaderAnchorableAtomIds(revision:SemanticRevision):string[] {
  verifySemanticRevision(revision);
  return getSemanticPageUnits(revision).flatMap(unit=>unit.source_atom_ids);
}
