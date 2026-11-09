import {deathTerm} from "@/lib/legal/publicDomainCheck";
import type {VerifiedRights} from "@/lib/legal/gutenbergRights";
import type {TextRightsCheck} from "@/lib/legal/textRightsCheck";

/** Machine gate for a SPECIFIC, already approved, locked Gutenberg edition.
 * An unchanged archive is not independent proof: re-acquired mirror bytes must
 * match too. This checks only textual rights; all original images stay private.
 */
export type AutomaticEditionInput={
 candidate:{proposed_title:string;proposed_author_name:string};
 lock:{source_id:string;decision_no:number;source_url:string;download_url:string;source_facts:unknown};
 source:{id:string;source_kind:string;edition_title:string;source_url:string;download_url:string|null;
  author_died:number|null;translation_status:string;translator:string|null;translation_rights:string;
  original_rights:string;illustration_use:string;source_terms:string;language_code:string;
  identity_match:string;language_match:string;notes:string|null};
 decision:{source_id:string;decision_no:number;verdict:string;territory:string};
 receipt:{source_id:string;decision_no:number;gutenberg_id:number;catalog_url:string;
  locked_file_url:string;sha256:string;byte_count:number;embedded_images:number;readback_status:string};
 archivedSha256:string;archivedBytes:number;mirrorSha256:string;mirrorBytes:number;
 spineDocuments:number;textCharacters:number;sourceTextSha256:string;imageCount:number;
 textCheck:Pick<TextRightsCheck,"status"|"scope"|"translationCredit"|"notice"|"historicalImprints">;
 liveRdf:VerifiedRights;verifiedAt:string;year:number;
};
export class AutomaticEditionHold extends Error{
 constructor(public readonly reason:string){super(reason);this.name="AutomaticEditionHold";}
}
const refuse=(reason:string):never=>{throw new AutomaticEditionHold(reason);};
const normalized=(s:string):string[]=>s.normalize("NFKD").toLowerCase()
 .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()
 .split(/\s+/).filter(Boolean).sort();
const samePerson=(a:string,b:string)=>JSON.stringify(normalized(a))===JSON.stringify(normalized(b));
const shaValid=(s:string)=>/^[a-f0-9]{64}$/.test(s);
type TextCreatorRole="author"|"editor";
type TextCreatorEvidence={name:string;died:number;role:TextCreatorRole;source:string};
type StoredEvidence={schema?:string;outcome?:string;gutenbergId?:number;
 text?:{status?:string;people?:Array<{name?:string;died?:number;role?:string;source?:string}>};
 translation?:{status?:string};illustrations?:{status?:string}};
const rdfRole=(role:string):TextCreatorRole|null=>{
 if(role==="dcterms:creator")return "author";
 if(role==="marcrel:edt")return "editor";
 return null;
};
const approvedRole=(role:string|undefined,legacyAuthor:boolean):TextCreatorRole|null=>{
 if(role==="autor"||role==="author"||role==="creator")return "author";
 if(role==="editor"||role==="redaktor")return "editor";
 // Historical Legal v1 evidence did not always persist the author role.
 // It is compatible only when the locked single-person death field confirms it.
 return !role&&legacyAuthor?"author":null;
};
const creatorKey=(p:{name:string;role:TextCreatorRole})=>
 p.role+":"+normalized(p.name).join(":");
function sameCreators(a:TextCreatorEvidence[],b:TextCreatorEvidence[]){
 if(a.length!==b.length)return false;
 const left=a.map(p=>creatorKey(p)+":"+p.died).sort();
 const right=b.map(p=>creatorKey(p)+":"+p.died).sort();
 return JSON.stringify(left)===JSON.stringify(right);
}

