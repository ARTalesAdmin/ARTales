import type {ReaderNote,ReaderNoteColor} from "../reader/readerStorage";
import type {SemanticPage,SemanticPageUnit,SemanticRevision,ReaderAnchorV2} from "./model";
import {locateReaderAnchor} from "./readerProjection";
import {findReaderAnchorPage,rebindReaderAnchor} from "./readerCompatibility";

/**
 * Ephemeral Reader QA session only. These are the existing canonical ReaderNote
 * fields plus a sidecar source anchor. NEVER save these to a browser key, account,
 * notes endpoint or database. Remount/reload deliberately clears the session.
 */
export type SessionReaderNote={note:ReaderNote;anchor:ReaderAnchorV2};
export type SessionReaderNoteInput={
  id:string;
  title:string;
  body:string;
  color:ReaderNoteColor;
  now:string;
  pageIndex:number;
  pageCount:number;
  layoutMode:"pagedFlow"|"spread";
};

export function noteAnchorForUnit(
  revision:SemanticRevision,unit:SemanticPageUnit,
):ReaderAnchorV2|null{
  if(unit.kind==="title_page")return null;
  const atomId=unit.fragment?.atom_id??unit.source_atom_ids[0];
  if(!atomId)return null;
  return locateReaderAnchor(revision,atomId,unit.fragment?.start??0);
}
export function createSessionReaderNote(
  revision:SemanticRevision,unit:SemanticPageUnit,input:SessionReaderNoteInput,
):SessionReaderNote{
  const anchor=noteAnchorForUnit(revision,unit);
  if(!anchor)throw Error("No literary content anchor for QA note.");
  if(!input.id||input.id.length>100||!input.id.trim()||
    !Number.isInteger(input.pageIndex)||input.pageIndex<0||
    !Number.isInteger(input.pageCount)||input.pageCount<=input.pageIndex||
    !Number.isFinite(Date.parse(input.now))||!Number.isFinite(input.pageCount)||
    input.title.length>160||input.body.length>4000||
    !["gold","blue","green","rose","violet"].includes(input.color))
    throw Error("Invalid QA note input.");
  const note:ReaderNote={
    id:input.id,slug:revision.work_slug,
    title:input.title.trim()||null,body:input.body.trim()||null,
    color:input.color,progressPercent:input.pageCount<=1?0:
      input.pageIndex/(input.pageCount-1)*100,
    scrollY:input.pageIndex,pageIndex:input.pageIndex,pageCount:input.pageCount,
    layoutMode:input.layoutMode,createdAt:input.now,updatedAt:input.now,source:"local",
  };
  return {note,anchor};
}
export type SessionReaderNoteLocation={
  status:"exact"|"blocked";
  pageIndex:number|null;
  unitId:string|null;
  anchor:ReaderAnchorV2|null;
  reason:string;
};
export function locateSessionReaderNote(
  revision:SemanticRevision,pages:readonly SemanticPage[],saved:SessionReaderNote,
):SessionReaderNoteLocation{
  if(saved.note.slug!==revision.work_slug)return {
    status:"blocked",pageIndex:null,unitId:null,anchor:null,reason:"work_slug_mismatch"};
  const rebased=rebindReaderAnchor(saved.anchor,revision);
  if(rebased.status!=="exact"||!rebased.anchor)return {
    status:"blocked",pageIndex:null,unitId:null,anchor:null,reason:rebased.reason};
  const location=findReaderAnchorPage(revision,pages,rebased.anchor);
  if(!location)return {
    status:"blocked",pageIndex:null,unitId:null,anchor:rebased.anchor,
    reason:"anchor_not_in_visible_projection"};
  return {status:"exact",pageIndex:location.pageIndex,unitId:location.unitId,
    anchor:rebased.anchor,reason:"same_content_anchor_after_reflow"};
}
