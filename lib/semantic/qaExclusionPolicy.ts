import type {SemanticNode,SemanticRevision} from "./model";

/** Only an unambiguous instruction to exclude the entire selected block may
 * authorize a source-preserving exclusion proposal. Partial text rewrites,
 * negations and general "fix my prose" requests remain manual-review items.
 */
export function isExplicitWholeBlockExclusion(comment:string):boolean{
 const value=(comment??"").trim().toLocaleLowerCase("cs");
 if(!value||value.startsWith("obecné zadání "))return false;
 if(/\b(?:nemazat|nesmazat|nevymazat|neodstraňovat|ponechat|zachovat|keep|retain)\b|do not delete|don't delete|not remove/iu.test(value))
  return false;
 const deletion=/\b(?:smazat|smaž|vymazat|vymaž|odstranit|odstraň|vyřadit|vyřaď|vypustit|vypusť|delete|remove|exclude|omit)\b/iu;
 if(!deletion.test(value))return false;
 // Simple repeated instructions such as Ivana's "Smazat,smazat,smazat."
 // refer to the selected whole atom in the existing QA interaction.
 const words=value.match(/[\p{L}]+/gu)??[];
 if(words.length<=12&&words.every(w=>/^(?:smazat|smaž|vymazat|vymaž|odstranit|odstraň|vyřadit|vyřaď|vypustit|vypusť|delete|remove|exclude|omit)$/iu.test(w)))
  return true;
 // Other instructions require an explicit whole-block scope. Never infer a
 // destructive action from "remove a comma", "delete the first sentence" etc.
 return /\b(?:celý|celou|celé|všechen|všechny|whole|entire)\s+(?:(?:textový|textovou|textové)\s+)?(?:blok|odstavec|paragraph|block)\b/iu.test(value);
}

/** Precisely the node kinds supported by the existing secured exclusion RPC.
 * Structural chapter headings and poem containers are NOT removable here.
 */
export function getExcludableAtomIds(revision:Pick<SemanticRevision,"blocks">):Set<string>{
 const ids=new Set<string>();
 const walk=(nodes:readonly SemanticNode[]):void=>{
  for(const node of nodes){
   if(node.kind==="chapter"||node.kind==="section")walk(node.children);
   else if(["paragraph","quote","epigraph","footnote"].includes(node.kind))
    ids.add(node.atom.id);
  }
 };
 walk(revision.blocks);
 return ids;
}
