/** Cross-layer bibliographic title identity, not literal display-string equality.
 *
 * The approved legal source and the live Gutenberg catalog MUST still match
 * exactly, including their numbered catalog URL and verified contributors.
 * Only an explicit bounded *edition qualifier* may differ from the human
 * candidate title. Never remove volume numbers, translators or work subtitles.
 */
const words=(value:string)=>value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
 .toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
const editionSuffix=/(?:,\s*|\s*[—–-]\s*|\s*\(\s*)(?:complete|unabridged)(?:\s+edition)?\s*\)?\s*$/i;
export function matchesCandidateEditionTitle(candidateTitle:string,lockedEditionTitle:string):boolean{
 const candidate=words(candidateTitle),official=words(lockedEditionTitle);
 if(!candidate||!official)return false;
 if(candidate===official)return true;
 const stripped=lockedEditionTitle.replace(editionSuffix,"");
 // Do not admit trivial generic titles merely by suffix removal.
 return stripped!==lockedEditionTitle&&words(stripped)===candidate&&candidate.split(" ").length>=2;
}
export function sameLockedCatalogEdition(approvedEditionTitle:string,liveCatalogTitle:string):boolean{
 return Boolean(words(approvedEditionTitle))&&words(approvedEditionTitle)===words(liveCatalogTitle);
}
