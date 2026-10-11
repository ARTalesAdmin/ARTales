import { createHash } from "node:crypto";
import {
  SEMANTIC_SCHEMA, type InlineMark, type SemanticAtom, type SemanticGap,
  type SemanticBlockPresentation, type SemanticTitlePage,
  type SemanticNode, type SemanticPoem, type SemanticRevision, type SemanticReviewIssue,
  type SemanticSection, type SemanticSource, type SemanticTextBlock, type SourceAnchorV2,
} from "./model";
import {
  createPg11IntegrationPayload, extractPg11Components,
  type ImmutableSourceSnapshot,
} from "../ingest/gutenbergSnapshot";

const sha = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const digest = (value: unknown) => sha(JSON.stringify(value));
/** Chapter spacing is a layout hint, never an artificial source newline. */
export const DEFAULT_CHAPTER_PRESENTATION: SemanticBlockPresentation = Object.freeze({
  align: "left", indent: "none", space_before: "generous", space_after: "generous",
});
const VALID_ALIGN = ["left", "center", "right", "justify"];
const VALID_INDENT = ["none", "small", "medium", "large"];
const VALID_SPACE = ["none", "normal", "generous"];
export function validateBlockPresentation(p: SemanticBlockPresentation, kind: SemanticNode["kind"]) {
  if (!p || typeof p !== "object" ||
      Object.keys(p).sort().join(",") !== "align,indent,space_after,space_before" ||
      !VALID_ALIGN.includes(p.align) || !VALID_INDENT.includes(p.indent) ||
      !VALID_SPACE.includes(p.space_before) || !VALID_SPACE.includes(p.space_after) ||
      (kind === "poem" && p.align === "justify")) {
    throw new Error("Unsafe or unsupported editor block presentation.");
  }
}
function plainText(s: unknown, max: number): s is string {
  return typeof s === "string" && s.trim().length > 0 && s.length <= max &&
    !/[<>\x00-\x1f]/.test(s);
}
function validateTitlePage(page: SemanticTitlePage, workId: string) {
  if (!page || page.kind !== "title_page" || page.id !== "title:" + workId ||
      page.brand !== "ARTales" || page.template !== "artales-typographic-draft-v0" ||
      page.review_state !== "awaiting_editor_review" ||
      !plainText(page.title, 240) || !Array.isArray(page.authors) ||
      !page.authors.length || page.authors.length > 12 ||
      page.authors.some(a => !plainText(a, 160)) ||
      (page.edition_note !== undefined && !plainText(page.edition_note, 420)) ||
      Object.keys(page).some(k =>
        !["kind","id","brand","title","authors","edition_note","template","review_state"].includes(k)) ||
      /\bISBN\b/i.test([page.title,...page.authors,page.edition_note??""].join(" "))) {
    throw new Error("Unverified, unsafe or ISBN-bearing title page metadata.");
  }
}

type Span = { start: number; end: number };
export type SemanticStructureHint = {
  kind: "poem" | "quote" | "footnote" | "epigraph" | "section";
  start: number;
  end: number;
  label?: string;
};
export type SemanticInput = {
  work_id: string;
  work_slug: string;
  snapshot_ref: string;
  source_bytes_sha256: string;
  component_id: string;
  original_byte_start: number;
  /** Exact UTF-8 source segment, including original CRLF. */
  original_raw: string;
  hints?: SemanticStructureHint[];
};

function assertInput(input: SemanticInput) {
  if (!input.work_id.trim() || !input.work_slug.trim() ||
      !/^sha256:[a-f0-9]{64}$/.test(input.snapshot_ref) ||
      !/^[a-f0-9]{64}$/.test(input.source_bytes_sha256) ||
      !input.component_id.trim() || !Number.isSafeInteger(input.original_byte_start) ||
      input.original_byte_start < 0 || !input.original_raw.length) {
    throw new Error("Semantic composition requires pinned work/source identity and nonempty exact text.");
  }
  if (/\r(?!\n)/.test(input.original_raw)) {
    throw new Error("Bare CR source requires independent editorial assessment.");
  }
}
/**
 * An exact UTF-16 -> original-byte boundary map. No collapsing of author's
 * spaces, blank lines, indents, punctuation or combining code points.
 */