export type AutomaticEditionEvidence={
 schema:"artales.automatic-edition-evidence.v1";status:"verified_for_text_composition";
 sourceId:string;legalDecisionNo:number;gutenbergId:number;catalogUrl:string;
 mirrorUrl:string;editionSha256:string;sourceTextSha256:string;byteCount:number;
 spineDocuments:number;textCharacters:number;privateImages:number;
 author:string;authorDied:number|null;publicDomainFrom:number;territory:"CZ/EU";
 textCreators:TextCreatorEvidence[];
 rightsEvidenceSource:"live_gutenberg_rdf"|"approved_locked_gutenberg_rdf_evidence";
 rightsEvidenceUrl:string;textScan:"no_explicit_notice";images:"exclude_all";
 evaluatedAt:string;publicationAuthorized:false;historicalImprints:string[];
};
export function verifyAutomaticEdition(i:AutomaticEditionInput):AutomaticEditionEvidence{
 const {candidate,lock,source,decision,receipt}=i;
 const id=receipt.gutenberg_id, url="https://www.gutenberg.org/ebooks/"+id;
 if(!Number.isSafeInteger(id)||id<1||id>99_999_999||receipt.catalog_url!==url||
  lock.source_url!==url||source.source_url!==url||lock.source_id!==source.id||
  receipt.source_id!==source.id||decision.source_id!==source.id||
  decision.decision_no!==lock.decision_no||receipt.decision_no!==lock.decision_no||
  lock.download_url!==receipt.locked_file_url||source.download_url!==lock.download_url||
  source.source_kind!=="gutenberg"||!source.download_url?.startsWith(url+".")||
  !samePerson(source.edition_title,candidate.proposed_title)||
  !Number.isInteger(i.year)||i.year<2020)refuse("edition_identity_mismatch");
 if(decision.verdict!=="approved"||decision.territory!=="CZ/EU"||
  source.identity_match!=="confirmed"||source.language_match!=="matches"||
  source.original_rights!=="public_domain"||source.source_terms!=="cleared"||
  source.translation_status!=="original"||(source.translator??"").trim()!==""||
  source.translation_rights!=="not_applicable"||source.illustration_use!=="excluded")
  refuse("legal_components_not_cleared_for_text_only");
 if(receipt.readback_status!=="sha256_verified"||!shaValid(receipt.sha256)||
  i.archivedSha256!==receipt.sha256||i.mirrorSha256!==receipt.sha256||
  i.archivedBytes!==receipt.byte_count||i.mirrorBytes!==receipt.byte_count||
  receipt.byte_count<100||receipt.byte_count>8*1024*1024)
  refuse("independent_edition_bytes_mismatch");
 if(i.spineDocuments<1||i.textCharacters<100||!shaValid(i.sourceTextSha256)||
  i.imageCount!==receipt.embedded_images)
  refuse("epub_manifest_incomplete_or_mismatch");
 if(i.textCheck.status!=="no_explicit_notice"||i.textCheck.scope!=="complete"||
  i.textCheck.translationCredit||i.textCheck.notice)
  refuse("text_contains_unresolved_credits_or_rights");
 let prior:StoredEvidence;
 try{
  const rawNotes=source.notes;
  if(typeof rawNotes!=="string"||rawNotes.length>100_000)refuse("approved_legal_audit_missing");
  prior=JSON.parse(rawNotes ?? "") as StoredEvidence;
 }catch{refuse("approved_legal_audit_missing");}
 if(prior!.schema!=="artales.public-domain-check.v1"||
  prior!.gutenbergId!==id||
  !["yes_without_illustrations","yes_with_illustrations"].includes(prior!.outcome??"")||
  prior!.text?.status!=="public_domain"||
  prior!.translation?.status!=="not_applicable"||
  !Array.isArray(prior!.text?.people)||!prior!.text!.people!.length||
  prior!.text!.people!.length>12)
  refuse("approved_legal_audit_incomplete");
 const rawPeople=prior!.text!.people!;
 const rdfUrl="https://www.gutenberg.org/ebooks/"+id+".rdf";
 const legacyAuthor=rawPeople.length===1&&
  rawPeople[0].died===source.author_died&&
  samePerson(rawPeople[0].name??"",candidate.proposed_author_name);
 const textCreators:TextCreatorEvidence[]=rawPeople.map(p=>{
  const role=approvedRole(p.role,legacyAuthor);
  if(!role||typeof p.name!=="string"||!p.name.trim()||
     !Number.isInteger(p.died)||p.source!==rdfUrl||
     deathTerm(p.died??null,i.year)!=="public_domain")
   refuse("text_creator_identity_role_or_death_unverified");
  return {name:p.name!,died:p.died!,role:role!,source:rdfUrl};
 });
 // Never let one cleared contributor mask another protected/unknown contributor.
 if(new Set(textCreators.map(creatorKey)).size!==textCreators.length)
  refuse("duplicate_text_creator_evidence");
 const candidateCreator=textCreators.find(p=>samePerson(p.name,candidate.proposed_author_name));
 const collectiveName=/^(various|various authors|multiple authors|anonymous|anonymni|ruzni autori)$/i
  .test(candidate.proposed_author_name.trim());
 if(!candidateCreator&&!(collectiveName&&textCreators.length>1))
  refuse("candidate_contributor_identity_unverified");
 // The legacy single-author field may be null for edited anthologies. If it
 // exists, it must still agree with the named candidate's verified death year.
 if(source.author_died!==null&&
    (!candidateCreator||source.author_died!==candidateCreator.died))
  refuse("prescreen_death_conflicts_with_legal_evidence");
 if(i.liveRdf.checked&&i.liveRdf.usStatus==="restricted")
  refuse("gutenberg_live_rights_restriction");
 if(i.liveRdf.contributors.some(x=>/marcrel:trl$/.test(x.role)))
  refuse("live_rdf_translation_requires_separate_clearance");
 let rightsEvidenceSource:AutomaticEditionEvidence["rightsEvidenceSource"]="approved_locked_gutenberg_rdf_evidence";
 if(i.liveRdf.checked){
  const liveCreators:TextCreatorEvidence[]=i.liveRdf.contributors
   .flatMap(p=>{
    const role=rdfRole(p.role);
    return role?[{name:p.name,died:p.died??NaN,role,source:rdfUrl}]:[];
   });
  // Older RDF adapters expose primary authors only in people[].
  if(!liveCreators.length&&i.liveRdf.people.length)
   liveCreators.push(...i.liveRdf.people.map(p=>({
    name:p.name,died:p.died??NaN,role:"author" as const,source:rdfUrl
   })));
  if(liveCreators.length){
   if(!sameCreators(textCreators,liveCreators))
    refuse("live_rdf_contradicts_locked_legal_evidence");
   rightsEvidenceSource="live_gutenberg_rdf";
  }
 }
 return{
  schema:"artales.automatic-edition-evidence.v1",status:"verified_for_text_composition",
  sourceId:source.id,legalDecisionNo:decision.decision_no,gutenbergId:id,catalogUrl:url,
  mirrorUrl:"https://gutenberg.pglaf.org/cache/epub/"+id+"/pg"+id+".epub",
  editionSha256:receipt.sha256,sourceTextSha256:i.sourceTextSha256,
  byteCount:receipt.byte_count,spineDocuments:i.spineDocuments,textCharacters:i.textCharacters,
  privateImages:i.imageCount,author:candidate.proposed_author_name,
  authorDied:candidateCreator?.died??null,
  publicDomainFrom:Math.max(...textCreators.map(p=>p.died))+71,
  textCreators,territory:"CZ/EU",
  rightsEvidenceSource,rightsEvidenceUrl:"https://www.gutenberg.org/ebooks/"+id+".rdf",
  textScan:"no_explicit_notice",images:"exclude_all",
  historicalImprints:i.textCheck.historicalImprints??[],
  evaluatedAt:i.verifiedAt,publicationAuthorized:false
 };
}
export function formatAutomaticEditionAudit(e:AutomaticEditionEvidence):string{
 return [
 "AUTOMATICKY OVĚŘENO – textová kompozice, nikoliv publikace.",
 "Schválený právní lock "+e.legalDecisionNo+"; "+e.territory+";",
 "ověření textových tvůrců: "+e.textCreators.map(p=>
  p.role+" "+p.name+" († "+p.died+")").join("; ")+
  "; ochranné lhůty všech doložených osob uplynuly nejpozději 1. 1. "+e.publicDomainFrom+".",
 "Bibliografický důkaz "+e.rightsEvidenceUrl+" ("+e.rightsEvidenceSource+").",
 "Nezávislé bajtové porovnání: soukromý EPUB = čerstvě získaný mirror;",
 "SHA-256 "+e.editionSha256+"; "+e.byteCount+" bajtů.",
 e.spineDocuments+" dokumentů, "+e.textCharacters+" znaků, text SHA-256 "+e.sourceTextSha256+".",
 "Kompletní sken textu bez zjištěného zvláštního omezení nebo překladu.",
 e.historicalImprints.length
  ?"Historická vydavatelská označení posouzena podle schváleného roku vydání: "+
    e.historicalImprints.join("; ")+"."
  :"Historická vydavatelská označení nebyla zjištěna.",
 "Všech "+e.privateImages+" obrazových součástí pouze v soukromém archivu, veřejně vyloučeny.",
 "Vznik kontroly "+e.evaluatedAt+". Editor kontroluje následný vizuální a obsahový výstup."
 ].join(" ");
}
