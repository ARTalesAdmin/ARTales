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

function sourceSpan(unit:SemanticPageUnit):[number,number]|null{
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
  const ranges=pages[pageIndex].units.map(sourceSpan).filter((s):s is [number,number]=>Boolean(s));
  if(!ranges.length)return 0;
  const start=ranges[0][0],end=ranges.at(-1)![1];
  const ratio=Math.min(1,Math.max(0,progress));
  return Math.floor(start+(end-start)*ratio);
}
