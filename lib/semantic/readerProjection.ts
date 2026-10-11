import type { SemanticRevision, SemanticNode, SemanticPageUnit, SemanticPage, ReaderAnchorV2, SemanticAtom } from "./model";
import { walkSemanticAtoms, verifySemanticRevision } from "./compose";

import { projectSemanticProseText } from "./displayText";

export type SemanticReaderLayout = {
  mode: "paged" | "spread" | "scroll";
  /** Width of ONE rendered page, not the width of a spread or browser window. */
  viewport_width: number;
  viewport_height: number;
  font_scale: number;
  density?: "comfortable" | "compact";
  /** Optional browser measurements on exact rendered page width/typeface. */
  measured_unit_heights?: Readonly<Record<string, number>>;
};

export function getSemanticPageUnits(revision: SemanticRevision): SemanticPageUnit[] {
  const all: SemanticPageUnit[] = [];
  const append = (nodes: SemanticNode[], chapter: string | null) => {
    for (const node of nodes) {
      if (node.kind === "chapter" || node.kind === "section") {
        all.push({
          id: node.id + ":heading", kind: node.kind === "chapter" ? "chapter_heading" : "section_heading",
          node, chapter_id: chapter, source_atom_ids: [node.heading.id], estimated_height: 0,
        });
        append(node.children, node.kind === "chapter" ? node.id : chapter);
      } else if (node.kind === "poem") {
        all.push({
          id: node.id, kind: "poem", node, chapter_id: chapter,
          source_atom_ids: node.stanzas.flatMap(s => s.lines.map(l => l.atom.id)),
          estimated_height: 0,
        });
      } else if ("atom" in node) {
        all.push({
          id: node.id, kind: node.kind, node, chapter_id: chapter,
          source_atom_ids: [node.atom.id], estimated_height: 0,
        });
      }
    }
  };
  append(revision.blocks, null);
  if(revision.title_page)all.unshift({id:revision.title_page.id,kind:"title_page",node:revision.title_page,
    chapter_id:null,source_atom_ids:[],estimated_height:0});
  return all;
}