export function normalizeExactSource(raw: string, originalStart = 0) {
  if (/\r(?!\n)/.test(raw)) throw new Error("Unsupported bare carriage return.");
  const map: number[] = [originalStart];
  let byte = originalStart;
  let normalized = "";
  for (let pos = 0; pos < raw.length;) {
    if (raw.slice(pos, pos + 2) === "\r\n") {
      normalized += "\n"; pos += 2; byte += 2; map.push(byte);
      continue;
    }
    const point = raw.codePointAt(pos)!;
    const glyph = String.fromCodePoint(point);
    normalized += glyph;
    if (glyph.length === 2) map.push(byte); // surrogate middle is not a valid slicing boundary
    byte += Buffer.byteLength(glyph, "utf8");
    map.push(byte);
    pos += glyph.length;
  }
  if (Buffer.byteLength(raw, "utf8") + originalStart !== byte) {
    throw new Error("Source byte-map construction failed.");
  }
  return { normalized, byteAt: map };
}
function anchor(input: SemanticInput, map: number[], start: number, end: number): SourceAnchorV2 {
  if (!(start >= 0 && end > start && end < map.length) ||
      map[end] <= map[start]) throw new Error("Invalid original-byte source anchor.");
  return {
    snapshot_ref: input.snapshot_ref, component_id: input.component_id,
    normalized_start: start, normalized_end: end,
    original_byte_start: map[start], original_byte_end: map[end],
  };
}
function atom(input: SemanticInput, rawBytes: Buffer, normalized: string,
  map: number[], start: number, end: number, marks: InlineMark[] = []): SemanticAtom {
  const a = anchor(input, map, start, end);
  const sourceBytes = rawBytes.subarray(a.original_byte_start - input.original_byte_start,
    a.original_byte_end - input.original_byte_start);
  return {
    id: "a:" + sha([input.snapshot_ref, input.component_id, start, end].join(":")).slice(0, 24),
    anchor: a, raw: normalized.slice(start, end),
    source_sha256: sha(sourceBytes), marks,
  };
}
function gapsIn(raw: string, from: number, to: number, callback: (a:number,b:number,role:SemanticGap["role"])=>void) {
  let start=from;
  while (start < to) {
    if (raw[start] !== "\n") { start++; continue; }
    const a=start;
    while(start<to && raw[start]==="\n")start++;
    callback(a,start,start-a>1?"stanza_gap":"line_break");
  }
}
function collectHints(hints: SemanticStructureHint[], length: number) {
  const sorted=[...hints].sort((a,b)=>a.start-b.start);
  let end=0;
  for (const h of sorted) {
    if (!Number.isInteger(h.start) || !Number.isInteger(h.end) ||
        h.start<end || h.start<0 || h.end>length || h.end<=h.start ||
        !["poem","quote","footnote","epigraph","section"].includes(h.kind)) {
      throw new Error("Overlapping, invalid or out-of-range semantic structural hints.");
    }
    end=h.end;
  }
  return sorted;
}

