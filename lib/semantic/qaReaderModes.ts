import type {SemanticPage,SemanticPageUnit} from "./model";

export type QaSurface="editor"|"reader";
export type QaReaderMode="scroll"|"spread";
export type QaProjectionMode="paged"|"scroll"|"spread";

/** Canonical account Reader has pagedFlow (continuous) or spread, not an editor-only paged switch. */
export function resolveQaProjectionMode(surface:QaSurface,readerMode:QaReaderMode,
  simulatedWidth:number,deviceWidth:number):QaProjectionMode{
  if(surface==="editor")return "paged";
  return readerMode==="spread"&&simulatedWidth>=700&&deviceWidth>=700?"spread":"scroll";
}

export function semanticUnitSourceRange(unit:SemanticPageUnit):[number,number]|null{
  if(unit.fragment)return [unit.fragment.normalized_start,unit.fragment.normalized_end];
  if(unit.kind==="chapter_heading"||unit.kind==="section_heading"){
    if("heading" in unit.node)return [unit.node.heading.anchor.normalized_start,
      unit.node.heading.anchor.normalized_end];
    return null;
  }
  if(unit.kind==="poem"&&unit.node.kind==="poem"){
    const atoms=unit.node.stanzas.flatMap(s=>s.lines.map(l=>l.atom));
    if(!atoms.length)return null;
    return [atoms[0].anchor.normalized_start,atoms.at(-1)!.anchor.normalized_end];
  }
  if("atom" in unit.node)return [unit.node.atom.anchor.normalized_start,unit.node.atom.anchor.normalized_end];
  return null; // synthetic title page has no Gutenberg text anchor
}

/** Approximate scroll location from real source-weighted page content, not page numbers. */
export function sourceOffsetForReaderPage(pages:SemanticPage[],pageIndex:number,progress:number):number{
  if(!Number.isInteger(pageIndex)||pageIndex<0||pageIndex>=pages.length)throw Error("Invalid QA page.");
  if(!Number.isFinite(progress))throw Error("Invalid QA page progress.");
  const ranges=pages[pageIndex].units.map(semanticUnitSourceRange).filter((s):s is [number,number]=>Boolean(s));
  if(!ranges.length)return 0;
  const start=ranges[0][0],end=ranges.at(-1)![1];
  const ratio=Math.min(1,Math.max(0,progress));
  return Math.floor(start+(end-start)*ratio);
}


export type SemanticSourceRegion={
  /** Null means source-only whitespace/separator material between source blocks. */
  regionIndex:number|null;
  unitId:string|null;
  start:number;
  end:number;
  text:string;
};

/** One exact copy of original bytes-as-normalized-text, segmented at source anchors.
 * Regions let the existing pairedScroll machinery align original and composed
 * typography without guessing page numbers or dropping Gutenberg separators.
 */
export function buildSemanticSourceRegions(original:string,units:SemanticPageUnit[]):SemanticSourceRegion[]{
  const result:SemanticSourceRegion[]=[];
  let cursor=0,regionIndex=0;
  for(const unit of units){
    const span=semanticUnitSourceRange(unit);
    if(!span)continue;
    const [start,end]=span;
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<cursor||end<=start||end>original.length)
      throw Error("Non-monotonic or invalid semantic source region.");
    if(start>cursor)result.push({regionIndex:null,unitId:null,start:cursor,end:start,text:original.slice(cursor,start)});
    result.push({regionIndex,unitId:unit.id,start,end,text:original.slice(start,end)});
    regionIndex++;
    cursor=end;
  }
  if(cursor<original.length)result.push({regionIndex:null,unitId:null,start:cursor,end:original.length,text:original.slice(cursor)});
  if(result.map(p=>p.text).join("")!==original)throw Error("Source region coverage failed.");
  return result;
}
