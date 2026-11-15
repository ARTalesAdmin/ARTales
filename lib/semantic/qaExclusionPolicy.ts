/** Exact-editor-intent gate for safe removal from the ARTales reader edition.
 * A word like "smazat" is NEVER authority to change archived source.
 * The human must still approve an exact source atom and existing RPC verifies it.
 */
export function isExplicitExclusionRequest(comment:string):boolean{
 const value=comment.trim();
 if(!value||value.startsWith("Obecné zadání "))return false;
 // Ambiguous or explicitly negative instructions stay open for manual review.
 if(/(?:nemazat|nesmazat|nevymazat|neodstraňovat|ponechat|zachovat|do not delete|don't delete|not remove|keep this|never delete)/iu.test(value))
  return false;
 return /(?:^|[^\p{L}])(?:smazat|smaž|vymazat|vymaž|odstranit|odstraň|vypustit|vypusť|vyřadit|vyřaď|delete|remove|exclude|omit)(?=$|[^\p{L}])/iu.test(value);
}

/** Exactly the text-bearing kinds already supported by the source-preserving
 * artales_commit_editorial_exclusions database guard.
 */
export function getExcludableAtomIds(revision:{
 blocks:readonly {kind:string;[key:string]:unknown}[];
}):Set<string>{
 const allowed=new Set(["paragraph","quote","epigraph","footnote"]);
 const ids=new Set<string>();
 const scan=(nodes:readonly {kind:string;[key:string]:unknown}[]):void=>{
  for(const node of nodes){
   if(allowed.has(node.kind)){
    const atom=node.atom as {id?:unknown}|undefined;
    if(atom&&typeof atom.id==="string")ids.add(atom.id);
   }
   if(node.kind==="chapter"||node.kind==="section")
    scan((node.children??[]) as {kind:string;[key:string]:unknown}[]);
  }
 };
 scan(revision.blocks);
 return ids;
}
