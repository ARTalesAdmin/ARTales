import type { SemanticRevision, SemanticNode, SemanticPageUnit, SemanticPage, ReaderAnchorV2, SemanticAtom } from "./model";
import { walkSemanticAtoms, verifySemanticRevision } from "./compose";

import { projectSemanticProseText } from "./displayText";
import {getProtectedTextSpans} from "./protectedSpans";
import { classifyGutenbergApparatus,poemInsideEditorialEdition } from "./editionProjection";

export type SemanticReaderLayout = {
  mode: "paged" | "spread" | "scroll";
  /** Width of ONE rendered page, not the width of a spread or browser window. */
  viewport_width: number;
  viewport_height: number;
  font_scale: number;
  density?: "comfortable" | "compact";
  /** Optional browser measurements on exact rendered page width/typeface. */
  measured_unit_heights?: Readonly<Record<string, number>>;
  /** Measured inner paper content rectangle. Supplied by the public DOM Reader. */
  content_height?: number;
  /** Exact browser measurement of the current paragraph fragment when available. */
  measure_fragment_height?: (fragment:SemanticPageUnit)=>number|null;
  /** Immutable editorial keep-together rules + universal typography. */
  protected_terms?:readonly string[];
  editionRange?:{start:number;end:number};
};

export function getSemanticPageUnits(revision: SemanticRevision, editionRange?:{start:number;end:number}): SemanticPageUnit[] {
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
  if(!editionRange)return all;
  const source=revision.source.normalized_text;
  const automatic=new Set(classifyGutenbergApparatus(
   source,walkSemanticAtoms(revision.blocks),revision.editorial_exclusions??[]
  ).automaticAtomIds);
  return all.filter(unit=>{
    if(unit.kind==="title_page")return true;
    // Public Reader preserves verse units in full; never hide all lines because
    // a single verse atom happened to match an electronic-edition notice.
    if(unit.kind==="poem"&&unit.node.kind==="poem")
      return poemInsideEditorialEdition(unit.node,editionRange);
    if(unit.source_atom_ids.some(id=>automatic.has(id)))return false;
    if(unit.source_atom_ids.some(id=>revision.editorial_exclusions?.includes(id)))return false;
    const atoms=unit.kind==="chapter_heading"||unit.kind==="section_heading"
      ? "heading" in unit.node?[unit.node.heading]:[]
      : unit.kind==="poem"&&unit.node.kind==="poem"
        ? unit.node.stanzas.flatMap(s=>s.lines.map(l=>l.atom))
        : "atom" in unit.node?[unit.node.atom]:[];
    if(!atoms.length)return false;
    const start=atoms[0].anchor.normalized_start,end=atoms.at(-1)!.anchor.normalized_end;
    if(start<editionRange.start&&end>editionRange.start||
       start<editionRange.end&&end>editionRange.end)
      throw Error("Editorial boundary intersects a semantic atom.");
    return start>=editionRange.start&&end<=editionRange.end;
  });
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

/**
 * Layout-only break preference: sentence/semicolon -> clause -> conjunction.
 * No raw text changes; the offset still points to the original immutable atom.
 */
export function chooseSemanticParagraphBreak(
  raw: string, start: number, requestedEnd: number, stop = raw.length,
  allowWordFallback = false,minTail = 30,protectedTerms:readonly string[]=[],
): number | null {
  if (!Number.isInteger(start) || !Number.isInteger(requestedEnd) ||
      !Number.isInteger(stop) || start < 0 || start >= stop ||
      stop > raw.length || requestedEnd <= start || requestedEnd >= stop) return null;
  const scan = raw.slice(start, Math.min(stop, requestedEnd));
  const minLength = Math.max(1, Math.min(44, Math.floor(scan.length * 0.25)));
  // Detect protected spans once per candidate search, rather than running all
  // Unicode regular expressions for every whitespace candidate (quadratic).
  const protectedRanges=getProtectedTextSpans(raw,protectedTerms);
  const candidates: {end: number; score: number}[] = [];
  const add = (end: number, bonus: number) => {
    const count = end - start;
    const tail = stop - end;
    if (count < minLength || tail < minTail) return;
    // Never leave an isolated English article/pronoun ("a", "I") at a
    // fragment/page edge. The following word must stay on the same page.
    if (/(?:^|\s)[aI]\s*$/u.test(raw.slice(start,end))) return;
    if (end <= start || end > requestedEnd) return;
    if (protectedRanges.some(span=>span.start<end&&end<span.end)) return;
    // Filling the measured page wins; punctuation only breaks near ties.
    // A period is not a reason to discard the last fifth of a sheet.
    candidates.push({end, score: count / scan.length * 12 + bonus});
  };
  for (const match of scan.matchAll(/[.!?;:][”’"')\]]*\s+/g)) {
    const token = match[0];
    add(start + match.index! + token.length,
      /[.!?]/.test(token[0]) ? 0.5 : token[0] === ";" ? 0.4 : 0.25);
  }
  for (const match of scan.matchAll(/[,][”’"')\]]*\s+/g)) {
    add(start + match.index! + match[0].length, 0.15);
  }
  // A long unpunctuated clause can break after a conjunction, never mid-word.
  for (const match of scan.matchAll(/\b(?:but|and|yet|because|although|however|when|while)\b\s+/gi)) {
    add(start + match.index! + match[0].length, 0.08);
  }
  if (allowWordFallback) {
    for (const match of scan.matchAll(/\s+/g)) {
      add(start + match.index! + match[0].length, 0);
    }
  }
  candidates.sort((a,b)=>b.score-a.score || b.end-a.end);
  let chosen = candidates[0]?.end;
  if(chosen!==undefined &&
     chosen < stop && raw.charCodeAt(chosen-1) >= 0xd800 && raw.charCodeAt(chosen-1) <= 0xdbff) chosen--;
  return chosen ?? null;
}

/** Create one bounded fragment, preserving the root paragraph and its source anchor. */
function makeFragment(unit:SemanticPageUnit,start:number,end:number,sourceHeight:number):SemanticPageUnit {
  if(!["paragraph","quote","epigraph","footnote"].includes(unit.kind) ||
     !("atom" in unit.node))
    throw Error("Only source-anchored prose can fragment.");
  const root=unit.fragment?.original_unit_id??unit.id;
  const raw=unit.node.atom.raw;
  const baseStart=unit.fragment?.start??0, baseEnd=unit.fragment?.end??raw.length;
  if(start<baseStart||end>baseEnd||end<=start)throw Error("Invalid paragraph fragment bounds.");
  const fragment={
    original_unit_id:root,atom_id:unit.node.atom.id,start,end,
    normalized_start:unit.node.atom.anchor.normalized_start+start,
    normalized_end:unit.node.atom.anchor.normalized_start+end,
    continuation_before:start>0,continuation_after:end<raw.length,
  };
  return {...unit,id:root+":range:"+start+"-"+end,fragment,
    estimated_height:sourceHeight*(end-start)/(baseEnd-baseStart)};
}

export function splitParagraphUnit(unit:SemanticPageUnit,maxChars:number,allowWordFallback=false,
  protectedTerms:readonly string[]=[]):SemanticPageUnit[] {
  if(!["paragraph","quote","epigraph","footnote"].includes(unit.kind) ||
     !("atom" in unit.node) ||
     !Number.isInteger(maxChars)||maxChars<12)return [unit];
  const raw=unit.node.atom.raw;
  const from=unit.fragment?.start??0,until=unit.fragment?.end??raw.length;
  if(until-from<=maxChars)return [unit];
  const parts:SemanticPageUnit[]=[];
  let start=from;
  while(start<until){
    if(until-start<=maxChars){
      parts.push(makeFragment(unit,start,until,unit.estimated_height));break;
    }
    const end=chooseSemanticParagraphBreak(raw,start,start+maxChars,until,allowWordFallback,30,protectedTerms);
    if(end===null){
      if(!parts.length)return [unit];
      parts.push(makeFragment(unit,start,until,unit.estimated_height));
      break;
    }
    parts.push(makeFragment(unit,start,end,unit.estimated_height));
    start=end;
  }
  return parts;
}

/** Cut only once at the page boundary; preserve the remainder as one unsplit unit. */
function takePageFragment(unit:SemanticPageUnit,maxChars:number,allowWordFallback:boolean,minTail=30,
  protectedTerms:readonly string[]=[]):
  [SemanticPageUnit,SemanticPageUnit] | null {
  if(!["paragraph","quote","epigraph","footnote"].includes(unit.kind) ||
     !("atom" in unit.node))return null;
  const from=unit.fragment?.start??0,until=unit.fragment?.end??unit.node.atom.raw.length;
  const end=chooseSemanticParagraphBreak(unit.node.atom.raw,from,
    Math.min(until-1,from+maxChars),until,allowWordFallback,minTail,protectedTerms);
  if(end===null)return null;
  return [makeFragment(unit,from,end,unit.estimated_height),
    makeFragment(unit,end,until,unit.estimated_height)];
}
export function projectSemanticReader(revision: SemanticRevision, layout: SemanticReaderLayout): SemanticPage[] {
  verifySemanticRevision(revision);
  return paginateSemanticUnits(getSemanticPageUnits(revision,layout.editionRange),layout);
}
/** The SAME pagination engine used by editorial QA, safely receiving only
 * already-verified and edition-filtered units in the public client. This
 * keeps preview payloads from exposing the whole copyrighted work.
 */
/** One canonical page engine. Public DOM reflow consumes one leaf at a time
 * across animation frames; QA can exhaust the same generator synchronously. */
export function* iterateSemanticPages(units:readonly SemanticPageUnit[],layout:SemanticReaderLayout):Generator<SemanticPage> {
  if (!Number.isFinite(layout.viewport_width) || !Number.isFinite(layout.viewport_height) ||
    layout.viewport_width < 200 || layout.viewport_height < 320 ||
    layout.viewport_width > 10000 || layout.viewport_height > 10000 ||
    !Number.isFinite(layout.font_scale) || layout.font_scale < 0.7 || layout.font_scale > 2) {
    throw new Error("Invalid reader viewport.");
  }
  if (layout.density !== undefined && layout.density !== "comfortable" && layout.density !== "compact") {
    throw new Error("Invalid Reader line density.");
  }
  const all = units.map(unit => {
    const measured = layout.measured_unit_heights?.[unit.id];
    if (measured !== undefined && (!Number.isFinite(measured) || measured <= 0 || measured > 100000)) {
      throw new Error("Invalid browser-measured semantic unit height.");
    }
    return { ...unit, estimated_height: measured ?? estimateUnitHeight(unit, layout) };
  });
  // Public Reader passes the actual inner content rectangle; QA retains its
  // legacy viewport estimate until it can supply the same DOM geometry.
  const capacity=layout.content_height??Math.max(240,layout.viewport_height-100);
  if(!Number.isFinite(capacity)||capacity<80||capacity>10000)
    throw new Error("Invalid measured page content height.");
  let nextPageIndex=0;
  let pending: SemanticPageUnit[] = [];
  let weight = 0;
  const flush = ():SemanticPage|null => {
    if(!pending.length)return null;
    const page:SemanticPage={
      index:nextPageIndex++,units:pending,
      overflow:pending.some(unit=>unit.estimated_height>capacity)?"scroll_unit":"none",
      estimated_height:weight,
    };
    pending=[];weight=0;
    return page;
  };
  if (layout.mode === "scroll") {
    yield {index:0,units:all,overflow:"scroll_unit",
      estimated_height:all.reduce((sum,unit)=>sum+unit.estimated_height,0)};
    return;
  }
  const lineHeight=18*layout.font_scale*(layout.density==="compact"?1.48:1.62);
  const minimumBody=2.5*lineHeight;
  const measureFragment=(fragment:SemanticPageUnit):number=>{
    const exact=layout.measure_fragment_height?.(fragment);
    return exact!==null&&exact!==undefined&&Number.isFinite(exact)&&exact>0
      ?exact:fragment.estimated_height;
  };
  // The editor and public Reader use this exact same semantic split policy.
  // A browser can additionally supply true DOM heights for candidate fragments.
  const fitParagraph=(unit:SemanticPageUnit,remaining:number):
    [SemanticPageUnit,SemanticPageUnit]|null=>{
    if(!["paragraph","quote","epigraph","footnote"].includes(unit.kind) ||
       !("atom" in unit.node) ||
       remaining<minimumBody)return null;
    const from=unit.fragment?.start??0;
    const until=unit.fragment?.end??unit.node.atom.raw.length;
    const length=until-from;
    const approxCharsPerLine=Math.max(18,Math.floor(
      Math.max(160,layout.viewport_width)/(9.1*layout.font_scale)));
    // No single-line tail or first-page orphan. The actual boundary also
    // respects the persisted per-work no-break terms and named entities.
    const minTail=Math.max(18,Math.min(approxCharsPerLine*2,Math.floor(length*.35)));
    const minHead=Math.max(18,Math.min(approxCharsPerLine*2,Math.floor(length*.35)));
    let low=minHead,high=length-minTail;
    let best:[SemanticPageUnit,SemanticPageUnit]|null=null;
    let lastBoundary=-1;
    for(let attempt=0;attempt<10 && low<=high;attempt++){
      const middle=Math.floor((low+high)/2);
      const cut=takePageFragment(unit,middle,true,minTail,layout.protected_terms??[]);
      if(!cut){low=middle+1;continue;}
      const boundary=cut[0].fragment?.end??-1;
      const h=measureFragment(cut[0]);
      if(h<=remaining-6){
        best=[{...cut[0],estimated_height:h},cut[1]];
        low=middle+1;
      }else{
        high=middle-1;
      }
      // Repeated punctuation preference can yield the same boundary; the
      // bisection still converges by narrowing the requested character budget.
      lastBoundary=boundary;
    }
    void lastBoundary;
    return best;
  };
  const queue=[...all];
  for(let i=0;i<queue.length;i++){
    let unit=queue[i];
    if(unit.fragment){
      unit={...unit,estimated_height:measureFragment(unit)};
      queue[i]=unit;
    }
    if(unit.kind==="title_page"){
      const preceding=flush();if(preceding)yield preceding;
      pending.push(unit);weight=unit.estimated_height;
      const cover=flush();if(cover)yield cover;
      continue;
    }
    // A new chapter always opens on a fresh leaf; a section heading must
    // remain with at least two-three lines of the following text.
    if(unit.kind==="chapter_heading"&&pending.length){
      const leaf=flush();if(leaf)yield leaf;
    }
    const next=queue[i+1];
    if(unit.kind==="section_heading"&&pending.length){
      const nextMinimum=next?Math.min(next.estimated_height,minimumBody+lineHeight):0;
      if(weight+unit.estimated_height+nextMinimum>capacity){
        const leaf=flush();if(leaf)yield leaf;
      }
    }
    // A paragraph may be longer than the whole page: split it into DOM-fitted
    // continuations, not a single overflowing element. Never rely on simple
    // character-height proportionality when browser measurements are supplied.
    if(["paragraph","quote","epigraph","footnote"].includes(unit.kind)&&"atom" in unit.node&&
       unit.estimated_height>capacity-weight-6){
      if(pending.length && capacity-weight<minimumBody){
        const leaf=flush();if(leaf)yield leaf;
      }
      const cut=fitParagraph(unit,capacity-weight);
      if(cut){
        queue.splice(i,1,cut[0],cut[1]);
        unit=queue[i];
      }else if(pending.length){
        const leaf=flush();if(leaf)yield leaf;
        const freshCut=fitParagraph(unit,capacity);
        if(freshCut){
          queue.splice(i,1,freshCut[0],freshCut[1]);
          unit=queue[i];
        }
      }
    }
    if(pending.length && weight+unit.estimated_height>capacity){
      const leaf=flush();if(leaf)yield leaf;
    }
    pending.push(unit);
    weight+=unit.estimated_height;
    if(unit.estimated_height>capacity){
      const leaf=flush();if(leaf)yield leaf; // explicit special-object fallback
    }
    // A continuation is allowed to share this leaf with another paragraph
    // fragment or the next block. NEVER flush solely because it is a fragment.
  }
  const leaf=flush();if(leaf)yield leaf;
}
/** Eager wrapper for QA/tests; identical semantic algorithm, no parallel path. */
export function paginateSemanticUnits(units:readonly SemanticPageUnit[],layout:SemanticReaderLayout):SemanticPage[]{
  return [...iterateSemanticPages(units,layout)];
}

export function verifyReaderProjection(revision:SemanticRevision,pages:SemanticPage[],editionRange?:{start:number;end:number}){
  verifySemanticRevision(revision);
  const expected=getSemanticPageUnits(revision,editionRange);
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
    if(!["paragraph","quote","epigraph","footnote"].includes(base.kind) ||
       !("atom" in base.node))
      throw Error("Non-prose semantic split rejected.");
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
