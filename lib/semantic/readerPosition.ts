import type {SemanticPage} from "./model";

export type SemanticSavedPosition={
 schema:"artales.semantic.saved-position.v1"|"artales.semantic.saved-position.v2";
 slug:string;revisionSha:string;atomId:string;offset:number;updatedAt:string;
 atomSourceSha?:string;
};
export function semanticPositionKey(slug:string){return "artales.semantic.position:"+slug;}
export function anchorForSemanticPage(page:SemanticPage|undefined):{atomId:string;offset:number}|null{
 const first=page?.units.find(unit=>unit.source_atom_ids.length);
 if(!first)return null;
 return {atomId:first.source_atom_ids[0],offset:first.fragment?.start??0};
}
export function pageForSemanticAnchor(pages:readonly SemanticPage[],atomId:string,offset:number){
 if(!atomId||!Number.isInteger(offset)||offset<0)return null;
 for(const page of pages){
  for(const unit of page.units){
   if(!unit.source_atom_ids.includes(atomId))continue;
   if(unit.fragment&&unit.fragment.atom_id===atomId){
    if(offset>=unit.fragment.start&&offset<unit.fragment.end)return page.index;
   }else return page.index;
  }
 }
 return null;
}
/** Accept an older edition's reading position only when the exact atom-source
 * SHA still matches. Legacy v1 is accepted only on the original revision SHA.
 */
export function validateSemanticPosition(value:unknown,slug:string,revisionSha:string,
 sourceShaForAtom?:(atomId:string)=>string|null):SemanticSavedPosition|null{
 if(!value||typeof value!=="object")return null;
 const obj=value as Partial<SemanticSavedPosition>;
 if((obj.schema!=="artales.semantic.saved-position.v1"&&
     obj.schema!=="artales.semantic.saved-position.v2")||
   obj.slug!==slug||!obj.revisionSha||!obj.atomId||
   typeof obj.atomId!=="string"||obj.atomId.length>200||
   !Number.isInteger(obj.offset)||typeof obj.offset!=="number"||obj.offset<0||
   typeof obj.updatedAt!=="string")return null;
 if(obj.revisionSha===revisionSha)return obj as SemanticSavedPosition;
 if(obj.schema!=="artales.semantic.saved-position.v2"||
   !obj.atomSourceSha||!sourceShaForAtom||
   sourceShaForAtom(obj.atomId)!==obj.atomSourceSha)return null;
 return obj as SemanticSavedPosition;
}
