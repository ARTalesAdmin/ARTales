import type {SemanticPage,SemanticPageUnit} from "./model";
import type {ReaderNoteColor} from "../reader/readerStorage";
import {pageForSemanticAnchor} from "./readerPosition";

export type SemanticReaderNote={
 schema:"artales.semantic.note.v1";
 id:string;slug:string;atomId:string;atomSourceSha:string;offset:number;
 title:string;body:string;color:ReaderNoteColor;
 createdAt:string;updatedAt:string;
};
export function semanticNotesKey(slug:string){return "artales.semantic.notes:"+slug;}
function shaOfUnit(unit:SemanticPageUnit,atomId:string):string|null{
 const node=unit.node;
 if(node.kind==="chapter"||node.kind==="section")
  return node.heading.id===atomId?node.heading.source_sha256:null;
 if(node.kind==="poem"){
  for(const stanza of node.stanzas)
   for(const line of stanza.lines)
    if(line.atom.id===atomId)return line.atom.source_sha256;
  return null;
 }
 return "atom" in node&&node.atom.id===atomId?node.atom.source_sha256:null;
}
export function sourceShaForAtom(units:readonly SemanticPageUnit[],atomId:string){
 for(const u of units){const sha=shaOfUnit(u,atomId);if(sha)return sha;}
 return null;
}
export function makeSemanticReaderNote(input:{
 slug:string;page:SemanticPage|undefined;units:readonly SemanticPageUnit[];
 id:string;now:string;title:string;body:string;color:ReaderNoteColor
}):SemanticReaderNote|null{
 const first=input.page?.units.find(x=>x.source_atom_ids.length);
 if(!first)return null;
 const atomId=first.source_atom_ids[0];
 const atomSourceSha=sourceShaForAtom(input.units,atomId);
 if(!atomSourceSha||!atomId)return null;
 return {schema:"artales.semantic.note.v1",id:input.id,slug:input.slug,
  atomId,atomSourceSha,offset:first.fragment?.start??0,
  title:input.title.slice(0,160),body:input.body.slice(0,4000),color:input.color,
  createdAt:input.now,updatedAt:input.now};
}
const colors=new Set(["gold","blue","green","rose","violet"]);
export function filterSemanticReaderNotes(value:unknown,slug:string){
 if(!Array.isArray(value))return [] as SemanticReaderNote[];
 // Keep notes for older editions. Rebinding is a separate proof and must not delete history.
 return value.slice(0,500).filter((entry):entry is SemanticReaderNote=>{
  if(!entry||typeof entry!=="object")return false;
  const n=entry as Partial<SemanticReaderNote>;
  return n.schema==="artales.semantic.note.v1"&&n.slug===slug&&
   typeof n.id==="string"&&n.id.length>0&&n.id.length<=100&&
   typeof n.atomId==="string"&&typeof n.atomSourceSha==="string"&&
   /^[a-f0-9]{64}$/.test(n.atomSourceSha)&&
   Number.isInteger(n.offset)&&n.offset!>=0&&
   typeof n.title==="string"&&n.title.length<=160&&
   typeof n.body==="string"&&n.body.length<=4000&&
   typeof n.color==="string"&&colors.has(n.color)&&
   typeof n.createdAt==="string"&&typeof n.updatedAt==="string";
 });
}
export function pageForSemanticNote(pages:readonly SemanticPage[],note:SemanticReaderNote,
 units:readonly SemanticPageUnit[]){
 if(sourceShaForAtom(units,note.atomId)!==note.atomSourceSha)return null;
 return pageForSemanticAnchor(pages,note.atomId,note.offset);
}
