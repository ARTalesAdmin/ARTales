import type {SemanticNode,SemanticRevision} from "./model";

/** Only atoms supported by the Alice v0.1 indent recipe; no section headings. */
export function listIndentableSemanticAtoms(revision:SemanticRevision){
 const atoms:{id:string;raw:string}[]=[];
 const visit=(nodes:SemanticNode[])=>{
  for(const node of nodes){
   if(node.kind==="chapter"||node.kind==="section") visit(node.children);
   else if(node.kind==="paragraph"||node.kind==="quote"||node.kind==="epigraph"||node.kind==="footnote"){
    if(node.atom.raw.trim()&& !node.atom.marks.some(m=>m.kind==="indent"&&m.amount==="small"))
     atoms.push({id:node.atom.id,raw:node.atom.raw});
   }
  }
 };
 visit(revision.blocks);
 return atoms;
}