/** First server-render fallback; hydrated preview replaces it with real DOM heights. */
function estimateUnitHeight(unit: SemanticPageUnit, layout: SemanticReaderLayout): number {
  if(unit.kind==="title_page")return Math.max(350,Math.min(650,layout.viewport_height-220));
  const lineHeight = 16 * layout.font_scale * (layout.density === "compact" ? 1.4 : 1.65);
  const textWidth = Math.max(150, layout.viewport_width - (layout.viewport_width < 650 ? 28 : 48));
  const charsPerLine = Math.max(18, Math.floor(textWidth / (7.8 * layout.font_scale)));
  if (unit.kind === "poem" && unit.node.kind === "poem") {
    const lineCount = unit.node.stanzas.reduce((n, stanza) =>
      n + stanza.lines.reduce((k, line) => k + Math.max(1, Math.ceil(line.atom.raw.length / charsPerLine)), 0), 0);
    return 20 + lineCount * lineHeight + unit.node.stanzas.length * 16;
  }
  const raw = unit.kind === "chapter_heading" || unit.kind === "section_heading"
    ? "heading" in unit.node ? unit.node.heading.raw : ""
    : "atom" in unit.node ? projectSemanticProseText(unit.node.atom.raw) : "";
  const logicalLines = raw.split("\n").reduce((n, line) =>
    n + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  const head = unit.kind === "chapter_heading" || unit.kind === "section_heading";
  return (head ? 24 : 16) + logicalLines * lineHeight * (head ? 1.05 : 1);
}

/** Prefer sentence ends, then safe whitespace. Fragment boundaries never change atoms. */
export function splitParagraphUnit(unit:SemanticPageUnit, maxChars:number):SemanticPageUnit[] {
  if(unit.kind!=="paragraph"||unit.node.kind!=="paragraph"||!Number.isInteger(maxChars)||maxChars<12)return [unit];
  const raw=unit.node.atom.raw;
  const from=unit.fragment?.start??0;
  const until=unit.fragment?.end??raw.length;
  if(until-from<=maxChars)return [unit];
  const result:SemanticPageUnit[]=[];
  let start=from;
  while(start<until) {
    let end=Math.min(until,start+maxChars);
    if(end<until){
      const slice=raw.slice(start,end);
      const sentence=[...slice.matchAll(/[.!?][”’"')\]]*\s+/g)].map(x=>start+x.index!+x[0].length).filter(x=>x-start>=Math.min(36,maxChars*.35));
      const word=[...slice.matchAll(/\s+/g)].map(x=>start+x.index!+x[0].length).filter(x=>x-start>=Math.min(20,maxChars*.3));
      end=sentence.at(-1)??word.at(-1)??end;
      if(end<until&&raw.charCodeAt(end-1)>=0xD800&&raw.charCodeAt(end-1)<=0xDBFF)end--;
    }
    if(end<=start)throw Error("Unable to establish bounded paragraph split.");
    const fragment={original_unit_id:unit.id,atom_id:unit.node.atom.id,start,end,
      normalized_start:unit.node.atom.anchor.normalized_start+start,
      normalized_end:unit.node.atom.anchor.normalized_start+end,
      continuation_before:start>0,continuation_after:end<raw.length};
    result.push({...unit,id:unit.id+":range:"+start+"-"+end,fragment,
      estimated_height:unit.estimated_height*(end-start)/(until-from)});
    start=end;
  }
  return result;
}
export function projectSemanticReader(revision: SemanticRevision, layout: SemanticReaderLayout): SemanticPage[] {
  verifySemanticRevision(revision);
  if (!Number.isFinite(layout.viewport_width) || !Number.isFinite(layout.viewport_height) ||
    layout.viewport_width < 200 || layout.viewport_height < 320 ||
    layout.viewport_width > 10000 || layout.viewport_height > 10000 ||
    !Number.isFinite(layout.font_scale) || layout.font_scale < 0.7 || layout.font_scale > 2) {
    throw new Error("Invalid reader viewport.");
  }
  if (layout.density !== undefined && layout.density !== "comfortable" && layout.density !== "compact") {
    throw new Error("Invalid Reader line density.");
  }
  const all = getSemanticPageUnits(revision).map(unit => {
    const measured = layout.measured_unit_heights?.[unit.id];
    if (measured !== undefined && (!Number.isFinite(measured) || measured <= 0 || measured > 100000)) {
      throw new Error("Invalid browser-measured semantic unit height.");
    }
    return { ...unit, estimated_height: measured ?? estimateUnitHeight(unit, layout) };
  });
  // Budget includes real viewport height, with margins for page padding/footer and controls.
  const capacity = Math.max(260, layout.viewport_height - 155);
  const result: SemanticPage[] = [];
  let pending: SemanticPageUnit[] = [];
  let weight = 0;
  const flush = () => {
    if (!pending.length) return;
    result.push({
      index: result.length, units: pending,
      overflow: pending.some(unit => unit.estimated_height > capacity) ? "scroll_unit" : "none",
      estimated_height: weight,
    });
    pending = []; weight = 0;
  };
  if (layout.mode === "scroll") {
    return [{
      index: 0, units: all, overflow: "scroll_unit",
      estimated_height: all.reduce((sum, unit) => sum + unit.estimated_height, 0),
    }];
  }
  const queue=[...all];
  for (let i = 0; i < queue.length; i++) {
    let unit = queue[i];
    if(unit.kind==="title_page"){
      flush();pending.push(unit);weight=unit.estimated_height;flush();continue;
    }
    // Fill remaining paper height with a source-anchored paragraph fragment.
    const remaining=capacity-weight;
    if(unit.kind==="paragraph"&&unit.node.kind==="paragraph"&&
       unit.estimated_height>remaining&&remaining>85){
      const currentLen=(unit.fragment?.end??unit.node.atom.raw.length)-(unit.fragment?.start??0);
      const maxChars=Math.max(32,Math.floor(currentLen*remaining/Math.max(unit.estimated_height,1)*.94));
      const pieces=splitParagraphUnit(unit,maxChars);
      if(pieces.length>1){
        queue.splice(i,1,...pieces);
        unit=queue[i];
      }
    }
    const next = queue[i + 1];
    // Avoid leaving a chapter heading at a page end without its first paragraph.
    const keepWithNext = (unit.kind === "chapter_heading" || unit.kind === "section_heading") && next
      ? next.estimated_height : 0;
    if (pending.length && (weight + unit.estimated_height > capacity ||
      (keepWithNext > 0 && weight + unit.estimated_height + keepWithNext > capacity))) {
      flush();
    }
    pending.push(unit);
    weight += unit.estimated_height;
    if (unit.estimated_height > capacity) flush(); // oversized semantic unit scrolls; never dropped/split
  }
  flush();
  return result;
}

export function verifyReaderProjection(revision:SemanticRevision,pages:SemanticPage[]){
  verifySemanticRevision(revision);
  const expected=getSemanticPageUnits(revision);
  const actual=pages.flatMap(p=>p.units);
  let index=0;
  for(const base of expected){
    const members:SemanticPageUnit[]=[];
    while(index<actual.length&&(actual[index].fragment?.original_unit_id===base.id||actual[index].id===base.id)){
      members.push(actual[index++]);
      if(!members.at(-1)!.fragment)break;
    }
    if(!members.length)throw Error("Reader lost a semantic unit.");
    if(members.length===1&&!members[0].fragment){
      if(members[0].id!==base.id||JSON.stringify(members[0].source_atom_ids)!==JSON.stringify(base.source_atom_ids))
        throw Error("Reader changed unit identity.");
      continue;
    }
    if(base.kind!=="paragraph"||base.node.kind!=="paragraph")throw Error("Non-paragraph semantic split rejected.");
    let offset=0;
    for(const part of members){
      const fragment=part.fragment;
      if(!fragment||fragment.original_unit_id!==base.id||fragment.atom_id!==base.node.atom.id||
        fragment.start!==offset||fragment.end<=offset||fragment.end>base.node.atom.raw.length||
        fragment.normalized_start!==base.node.atom.anchor.normalized_start+fragment.start||
        fragment.normalized_end!==base.node.atom.anchor.normalized_start+fragment.end)
        throw Error("Reader fragment gap, overlap or anchor drift.");
      offset=fragment.end;
    }
    if(offset!==base.node.atom.raw.length)throw Error("Reader fragment tail omitted.");
  }
  if(index!==actual.length)throw Error("Reader duplicated semantic units.");
  return {ok:true as const,pages:pages.length,units:actual.length};
}
export function locateReaderAnchor(revision:SemanticRevision,atomId:string,offset=0):ReaderAnchorV2{
  verifySemanticRevision(revision);
  const a=walkSemanticAtoms(revision.blocks).find(x=>x.id===atomId);
  if(!a||!Number.isInteger(offset)||offset<0||offset>a.raw.length)throw new Error("Reader anchor missing.");
  return {work_id:revision.work_id,work_slug:revision.work_slug,revision_ref:revision.revision_ref,
    snapshot_ref:a.anchor.snapshot_ref,component_id:a.anchor.component_id,atom_id:a.id,
    original_byte_start:a.anchor.original_byte_start,original_byte_end:a.anchor.original_byte_end,
    offset_in_atom:offset};
}
export type LegacyPosition={slug:string;progressPercent:number;pageIndex?:number;pageCount?:number;id?:string};
export type RemapResult={status:"exact"|"approximate"|"blocked";anchor:ReaderAnchorV2|null;
  retained_legacy:LegacyPosition;reason:string};
/** Never discard original saved progress, bookmark or note. Only source-evidenced mapping is exact. */
export function remapLegacyPosition(revision:SemanticRevision,previous:LegacyPosition,
  evidence?:{snapshot_ref:string;component_id:string;original_byte_offset:number}):RemapResult{
  verifySemanticRevision(revision);
  if(previous.slug!==revision.work_slug) return {status:"blocked",anchor:null,
    retained_legacy:previous,reason:"Different work identity; no cross-work note remap."};
  if(evidence){
    const atom=walkSemanticAtoms(revision.blocks).find(x=>x.anchor.snapshot_ref===evidence.snapshot_ref&&
      x.anchor.component_id===evidence.component_id&&
      evidence.original_byte_offset>=x.anchor.original_byte_start&&
      evidence.original_byte_offset<x.anchor.original_byte_end);
    if(atom)return {status:"exact",anchor:locateReaderAnchor(revision,atom.id),
      retained_legacy:previous,reason:"Original byte span matched verified snapshot."};
  }
  const atoms=walkSemanticAtoms(revision.blocks);
  if(!atoms.length)return {status:"blocked",anchor:null,retained_legacy:previous,reason:"No mapped text."};
  if(!Number.isFinite(previous.progressPercent)||previous.progressPercent<0||previous.progressPercent>100)
    return {status:"blocked",anchor:null,retained_legacy:previous,reason:"Invalid old progress."};
  const index=Math.min(atoms.length-1,Math.floor(previous.progressPercent/100*(atoms.length-1)));
  return {status:"approximate",anchor:locateReaderAnchor(revision,atoms[index].id),
    retained_legacy:previous,reason:"No verified legacy-to-source alignment; approximate position only."};
}
