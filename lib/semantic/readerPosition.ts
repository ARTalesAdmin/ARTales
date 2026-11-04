import type {SemanticPage,SemanticPageUnit} from "./model";

export type SemanticSavedPosition={
 schema:"artales.semantic.saved-position.v1";
 slug:string;revisionSha:string;atomId:string;offset:number;updatedAt:string;
};
export function semanticPositionKey(slug:string){return "artales.semantic.position:"+slug;}
export function anchorForSemanticPage(page:SemanticPage|undefined):{atomId:string;offset:number}|null{
 const first=page?.units.find(unit=>unit.source_atom_ids.length);
 if(!first)return null;
 const atomId=first.source_atom_ids[0];
 return {atomId,offset:first.fragment?.start??0};
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
export function validateSemanticPosition(value:unknown,slug:string,revisionSha:string):SemanticSavedPosition|null{
 if(!value||typeof value!=="object")return null;
 const obj=value as Partial<SemanticSavedPosition>;
 if(obj.schema!=="artales.semantic.saved-position.v1"||obj.slug!==slug||
   obj.revisionSha!==revisionSha||!obj.atomId||typeof obj.atomId!=="string"||
   obj.atomId.length>200||!Number.isInteger(obj.offset)||obj.offset!<0||
   typeof obj.updatedAt!=="string")return null;
 return obj as SemanticSavedPosition;
}
