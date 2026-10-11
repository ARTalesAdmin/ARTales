import type { SemanticRevision, SemanticNode, SemanticPageUnit, SemanticPage, ReaderAnchorV2, SemanticAtom } from "./model";
import { walkSemanticAtoms, verifySemanticRevision } from "./compose";

export type SemanticReaderLayout={mode:"paged"|"spread"|"scroll";viewport_width:number;viewport_height:number;font_scale:number};
function units(revision:SemanticRevision):SemanticPageUnit[]{
  const all:SemanticPageUnit[]=[];
  const append=(nodes:SemanticNode[],chapter:string|null)=>{
    for(const node of nodes){
      if(node.kind==="chapter"||node.kind==="section"){
        const u:SemanticPageUnit={id:node.id+":heading",kind:node.kind==="chapter"?"chapter_heading":"section_heading",
          node,chapter_id:chapter,source_atom_ids:[node.heading.id],estimated_height:85+node.heading.raw.length*0.6};
        all.push(u);append(node.children,node.kind==="chapter"?node.id:chapter);
      }else if(node.kind==="poem"){
        const atoms=node.stanzas.flatMap(s=>s.lines.map(l=>l.atom));
        all.push({id:node.id,kind:"poem",node,chapter_id:chapter,source_atom_ids:atoms.map(x=>x.id),
          estimated_height:40+atoms.reduce((sum,x)=>sum+Math.max(28,x.raw.length*0.4),0)+node.stanzas.length*18});
      }else{
        all.push({id:node.id,kind:node.kind,node,chapter_id:chapter,source_atom_ids:[node.atom.id],
          estimated_height:35+Math.max(1,node.atom.raw.length/60)*24});
      }
    }
  };
  append(revision.blocks,null);return all;
}
export function projectSemanticReader(revision:SemanticRevision, layout:SemanticReaderLayout):SemanticPage[]{
  verifySemanticRevision(revision);
  if(!Number.isFinite(layout.viewport_width)||!Number.isFinite(layout.viewport_height)||
     layout.viewport_width<280||layout.viewport_height<320||
     layout.viewport_width>10000||layout.viewport_height>10000||
     !Number.isFinite(layout.font_scale)||layout.font_scale<0.7||layout.font_scale>2)
    throw new Error("Invalid reader viewport.");
  const capacity=Math.max(180,layout.viewport_height-180)/layout.font_scale;
  const result:SemanticPage[]=[];
  let pending:SemanticPageUnit[]=[];let weight=0;
  const flush=()=>{if(pending.length){result.push({index:result.length,units:pending,
    overflow:pending.some(x=>x.estimated_height>capacity)?"scroll_unit":"none",estimated_height:weight});
    pending=[];weight=0;}};
  for(const u of units(revision)){
    if(layout.mode!=="scroll" && pending.length && weight+u.estimated_height>capacity)flush();
    pending.push(u);weight+=u.estimated_height;
    if(u.estimated_height>capacity)flush(); // scroll inside page, never split an atom/poem
  }
  flush();
  if(layout.mode==="scroll")return [{index:0,units:result.flatMap(p=>p.units),overflow:"scroll_unit",
    estimated_height:result.reduce((n,p)=>n+p.estimated_height,0)}];
  return result;
}
export function verifyReaderProjection(revision:SemanticRevision,pages:SemanticPage[]){
  verifySemanticRevision(revision);
  const expected=units(revision);
  const actual=pages.flatMap(p=>p.units);
  if(actual.length!==expected.length||expected.some((u,i)=>actual[i].id!==u.id||
    JSON.stringify(actual[i].source_atom_ids)!==JSON.stringify(u.source_atom_ids)))
    throw new Error("Reader dropped, duplicated or rearranged a semantic unit.");
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
