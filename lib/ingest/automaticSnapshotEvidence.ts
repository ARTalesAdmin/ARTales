import {deathTerm} from "@/lib/legal/publicDomainCheck";
import {contributorNameMatch} from "@/lib/legal/bibliographicContributorIdentity";
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
  author_died:number|null;translator_died:number|null;translation_status:string;translator:string|null;translation_rights:string;
  original_rights:string;illustration_use:string;source_terms:string;language_code:string;
  identity_match:string;language_match:string;notes:string|null};
 decision:{source_id:string;decision_no:number;verdict:string;territory:string;rationale?:string};
 riskAccepted?:boolean;riskUncertainties?:string[];
 receipt:{source_id:string;decision_no:number;gutenberg_id:number;catalog_url:string;
  locked_file_url:string;sha256:string;byte_count:number;embedded_images:number;readback_status:string};
 archivedSha256:string;archivedBytes:number;
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
type TextCreatorEvidence={name:string;died:number|null;role:TextCreatorRole;source:string};
type VerifiedTranslatorEvidence={name:string;died:number|null;role:"translator";source:string};
type StoredEvidence={schema?:string;outcome?:string;gutenbergId?:number;
 text?:{status?:string;people?:Array<{name?:string;died?:number;role?:string;source?:string}>};
 translation?:{status?:string;people?:Array<{name?:string;died?:number;role?:string;source?:string}>};illustrations?:{status?:string}};
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
 author:string;authorDied:number|null;publicDomainFrom:number|null;territory:"CZ/EU";
 riskAccepted:boolean;riskUncertainties:string[];
 textCreators:TextCreatorEvidence[];translators:VerifiedTranslatorEvidence[];
 translation:"original"|"public_domain_translation";
 contributorNameMatch:"exact"|"abbreviated_given_names"|"collective";
 rightsEvidenceSource:"live_gutenberg_rdf"|"approved_locked_gutenberg_rdf_evidence"|"approved_gutenberg_catalog_evidence";
 rightsEvidenceUrl:string;textScan:"no_explicit_notice"|"not_checked";images:"exclude_all";
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
 const riskAccepted=i.riskAccepted===true&&
  decision.rationale?.startsWith("ARTALES_RISK_ACCEPTED_V1:")===true;
 const translated=source.translation_status==="translated";
 const originalCleared=source.translation_status==="original"&&
  (source.translator??"").trim()===""&&source.translation_rights==="not_applicable";
 const translationCleared=translated&&(source.translator??"").trim()!==""&&
  source.translation_rights==="public_domain";
 if(decision.verdict!=="approved"||decision.territory!=="CZ/EU"||
  source.identity_match!=="confirmed"||source.language_match!=="matches"||
  source.illustration_use!=="excluded"||
  source.original_rights==="restricted"||source.translation_rights==="restricted"||
  source.source_terms==="restricted"||
  (!riskAccepted&&(source.original_rights!=="public_domain"||
    source.source_terms!=="cleared"||!(originalCleared||translationCleared))))
  refuse("legal_components_not_cleared_for_text_only");
 // Archive integrity is an engineering check, not a second copyright gate.
 // Gutenberg mirrors can serve a different EPUB variant (e.g. with images).
 if(receipt.readback_status!=="sha256_verified"||!shaValid(receipt.sha256)||
  i.archivedSha256!==receipt.sha256||i.archivedBytes!==receipt.byte_count||
  receipt.byte_count<100||receipt.byte_count>8*1024*1024)
  refuse("archived_edition_bytes_mismatch");
 if(i.spineDocuments<1||i.textCharacters<100||!shaValid(i.sourceTextSha256)||
  i.imageCount!==receipt.embedded_images)
  refuse("epub_manifest_incomplete_or_mismatch");
 // Scan only for positive restrictions. A temporarily unavailable/partial
 // metadata scan is an uncertainty in the audit, not positive rights evidence.
 if(i.textCheck.status==="possible_restriction"||i.textCheck.notice)
  refuse("text_contains_explicit_rights_restriction");
 let prior:StoredEvidence;
 try{
  const rawNotes=source.notes;
  if(typeof rawNotes!=="string"||rawNotes.length>100_000)refuse("approved_legal_audit_missing");
  prior=JSON.parse(rawNotes ?? "") as StoredEvidence;
 }catch{refuse("approved_legal_audit_missing");}
 if(prior!.schema!=="artales.public-domain-check.v1"||
  prior!.gutenbergId!==id||
  (!riskAccepted&&!["yes_without_illustrations","yes_with_illustrations"].includes(prior!.outcome??""))||
  !["public_domain",...(riskAccepted?["unknown"]:[])].includes(prior!.text?.status??"")||
  ![translated?"public_domain":"not_applicable",...(riskAccepted?["unknown","not_applicable","public_domain"]:[])].includes(prior!.translation?.status??"")||
  (!riskAccepted&&(!Array.isArray(prior!.text?.people)||!prior!.text!.people!.length))||
  (prior!.text?.people?.length??0)>12)
  refuse("approved_legal_audit_incomplete");
 // Explicitly accepted missing catalog biographies can fall back to the
 // identified candidate byline, marked unknown rather than verified.
 const rawPeople=(prior!.text?.people?.length?prior!.text.people:
   (riskAccepted&&prior!.text?.status==="unknown"?[
    {name:candidate.proposed_author_name,died:source.author_died,role:"author",source:url}
   ]:[]));
 if(!rawPeople.length)refuse("approved_legal_audit_incomplete");
 const rdfUrl="https://www.gutenberg.org/ebooks/"+id+".rdf";
 const legacyAuthor=rawPeople.length===1&&
  rawPeople[0].died===source.author_died&&
  samePerson(rawPeople[0].name??"",candidate.proposed_author_name);
 const textCreators:TextCreatorEvidence[]=rawPeople.map(p=>{
  const role=approvedRole(p.role,legacyAuthor);
  if(!role||typeof p.name!=="string"||!p.name.trim()||
     ![rdfUrl,url].includes(p.source??"")||
     (deathTerm(p.died??null,i.year)!=="public_domain"&&
      !(riskAccepted&&deathTerm(p.died??null,i.year)==="unknown")))
   refuse("text_creator_identity_role_or_death_unverified");
  return {name:p.name!,died:p.died??null,role:role!,source:p.source!};
 });
 // A translation is a separate copyrighted text contribution. Verify every
 // translator against the already approved immutable RDF evidence. The text
 // scanner may report "Translated by"; that is expected only for this branch.
 const rawTranslators=prior!.translation?.people;
 let translators:VerifiedTranslatorEvidence[]=[];
 if(translated){
  if((!riskAccepted&&(!Array.isArray(rawTranslators)||rawTranslators.length<1))||
     (rawTranslators?.length??0)>12)
   refuse("translation_approval_evidence_incomplete");
  translators=(rawTranslators??[]).map(p=>{
   if((p.role!=="překladatel"&&p.role!=="translator")||
      typeof p.name!=="string"||!p.name.trim()||
      ![rdfUrl,url].includes(p.source??"")||
      (deathTerm(p.died??null,i.year)!=="public_domain"&&
       !(riskAccepted&&deathTerm(p.died??null,i.year)==="unknown")))
    refuse("translation_approval_evidence_incomplete");
   return {name:p.name!,died:p.died??null,role:"translator" as const,source:p.source!};
  });
  const recordedNames=(source.translator??"").split(";").map(p=>p.trim()).filter(Boolean);
  if((!riskAccepted&&recordedNames.length!==translators.length)||
     (translators.length>0&&recordedNames.length!==translators.length)||
     recordedNames.some(name=>!translators.some(p=>samePerson(name,p.name)))||
     new Set(translators.map(p=>normalized(p.name).join(":"))).size!==translators.length||
     (source.translator_died!==null&&
      (translators.length!==1||source.translator_died!==translators[0].died)))
   refuse("translation_approval_evidence_incomplete");
 }else if(Array.isArray(rawTranslators)&&rawTranslators.length){
  refuse("translation_approval_evidence_incomplete");
 }
 // Never let one cleared contributor mask another protected/unknown contributor.
 if(new Set(textCreators.map(creatorKey)).size!==textCreators.length)
  refuse("duplicate_text_creator_evidence");
 const candidateMatches=textCreators.map(person=>({
  person,match:contributorNameMatch(candidate.proposed_author_name,person.name)
 })).filter(x=>x.match!==null);
 // Multiple matches must never silently pick a different rights-holder.
 if(candidateMatches.length>1)refuse("candidate_contributor_identity_ambiguous");
 const candidateCreator=candidateMatches[0]?.person;
 const candidateCreatorMatch=candidateMatches[0]?.match??null;
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
 const liveTranslatorEntries=i.liveRdf.contributors.filter(p=>p.role==="marcrel:trl");
 if(!translated&&liveTranslatorEntries.length&&!riskAccepted)
  refuse("live_rdf_translation_requires_separate_clearance");
 if(riskAccepted&&liveTranslatorEntries.some(p=>deathTerm(p.died,i.year)==="protected"))
  refuse("live_rdf_translation_protected");
 if(!i.liveRdf.checked&&liveTranslatorEntries.length)
  refuse("live_rdf_translation_identity_conflict");
 let rightsEvidenceSource:AutomaticEditionEvidence["rightsEvidenceSource"]=
  [...textCreators,...translators].some(p=>p.source===url)
   ?"approved_gutenberg_catalog_evidence":"approved_locked_gutenberg_rdf_evidence";
 if(i.liveRdf.checked){
  if(translated){
   const approved=translators.map(p=>normalized(p.name).join(":")+":"+p.died).sort();
   const live=liveTranslatorEntries.map(p=>normalized(p.name).join(":")+":"+String(p.died)).sort();
   const namesAndDatesMatch=translators.length===liveTranslatorEntries.length&&
    translators.every(old=>liveTranslatorEntries.some(now=>
     samePerson(old.name,now.name)&&
     deathTerm(now.died,i.year)!=="protected"&&
     (now.died===null||old.died===null||now.died===old.died)));
   if(!riskAccepted&&!namesAndDatesMatch)
    refuse("live_rdf_translation_identity_conflict");
   if(riskAccepted&&liveTranslatorEntries.some(p=>deathTerm(p.died,i.year)==="protected"))
    refuse("live_rdf_translation_protected");
  }
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
   if(!sameCreators(textCreators,liveCreators)){
    // Under explicit risk acceptance, a missing historical date is not
    // a contradiction; a different named creator or protected date is.
    const identitiesMatch=liveCreators.length===textCreators.length&&
     textCreators.every(old=>liveCreators.some(now=>creatorKey(old)===creatorKey(now)&&
      deathTerm(now.died,i.year)!=="protected"&&
      // A missing current catalog date cannot override a documented historical
      // identity; a contradictory known year always fails.
      (!Number.isInteger(now.died)||old.died===null||old.died===now.died)));
    // The stored legal evidence still controls the original term. An unknown
    // stored date requires an explicit, recorded risk acceptance.
    const dateUncertaintyAllowed=riskAccepted||textCreators.every(p=>p.died!==null);
    if(!dateUncertaintyAllowed)refuse("live_rdf_contradicts_locked_legal_evidence");
    if(!identitiesMatch)refuse("live_rdf_contradicts_locked_legal_evidence");
   }
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
  publicDomainFrom:[...textCreators,...translators].every(p=>p.died!==null)
   ?Math.max(...textCreators.map(p=>p.died!),...translators.map(p=>p.died!))+71:null,
  textCreators,translators,translation:translated?"public_domain_translation":"original",
  riskAccepted,riskUncertainties:riskAccepted?(i.riskUncertainties??[]):[],
  contributorNameMatch:candidateCreatorMatch??"collective",territory:"CZ/EU",
  rightsEvidenceSource,rightsEvidenceUrl:[...textCreators,...translators].some(p=>p.source===url)?url:rdfUrl,
  textScan:i.textCheck.status==="no_explicit_notice"?"no_explicit_notice":"not_checked",images:"exclude_all",
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
  (e.publicDomainFrom===null
   ?"; nejméně jedna datace zůstává nejistá; editor tuto nejistotu výslovně přijal."
   :"; doložené ochranné lhůty uplynuly nejpozději 1. 1. "+e.publicDomainFrom+"."),
 e.translation==="public_domain_translation"
  ?"Překlad: "+e.translators.map(p=>p.name+" († "+p.died+")").join("; ")+
   "; práva každého překladatele prověřena proti zamčenému RDF auditu."
  :"Původní text bez zjištěného překladu.",
 e.riskAccepted?"NEJISTOTA PŘIJATA OPRÁVNĚNÝM EDITOREM. Nejistoty: "+e.riskUncertainties.join("; ")+". Nejde o právní jistotu.":"Bez výslovně přijatého rizika.",
 "Bibliografický důkaz "+e.rightsEvidenceUrl+" ("+e.rightsEvidenceSource+").",
 "Podoba katalogového jména: "+e.contributorNameMatch+".",
 "Integrita soukromě archivovaného EPUBu potvrzena proti původnímu Snapshot receipt.",
 "SHA-256 "+e.editionSha256+"; "+e.byteCount+" bajtů.",
 e.spineDocuments+" dokumentů, "+e.textCharacters+" znaků, text SHA-256 "+e.sourceTextSha256+".",
 e.textScan==="no_explicit_notice"
  ?"Sken textu nezjistil výslovné zvláštní omezení."
  :"Kompletní obsahový sken nebyl dokončen; absence omezení není samostatně potvrzena.",
 e.historicalImprints.length
  ?"Historická vydavatelská označení posouzena podle schváleného roku vydání: "+
    e.historicalImprints.join("; ")+"."
  :"Historická vydavatelská označení nebyla zjištěna.",
 "Všech "+e.privateImages+" obrazových součástí pouze v soukromém archivu, veřejně vyloučeny.",
 "Vznik kontroly "+e.evaluatedAt+". Editor kontroluje následný vizuální a obsahový výstup."
 ].join(" ");
}
