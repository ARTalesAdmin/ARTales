import type {SemanticNode,SemanticAtom} from "./model";
/** Pure source-atom traversal; safe on browser and server.
 * The cryptographic seal is verified at the server boundary before hydration.
 */
export function walkSemanticAtoms(nodes:readonly SemanticNode[]):SemanticAtom[]{
 const all:SemanticAtom[]=[];
 const visit=(item:SemanticNode):void=>{
  if(item.kind==="chapter"||item.kind==="section"){
   all.push(item.heading);item.children.forEach(visit);
  }else if(item.kind==="poem"){
   item.stanzas.forEach(st=>st.lines.forEach(line=>all.push(line.atom)));
  }else if("atom" in item)all.push(item.atom);
 };
 nodes.forEach(visit);
 return all;
}
