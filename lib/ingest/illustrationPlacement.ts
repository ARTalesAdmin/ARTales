import type {SemanticRevision,SemanticPage,SemanticPageUnit} from "../semantic/model";
import {verifySemanticRevision,walkSemanticAtoms} from "../semantic/compose";
import {verifyReaderProjection} from "../semantic/readerProjection";
import type {IllustrationSnapshot} from "./illustrationSnapshot";
export type IllustrationPlacement=Readonly<{
 asset:IllustrationSnapshot;
 after_atom_id:string;
 caption:string;
 alt:string;
}>;
export type IllustratedPage=Readonly<{
 index:number;kind:"text"|"illustration";
 original_page_index:number;
 units:readonly SemanticPageUnit[];
 image:Readonly<{component_id:string;sha256:string;caption:string;alt:string;aspect_ratio:number}>|null;
}>;
/** Conservative isolated artwork page after an anchored paragraph, with zero textual edits. */
export function projectIllustratedPages(revision:SemanticRevision,pages:SemanticPage[],
 placements:readonly IllustrationPlacement[]):IllustratedPage[]{
 verifySemanticRevision(revision);verifyReaderProjection(revision,pages);
 const known=new Set(walkSemanticAtoms(revision.blocks).map(a=>a.id));
 const anchors=new Set<string>(),ids=new Set<string>();
 for(const p of placements){
  if(!known.has(p.after_atom_id)||anchors.has(p.after_atom_id)||ids.has(p.asset.component_id)||
   p.asset.decision!=="eligible_for_editorial_draft"||
   p.asset.publication_authorized!==false||p.asset.derived_image_verified!==false||
   p.asset.text_snapshot_ref!==revision.source.source_snapshot_ref||
   !p.alt.trim()||p.alt.length>400||p.caption.length>1000)
    throw Error("Unsafe or duplicate illustration placement");
  anchors.add(p.after_atom_id);ids.add(p.asset.component_id);
 }
 const lookup=new Map(placements.map(p=>[p.after_atom_id,p]));
 const emitted=new Set<string>(),out:IllustratedPage[]=[];
 for(const page of pages){
  const buffer:SemanticPageUnit[]=[];
  const flush=()=>{if(buffer.length){out.push({index:out.length,kind:"text",original_page_index:page.index,units:[...buffer],image:null});buffer.length=0;}};
  for(const unit of page.units){
   buffer.push(unit);
   if(unit.source_atom_ids.some(id=>lookup.has(id))){
    const matches=unit.source_atom_ids.filter(id=>lookup.has(id));
    if(matches.length!==1)throw Error("Ambiguous illustration position within semantic unit");
    const key=matches[0],part=lookup.get(key)!;
    if(unit.fragment?.continuation_after)continue;
    flush();
    out.push({index:out.length,kind:"illustration",original_page_index:page.index,units:[],
     image:{component_id:part.asset.component_id,sha256:part.asset.sha256,
      caption:part.caption,alt:part.alt,
      aspect_ratio:part.asset.intrinsic_width/part.asset.intrinsic_height}});
    emitted.add(key);
   }
  }
  flush();
 }
 if(emitted.size!==placements.length)throw Error("Illustration anchor not rendered");
 return out;
}
