/**
 * Match a public-facing author credit against the verified contributor name
 * of the *same locked edition*. This is NOT a free-text identity lookup:
 * the caller must still verify source ID, legal review, role, RDF and
 * protection term. An abbreviation is allowed only when it drops one or
 * more additional given names, never a family-name token.
 */
const nameWords=(s:string):string[]=>s.normalize("NFKD").toLowerCase()
 .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ")
 .trim().split(/\s+/).filter(Boolean);
const equalBag=(a:string[],b:string[]):boolean=>
 a.length===b.length&&a.slice().sort().every((v,i)=>v===b.slice().sort()[i]);
export function contributorNameMatch(
 candidateName:string,verifiedCatalogName:string
):"exact"|"abbreviated_given_names"|null{
 const c=nameWords(candidateName),v=nameWords(verifiedCatalogName);
 if(c.length>=2&&equalBag(c,v))return "exact";
 // Gutenberg's authority form is "Family name, Given middle names".
 const split=verifiedCatalogName.split(",");
 if(split.length!==2)return null;
 const family=nameWords(split[0]),given=nameWords(split[1]);
 // Require at least one omitted given name AND a full, nonempty family
 // name plus a given name. Never accept surname-only/initial-only matching.
 if(!family.length||given.length<2||c.length<family.length+1||
    c.length>=family.length+given.length)return null;
 let enteredFamily:string[],enteredGiven:string[];
 if(candidateName.includes(",")){
  const candidateSplit=candidateName.split(",");
  if(candidateSplit.length!==2)return null;
  enteredFamily=nameWords(candidateSplit[0]);
  enteredGiven=nameWords(candidateSplit[1]);
 }else{
  enteredFamily=c.slice(-family.length);
  enteredGiven=c.slice(0,-family.length);
 }
 if(!equalBag(enteredFamily,family)||!enteredGiven.length||
    enteredGiven.length>=given.length)return null;
 // Preserve multiplicity, preventing repetitions from masquerading as names.
 const unused=[...given];
 for(const token of enteredGiven){
  const idx=unused.indexOf(token);
  if(idx<0)return null;
  unused.splice(idx,1);
 }
 return "abbreviated_given_names";
}
