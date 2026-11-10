/** Editorial byline matching. Never create or link a new profile just because
 * Gutenberg omitted a first given name. A candidate may match a unique existing
 * longer personal name, but never on a surname alone.
 */
const normalized=(value:string)=>value.normalize("NFKD").toLowerCase()
 .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()
 .replace(/\s+/g," ");
export function matchesExistingAuthor(candidateByline:string,authorName:string):boolean{
 const byline=normalized(candidateByline),name=normalized(authorName);
 if(!byline||!name)return false;
 if(byline===name)return true;
 return byline.split(" ").length>=2&&name.endsWith(" "+byline);
}
export function uniqueExistingAuthor<T extends {id:string;name:string;name_en?:string|null}>(
 candidateByline:string,authors:readonly T[]
):T|null{
 const candidates=authors.filter(a=>matchesExistingAuthor(candidateByline,a.name)||
  matchesExistingAuthor(candidateByline,a.name_en??""));
 return candidates.length===1?candidates[0]:null;
}
