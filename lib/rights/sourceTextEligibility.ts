import {createHash} from "node:crypto";

/** General CZ/EU + USA source-version preflight: draft eligibility, never release. */
export type RightsPerson=Readonly<{
 name:string;death_year:number|null;living:boolean;evidence_url:string|null;
}>;
export type CapturedPartKind=
 "WORK_CONTENT"|"TRANSLATION"|"ASSET"|"EDITION_CONTENT"|
 "SOURCE_WRAPPER"|"EDITORIAL_ADDITION"|"UNKNOWN";
export type CapturedPart=Readonly<{
 id:string;kind:CapturedPartKind;byte_start:number|null;byte_end:number|null;
}>;
export type UsRightsEvidence=Readonly<{
 status:"public_domain"|"copyrighted"|"permission_only"|"unknown";
 basis:"gutenberg_catalog"|"first_us_publication"|"independent_review"|"none";
 evidence_url:string|null;
 selected_version_publication_year:number|null;
 first_published_in_us:boolean|null;
 review_ref?:string|null;
}>;
export type ExplicitRightsNotice=Readonly<{
 scope:"selected_text"|"translation"|"edition"|"asset"|"wrapper";
 kind:"no_reuse"|"rights_reserved"|"permission_only";
 excerpt:string;evidence_url:string|null;
}>;
export type TextRightsInput=Readonly<{
 candidate_id:string;
 original_authors:readonly RightsPerson[];
 original_language:string;selected_language:string;
 version:"original"|"translation"|"adaptation"|"unknown";
 translators:readonly RightsPerson[];
 edition_contribution:"none"|"separable"|"inseparable"|"unknown";
 source:Readonly<{
  provider:"gutenberg"|"other";
  uri:string;archive_ref:string;captured_at:string;sha256:string;
  bytes:Uint8Array;us_rights:UsRightsEvidence;
  rights_notices:readonly ExplicitRightsNotice[];
 }>;
 components:readonly CapturedPart[];
}>;
export type RightsComponentDecision=Readonly<{
 id:string;kind:CapturedPartKind;action:"include"|"exclude"|"hold";
 reason:string;byte_start:number|null;byte_end:number|null;sha256:string|null;
}>;
export type TextRightsSnapshot=Readonly<{
 schema:"artales.text-rights-screen.v2";
 decision:"eligible_for_editorial_draft"|"find_alternative_source"|"blocked_protected_work"|"needs_facts";
 reason_codes:readonly string[];
 eu_original_status:"term_expired"|"protected"|"unverified";
 eu_translation_status:"term_expired"|"protected"|"unverified"|"not_applicable";
 usa_selected_text_status:"public_domain"|"protected"|"unverified";
 selected_text_status:"eligible"|"protected"|"unverified";
 candidate_id:string;checked_at:string;captured_at:string;
 source_uri:string;source_archive_ref:string;source_sha256:string;
 usa_evidence:UsRightsEvidence;
 original_authors:readonly RightsPerson[];translators:readonly RightsPerson[];
 original_language:string;selected_language:string;version:TextRightsInput["version"];
 rights_notices:readonly ExplicitRightsNotice[];
 components:readonly RightsComponentDecision[];
 included:readonly string[];excluded:readonly string[];
 needs_specialist_review:boolean;publication_authorized:false;
}>;
const hash=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex");
const hex=/^[0-9a-f]{64}$/;
const iso=(s:string)=>typeof s==="string"&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const language=(v:string)=>/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(v);
const normalize=(s:string)=>s.normalize("NFKC").toLocaleLowerCase("en").replace(/\s+/g," ").trim();
const https=(v:string|null)=>typeof v==="string"&&/^https:\/\/[^\s/]+/i.test(v);
const yearOk=(v:number|null,year:number)=>v!==null&&Number.isInteger(v)&&v>=1000&&v<=year;
function euStatus(people:readonly RightsPerson[],year:number):"term_expired"|"protected"|"unverified"{
 if(!people.length||people.some(p=>!p.name.trim()||!https(p.evidence_url)||
  (p.living&&p.death_year!==null)||(p.death_year!==null&&!yearOk(p.death_year,year))))
  return "unverified";
 if(people.some(p=>p.living))return "protected";
 if(people.some(p=>p.death_year===null))return "unverified";
 return people.every(p=>year>p.death_year!+70)?"term_expired":"protected";
}
function usaStatus(e:UsRightsEvidence,provider:TextRightsInput["source"]["provider"],year:number):
 "public_domain"|"protected"|"unverified"{
 if(e.status==="copyrighted"||e.status==="permission_only")return "protected";
 if(e.status!=="public_domain"||!https(e.evidence_url))return "unverified";
 if(e.basis==="gutenberg_catalog"&&provider==="gutenberg"){
  try{
   const u=new URL(e.evidence_url!);
   if(u.protocol==="https:"&&["gutenberg.org","www.gutenberg.org"].includes(u.hostname)&&
      /^\/ebooks\/[0-9]+\/?$/.test(u.pathname)&&!u.search&&!u.hash)return "public_domain";
  }catch{ /* no reliable source */ }
 }
 if(e.basis==="first_us_publication"&&e.first_published_in_us===true&&
   yearOk(e.selected_version_publication_year,year)&&
   year>e.selected_version_publication_year!+95)return "public_domain";
 if(e.basis==="independent_review"&&e.review_ref?.trim())return "public_domain";
 return "unverified";
}
export type GutenbergHeaderCredits=Readonly<{
 author:string|null;translator:string|null;illustrator:string|null;editor:string|null;
 language:string|null;has_start_marker:boolean;copyright_notices:readonly string[];
 licensed_with_permission:boolean;
}>;
/** Machine-readable source facts are indications, not a legal permission. */
export function parseGutenbergHeader(bytes:Uint8Array):GutenbergHeaderCredits{
 const headBytes=bytes.subarray(0,Math.min(bytes.length,32_768));
 const input=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(headBytes);
 const marker=input.match(/^\*\*\* START OF (?:THIS |THE )?PROJECT GUTENBERG EBOOK.*\*\*\*\s*$/im);
 const head=marker?input.slice(0,marker.index):input;
 const field=(label:string)=>head.match(new RegExp("^"+label+":\\s*(.+)$","im"))?.[1]?.trim()??null;
 const lang=field("Language");
 const copyright_notices=head.split(/\r?\n/).map(s=>s.trim()).filter(s=>
   /^(?:Copyright\s*[:©]|\u00a9\s*\d{4}|All rights reserved\b)/i.test(s));
 return {author:field("Author"),translator:field("Translator")||
     head.match(/^Translated by\s+(.+)$/im)?.[1]?.trim()||null,
   illustrator:field("Illustrator"),editor:field("Editor"),
   language:lang?({"english":"en","french":"fr","german":"de","czech":"cs","spanish":"es"}[normalize(lang)]??normalize(lang)):null,
   has_start_marker:Boolean(marker),copyright_notices,
   licensed_with_permission:/(?:with|by)\s+(?:the\s+)?permission\s+of\s+(?:the\s+)?copyright\s+holder/i.test(head),
 };
}
/** Reject unknown metadata; exclude independent images, wrappers and edition extras. */
export function screenCapturedTextRights(input:TextRightsInput,checkedAt:string):TextRightsSnapshot{
 if(!iso(checkedAt)||!iso(input.source.captured_at)||
    Date.parse(input.source.captured_at)>Date.parse(checkedAt))
  throw Error("Invalid rights snapshot time");
 const bytes=input.source.bytes;
 if(!input.candidate_id.trim()||!input.source.uri.trim()||!input.source.archive_ref.trim()||
    !language(input.original_language)||!language(input.selected_language)||
    !bytes.length||bytes.length>5_000_000||!hex.test(input.source.sha256)||
    hash(bytes)!==input.source.sha256)
  throw Error("Untrusted or modified source snapshot");
 const decoded=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(bytes);
 if(Buffer.compare(Buffer.from(decoded,"utf8"),Buffer.from(bytes))!==0)
  throw Error("Source UTF-8 must preserve all bytes");
 const reasons:string[]=[];
 const add=(code:string)=>{if(!reasons.includes(code))reasons.push(code);};
 const currentYear=new Date(checkedAt).getUTCFullYear();
 const original=euStatus(input.original_authors,currentYear);
 const translation=input.version==="translation"?euStatus(input.translators,currentYear):"not_applicable";
 const us=usaStatus(input.source.us_rights,input.source.provider,currentYear);
 if(original==="unverified")add("original_author_facts_missing");
 if(original==="protected")add("original_author_still_protected");
 if(translation==="unverified")add("translator_facts_missing");
 if(translation==="protected")add("translator_still_protected");
 if(us==="unverified")add("usa_rights_facts_missing");
 if(us==="protected")add("usa_selected_text_restricted");
 if(["unknown","adaptation"].includes(input.version))add("selected_text_version_unverified");
 if(input.version==="original"&&input.selected_language!==input.original_language)
  add("language_not_original");
 if(input.version==="translation"&&input.selected_language===input.original_language)
  add("translation_language_ambiguous");
 if(input.version==="original"&&input.translators.length>0)add("translator_unexpected_in_original");
 if(["unknown","inseparable"].includes(input.edition_contribution))
  add("creative_edition_text_unresolved");
 if(input.edition_contribution==="separable"&&
    !input.components.some(p=>["EDITION_CONTENT","EDITORIAL_ADDITION"].includes(p.kind)))
  add("edition_additions_not_separated");
 if(input.source.rights_notices.some(n=>!n.excerpt.trim()||!https(n.evidence_url)))
  add("rights_notice_evidence_missing");
 if(input.source.rights_notices.some(n=>
   (["selected_text","translation"].includes(n.scope)||
    n.scope==="edition"&&input.edition_contribution==="inseparable")))
  add("explicit_selected_text_restriction");

 if(input.source.provider==="gutenberg"){
  const header=parseGutenbergHeader(bytes);
  if(!header.has_start_marker||!header.author||
    !input.original_authors.some(p=>normalize(p.name)===normalize(header.author!)))
   add("gutenberg_author_metadata_mismatch");
  if(header.language!==input.selected_language)add("gutenberg_language_metadata_mismatch");
  if(header.translator){
   if(input.version!=="translation")add("gutenberg_translation_discovered");
   if(!input.translators.some(p=>normalize(header.translator!).includes(normalize(p.name))))
    add("gutenberg_translator_metadata_mismatch");
  }else if(input.version==="translation"&&!input.translators.length)
   add("translator_facts_missing");
  if(header.copyright_notices.length||header.licensed_with_permission)
   add("gutenberg_explicit_copyright_warning");
 }

 const seen=new Set<string>();
 if(!input.components.length)throw Error("Missing source components");
 for(const c of input.components){
  if(!c.id||seen.has(c.id))throw Error("Invalid or duplicate source components");
  seen.add(c.id);
  if((c.byte_start===null)!==(c.byte_end===null)||
    (c.byte_start!==null&&(!Number.isSafeInteger(c.byte_start)||!Number.isSafeInteger(c.byte_end)||
       c.byte_start<0||c.byte_end!<=c.byte_start||c.byte_end!>bytes.length)))
    throw Error("Invalid source component boundary");
 }
 const ranges=input.components.filter(c=>c.byte_start!==null)
  .slice().sort((a,b)=>a.byte_start!-b.byte_start!);
 let cursor=0;
 for(const p of ranges){
  if(p.byte_start!==cursor)throw Error("Source component coverage gap or overlap");
  cursor=p.byte_end!;
 }
 if(cursor!==bytes.length)throw Error("Source component inventory must cover archived bytes");
 if(input.components.some(c=>c.kind==="UNKNOWN"))add("unknown_source_component");
 const selectedKind:CapturedPartKind=input.version==="translation"?"TRANSLATION":"WORK_CONTENT";
 const selected=input.components.filter(c=>c.kind===selectedKind&&c.byte_start!==null);
 if(!selected.length)add("selected_text_not_captured");
 for(const c of selected){
  const text=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true})
   .decode(bytes.subarray(c.byte_start!,c.byte_end!));
  if(/\[(?:Illustration|Image|Translation|Translator|Translated by)\b/i.test(text))
   add("embedded_rights_components_unseparated");
 }
 let decision:TextRightsSnapshot["decision"]="eligible_for_editorial_draft";
 if(original==="protected")decision="blocked_protected_work";
 else if(translation==="protected"||us==="protected"||
   reasons.some(s=>["explicit_selected_text_restriction","gutenberg_explicit_copyright_warning",
    "gutenberg_translation_discovered","selected_text_version_unverified",
    "creative_edition_text_unresolved","embedded_rights_components_unseparated"].includes(s)))
  decision="find_alternative_source";
 else if(reasons.length)decision="needs_facts";
 const components:RightsComponentDecision[]=input.components.map(c=>{
  const isText=c.kind===selectedKind&&c.byte_start!==null;
  const span=c.byte_start===null?null:bytes.subarray(c.byte_start,c.byte_end!);
  return {
   id:c.id,kind:c.kind,
   action:isText?(decision==="eligible_for_editorial_draft"?"include":"hold"):"exclude",
   reason:isText?(decision==="eligible_for_editorial_draft"?
     "Selected original or separately cleared translation":"Selected text needs alternative source or rights facts"):
     "Omitted from literary draft; retained in exact captured source.",
   byte_start:c.byte_start,byte_end:c.byte_end,sha256:span?hash(span):null,
  };
 });
 return {
  schema:"artales.text-rights-screen.v2",decision,reason_codes:reasons,
  eu_original_status:original,eu_translation_status:translation,
  usa_selected_text_status:us,
  selected_text_status:decision==="eligible_for_editorial_draft"?"eligible":
   decision==="needs_facts"?"unverified":"protected",
  candidate_id:input.candidate_id,checked_at:checkedAt,captured_at:input.source.captured_at,
  source_uri:input.source.uri,source_archive_ref:input.source.archive_ref,
  source_sha256:input.source.sha256,usa_evidence:input.source.us_rights,
  original_authors:input.original_authors,translators:input.translators,
  original_language:input.original_language,selected_language:input.selected_language,
  version:input.version,rights_notices:input.source.rights_notices,components,
  included:decision==="eligible_for_editorial_draft"?
   components.filter(c=>c.action==="include").map(c=>c.id):[],
  excluded:components.filter(c=>c.action==="exclude").map(c=>c.id),
  needs_specialist_review:reasons.some(s=>[
    "unknown_source_component","creative_edition_text_unresolved",
    "gutenberg_author_metadata_mismatch","gutenberg_translator_metadata_mismatch",
    "gutenberg_explicit_copyright_warning","rights_notice_evidence_missing"].includes(s)),
  publication_authorized:false,
 };
}