export function composeSemanticRevision(input: SemanticInput): SemanticRevision {
  assertInput(input);
  const { normalized, byteAt }=normalizeExactSource(input.original_raw,input.original_byte_start);
  const rawBytes=Buffer.from(input.original_raw,"utf8");
  const hints=collectHints(input.hints??[], normalized.length);
  const gaps: SemanticGap[]=[];
  const blocks: SemanticNode[]=[];
  let currentChapter: SemanticSection|null=null;
  let currentSection: SemanticSection|null=null;

  function addGap(start:number,end:number,role:SemanticGap["role"]) {
    if (end>start) gaps.push({kind:"source_gap",atom:atom(input,rawBytes,normalized,byteAt,start,end),role});
  }
  function append(node:SemanticNode) {
    if (currentSection) currentSection.children.push(node);
    else if (currentChapter) currentChapter.children.push(node);
    else blocks.push(node);
  }
  function textBlock(start:number,end:number,kind:SemanticTextBlock["kind"]="paragraph",label?:string) {
    const content=atom(input,rawBytes,normalized,byteAt,start,end);
    const item:SemanticTextBlock={kind,id:"b:"+content.id,atom:content,
      ...(kind==="footnote" && label?{footnote_label:label}:{})};
    append(item);
  }
  function heading(start:number,end:number,kind:"chapter"|"section") {
    const h=atom(input,rawBytes,normalized,byteAt,start,end);
    const item:SemanticSection={kind,id:"s:"+h.id,heading:h,children:[],
      ...(kind==="chapter"?{presentation:{...DEFAULT_CHAPTER_PRESENTATION}}:{})};
    if(kind==="chapter"){blocks.push(item);currentChapter=item;currentSection=null;}
    else{if(currentChapter)currentChapter.children.push(item);else blocks.push(item);currentSection=item;}
  }
  function poem(start:number,end:number) {
    const stanzas:SemanticPoem["stanzas"]=[];
    let lines:SemanticPoem["stanzas"][number]["lines"]=[];
    let lineStart=start;
    let stanzaIndex=0;
    const finishStanza=()=>{
      if(lines.length){stanzas.push({kind:"stanza",id:"st:"+sha([input.snapshot_ref,start,stanzaIndex].join(":")).slice(0,20),lines});stanzaIndex++;lines=[];}
    };
    for(let i=start;i<=end;i++){
      if(i!==end && normalized[i]!=="\n")continue;
      if(i>lineStart){
        const raw=normalized.slice(lineStart,i);
        const indent=raw.match(/^[ \t]+/)?.[0].length??0;
        const marks:InlineMark[]=indent>0?[{kind:"indent",start:0,end:indent,amount:"small"}]:[];
        lines.push({kind:"verse_line",atom:atom(input,rawBytes,normalized,byteAt,lineStart,i,marks)});
      }
      if(i<end){
        const k=i;
        while(i+1<end && normalized[i+1]==="\n")i++;
        addGap(k,i+1,i>k?"stanza_gap":"line_break");
        if(i>k)finishStanza();
      }
      lineStart=i+1;
    }
    finishStanza();
    if(!stanzas.length)throw new Error("Poem hint has no text lines.");
    const node:SemanticPoem={kind:"poem",id:"po:"+sha([input.snapshot_ref,input.component_id,start,end].join(":")).slice(0,24),
      stanzas,anchor:anchor(input,byteAt,start,end),layout:"stanza_natural"};
    append(node);
  }
  function ordinary(start:number,end:number){
    let cursor=start;
    const separator=/\n{2,}/g;
    separator.lastIndex=start;
    for(let match=separator.exec(normalized);match && match.index<end;match=separator.exec(normalized)){
      const at=match.index;
      const gapEnd=Math.min(end,at+match[0].length);
      if(at>cursor)classify(cursor,at);
      addGap(at,gapEnd,"paragraph_gap");
      cursor=gapEnd;
    }
    if(cursor<end) classify(cursor,end);
  }
  function classify(start:number,end:number){
    const value=normalized.slice(start,end);
    if(/^CHAPTER\s+[IVXLCDM]+\.[^\n]*$/iu.test(value)) heading(start,end,"chapter");
    else textBlock(start,end);
  }
  let cursor=0;
  for(const hint of hints){
    if(cursor<hint.start)ordinary(cursor,hint.start);
    if(hint.kind==="poem")poem(hint.start,hint.end);
    else if(hint.kind==="section")heading(hint.start,hint.end,"section");
    else textBlock(hint.start,hint.end,hint.kind,hint.label);
    cursor=hint.end;
  }
  if(cursor<normalized.length)ordinary(cursor,normalized.length);
  const source:SemanticSource={
    source_snapshot_ref:input.snapshot_ref,source_bytes_sha256:input.source_bytes_sha256,
    component_id:input.component_id,
    original_byte_start:input.original_byte_start,
    original_byte_end:input.original_byte_start+rawBytes.length,
    normalized_text:normalized,normalized_text_sha256:sha(normalized),
  };
  const draft:Omit<SemanticRevision,"revision_ref"|"revision_sha256">={
    schema:SEMANTIC_SCHEMA,work_id:input.work_id,work_slug:input.work_slug,
    source,blocks,gaps,parent_revision_ref:null,composer_recipe:"semantic-deterministic-v2.0",
    round:0,review_issues:[],state:"draft_qa_only",release_allowed:false,
  };
  const revision=seal(draft);
  verifySemanticRevision(revision,input.original_raw);
  return revision;
}
function seal(value:Omit<SemanticRevision,"revision_ref"|"revision_sha256">):SemanticRevision{
  const revision_sha256=digest(value);
  return {...value,revision_sha256,revision_ref:"sha256:"+revision_sha256};
}
export function walkSemanticAtoms(nodes:SemanticNode[]):SemanticAtom[]{
  const all:SemanticAtom[]=[];
  function visit(item:SemanticNode){
    if(item.kind==="chapter"||item.kind==="section"){
      all.push(item.heading);item.children.forEach(visit);
    }else if(item.kind==="poem"){
      item.stanzas.forEach(st=>st.lines.forEach(line=>all.push(line.atom)));
    }else if("atom" in item) all.push(item.atom);
  }
  nodes.forEach(visit);
  return all;
}
const MARKS=new Set(["italic","bold","emphasis","small_caps","indent","hard_break","page_break_before"]);
export function verifySemanticRevision(revision:SemanticRevision, exactOriginalRaw?:string):void{
  if(revision.schema!==SEMANTIC_SCHEMA || revision.state!=="draft_qa_only"||
     revision.release_allowed!==false || !revision.work_id || !revision.work_slug ||
     revision.composer_recipe!=="semantic-deterministic-v2.0" ||
     revision.revision_ref!=="sha256:"+revision.revision_sha256 ||
     !/^[0-9a-f]{64}$/.test(revision.revision_sha256)){
    throw new Error("Untrusted semantic revision identity or release state.");
  }
  const {revision_ref:_ref,revision_sha256:_hash,...payload}=revision;
  void _ref;void _hash;
  if(digest(payload)!==revision.revision_sha256)throw new Error("Semantic revision digest tampered.");
  if(revision.title_page)validateTitlePage(revision.title_page,revision.work_id);
  const checkPresentations=(nodes:SemanticNode[])=>{
    for(const n of nodes){
      if(n.presentation)validateBlockPresentation(n.presentation,n.kind);
      if(n.kind==="chapter"||n.kind==="section")checkPresentations(n.children);
    }
  };
  checkPresentations(revision.blocks);
  for(const issue of revision.review_issues){
    if(issue.requested_layout==="block_presentation"){
      if(!issue.requested_presentation)throw new Error("Editor block flags missing.");
    }else if(issue.requested_presentation!==undefined)throw new Error("Unexpected editor presentation override.");
  }
  const txt=revision.source.normalized_text;
  if(sha(txt)!==revision.source.normalized_text_sha256)throw new Error("Semantic approved-source hash mismatch.");
  const all=[...walkSemanticAtoms(revision.blocks),...revision.gaps.map(g=>g.atom)];
  if(!all.length)throw new Error("Empty semantic tree.");
  const seen=new Set<string>();
  all.sort((a,b)=>a.anchor.normalized_start-b.anchor.normalized_start);
  let cursor=0;
  for(const part of all){
    const a=part.anchor;
    if(seen.has(part.id)||a.normalized_start!==cursor||a.normalized_end<=cursor||
       a.normalized_end>txt.length||part.raw!==txt.slice(cursor,a.normalized_end)||
       a.snapshot_ref!==revision.source.source_snapshot_ref||
       a.component_id!==revision.source.component_id){
      throw new Error("Semantic text coverage gap, duplicate, or source-anchor drift.");
    }
    for(const m of part.marks){
      if(!MARKS.has(m.kind)||!Number.isInteger(m.start)||!Number.isInteger(m.end)||
         m.start<0||m.end>part.raw.length||m.start>m.end||
         (m.kind==="indent"?!["small","medium","large"].includes(m.amount??""):m.amount!==undefined)){
        throw new Error("Unsafe typographic mark.");
      }
    }
    cursor=a.normalized_end;seen.add(part.id);
  }
  if(cursor!==txt.length)throw new Error("Semantic source text tail omitted.");
  if(exactOriginalRaw!==undefined){
    const m=normalizeExactSource(exactOriginalRaw,revision.source.original_byte_start);
    if(m.normalized!==txt||m.byteAt[txt.length]!==revision.source.original_byte_end)
      throw new Error("Original snapshot bytes do not match normalized semantic source.");
    const rawBytes=Buffer.from(exactOriginalRaw,"utf8");
    for(const part of all){
      const a=part.anchor;
      if(a.original_byte_start!==m.byteAt[a.normalized_start]||
         a.original_byte_end!==m.byteAt[a.normalized_end]||
         sha(rawBytes.subarray(a.original_byte_start-revision.source.original_byte_start,
          a.original_byte_end-revision.source.original_byte_start))!==part.source_sha256){
        throw new Error("Original-byte/source-content integrity mismatch.");
      }
    }
  }
}
export function recomposeSemanticLayout(
  previous:SemanticRevision,
  issue:SemanticReviewIssue,
  exactOriginalRaw:string,
):SemanticRevision{
  verifySemanticRevision(previous,exactOriginalRaw);
  if(issue.parent_revision_ref!==previous.revision_ref||
      issue.round!==previous.round+1||!issue.id.trim()||
      issue.reason.trim().length<3||previous.review_issues.some(x=>x.id===issue.id)){
    throw new Error("Stale or unreasoned semantic editor return.");
  }
  const nodes:SemanticNode[]=structuredClone(previous.blocks);
  let changed=0;
  function apply(item:SemanticNode):void{
    if(item.kind==="chapter"||item.kind==="section"){item.children.forEach(apply);return;}
    if(item.kind==="poem" && issue.requested_layout.startsWith("stanza_")){
      const target=item.stanzas.flatMap(s=>s.lines).find(x=>x.atom.id===issue.target_atom_id);
      if(target && JSON.stringify(target.atom.anchor)===JSON.stringify(issue.source_anchor)){
        if(item.layout===issue.requested_layout)throw new Error("No proposed semantic layout delta.");
        item.layout=issue.requested_layout as SemanticPoem["layout"];changed++;
      }
      return;
    }
    if(item.kind==="poem"||!("atom" in item))return;
    if(item.atom.id!==issue.target_atom_id)return;
    if(JSON.stringify(item.atom.anchor)!==JSON.stringify(issue.source_anchor) ||
       !issue.requested_layout.startsWith("indent_"))
      throw new Error("Semantic return target or recipe mismatch.");
    const amount=issue.requested_layout.slice("indent_".length) as "small"|"medium"|"large";
    const mark:InlineMark={kind:"indent",start:0,end:0,amount};
    if(item.atom.marks.some(m=>m.kind==="indent"&&m.amount===amount))
      throw new Error("No proposed semantic layout delta.");
    item.atom.marks=item.atom.marks.filter(x=>x.kind!=="indent").concat(mark);
    changed++;
  }
  nodes.forEach(apply);
  if(changed!==1)throw new Error("Semantic return target missing or ambiguous.");
  const {revision_ref:_r,revision_sha256:_h,...payload}=previous;
  void _r;void _h;
  const after=seal({...payload,blocks:nodes,parent_revision_ref:previous.revision_ref,
    round:issue.round,review_issues:[...previous.review_issues,issue]});
  verifySemanticRevision(after,exactOriginalRaw);
  return after;
}
export function submitSemanticIssue(previous:SemanticRevision,args:{
  id:string;target_atom_id:string;kind:SemanticReviewIssue["kind"];
  reason:string;requested_layout:SemanticReviewIssue["requested_layout"];
}):SemanticReviewIssue{
  verifySemanticRevision(previous);
  const target=walkSemanticAtoms(previous.blocks).find(x=>x.id===args.target_atom_id);
  if(!target||!args.id.trim()||args.reason.trim().length<3)throw new Error("Invalid source-anchored semantic issue.");
  return {id:args.id,parent_revision_ref:previous.revision_ref,round:previous.round+1,
    target_atom_id:target.id,kind:args.kind,reason:args.reason.trim(),
    requested_layout:args.requested_layout,disposition:"returned_for_changes",
    source_anchor:structuredClone(target.anchor)};
}
/** PR #205 raw PG #11 adapter is a source; old WorkBlock is not an output. */
export function composeSemanticPg11(
  snapshot:ImmutableSourceSnapshot,
  options:{work_id:string;work_slug:string;chapter_only?:boolean},
):{revision:SemanticRevision;original_raw:string;boundary_status:"ready_for_fixture"}{
  const boundaries=extractPg11Components(snapshot);
  const contract=createPg11IntegrationPayload(snapshot,boundaries);
  const source=boundaries.content_components.find(x=>x.id==="pg11:work-text")!;
  if(!source.original)throw new Error("Missing pinned PG content span.");
  const bytes=Buffer.from(snapshot.raw_utf8,"utf8");
  const whole=bytes.subarray(source.original.byte_start,source.original.byte_end).toString("utf8");
  const chapterOnly=options.chapter_only??true;
  const stop=whole.indexOf("CHAPTER II. The Pool of Tears");
  if(chapterOnly && stop<=0)throw new Error("Expected PG11 chapter II boundary missing.");
  const original_raw=chapterOnly?whole.slice(0,stop):whole;
  const revision=composeSemanticRevision({
    work_id:options.work_id,work_slug:options.work_slug,
    snapshot_ref:snapshot.snapshot_ref,source_bytes_sha256:snapshot.bytes_sha256,
    component_id:"pg11:work-text",original_byte_start:source.original.byte_start,
    original_raw,
  });
  return {revision,original_raw,boundary_status:contract.boundary_status};
}
