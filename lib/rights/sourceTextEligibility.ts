import {createHash} from "node:crypto";

/**
 * General CZ/EU text-only editorial gate. One author + selected text version,
 * with separate translation, edition and image treatment. Not a release gate.
 * Captured bytes and facts must come from trusted capture/metadata adapters,
 * not unchecked AI assertions or caller-controlled publication permissions.
 */
export type RightsPerson = Readonly<{
 name:string;
 death_year:number|null;
 living:boolean;
 evidence_url:string|null;
}>;
export type CapturedPartKind =
 "WORK_CONTENT"|"TRANSLATION"|"ASSET"|"EDITION_CONTENT"|
 "SOURCE_WRAPPER"|"EDITORIAL_ADDITION"|"UNKNOWN";
export type CapturedPart = Readonly<{
 id:string;kind:CapturedPartKind;
 byte_start:number|null;byte_end:number|null;
}>;
export type TextRightsInput = Readonly<{
 candidate_id:string;
 original_authors:readonly RightsPerson[];
 original_language:string;
 selected_language:string;
 version:"original"|"translation"|"adaptation"|"unknown";
 translators:readonly RightsPerson[];
 edition_contribution:"none"|"separable"|"inseparable"|"unknown";
 source:Readonly<{
  provider:"gutenberg"|"other";uri:string;archive_ref:string;
  captured_at:string;sha256:string;bytes:Uint8Array;
 }>;
 components:readonly CapturedPart[];
}>;
export type RightsComponentDecision = Readonly<{
 id:string;kind:CapturedPartKind;
 action:"include"|"exclude"|"hold";
 reason:string;byte_start:number|null;byte_end:number|null;sha256:string|null;
}>;
export type TextRightsSnapshot = Readonly<{
 schema:"artales.text-rights-screen.v1";
 decision:"eligible_for_editorial_draft"|"find_alternative_source"|"needs_facts";
 reason_codes:readonly string[];
 original_status:"term_expired"|"protected"|"unverified";
 selected_text_status:"eligible"|"protected"|"unverified";
 candidate_id:string;checked_at:string;captured_at:string;
 source_uri:string;source_archive_ref:string;source_sha256:string;
 original_authors:readonly RightsPerson[];
 translators:readonly RightsPerson[];
 original_language:string;selected_language:string;
 version:TextRightsInput["version"];
 components:readonly RightsComponentDecision[];
 included:readonly string[];excluded:readonly string[];
 needs_specialist_review:boolean;
 publication_authorized:false;
}>;
const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
const hex=/^[0-9a-f]{64}$/;
const iso=(value:string)=>typeof value==="string"&&
 Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const language=(v:string)=>/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(v);
const normalize=(s:string)=>s.normalize("NFKC").toLocaleLowerCase("en").replace(/\s+/g," ").trim();
const url=(value:string|null)=>typeof value==="string"&&/^https:\/\/[^\s/]+/i.test(value);
const validYear=(v:number|null,year:number)=>v!==null&&Number.isInteger(v)&&v>=1000&&v<=year;
function status(people:readonly RightsPerson[],year:number):"term_expired"|"protected"|"unverified"{
 if(people.length===0||people.some(p=>!p.name.trim()||!url(p.evidence_url)||
   (p.living&&p.death_year!==null)||
   (p.death_year!==null&&!validYear(p.death_year,year))))return "unverified";
 if(people.some(p=>p.living))return "protected";
 if(people.some(p=>p.death_year===null))return "unverified";
 // Expiration at the beginning of the year following death-year+70.
 return people.every(p=>year>p.death_year!+70)?"term_expired":"protected";
}
export type GutenbergHeaderCredits=Readonly<{
 author:string|null;translator:string|null;illustrator:string|null;editor:string|null;
 language:string|null;has_start_marker:boolean;
}>;
/** Reads machine-readable Gutenberg credits *before* the work content marker. */
export function parseGutenbergHeader(bytes:Uint8Array):GutenbergHeaderCredits{
 const header=new TextDecoder("utf-8",{fatal:true}).decode(bytes.subarray(0,Math.min(bytes.length,32_768)));
 const m=header.match(/^\*\*\* START OF (?:THIS |THE )?PROJECT GUTENBERG EBOOK.*\*\*\*\s*$/im);
 const head=m?header.slice(0,m.index):header;
 const field=(label:string)=>head.match(new RegExp("^"+label+":\\s*(.+)$","im"))?.[1]?.trim()??null;
 const lang=field("Language");
 return {author:field("Author"),translator:field("Translator")||
    head.match(/^Translated by\s+(.+)$/im)?.[1]?.trim()||null,
  illustrator:field("Illustrator"),editor:field("Editor"),
  language:lang?({"english":"en","french":"fr","german":"de","czech":"cs","spanish":"es"}[normalize(lang)]??normalize(lang)):null,
  has_start_marker:Boolean(m)};
}
/**
 * A negative decision never passes component IDs to a downstream ingest writer.
 * Excluded components are retained in the source snapshot, never deleted from it.
 */
export function screenCapturedTextRights(input:TextRightsInput,checkedAt:string):TextRightsSnapshot{
 if(!iso(checkedAt)||!iso(input.source.captured_at)||
    Date.parse(input.source.captured_at)>Date.parse(checkedAt))
  throw Error("Invalid rights snapshot time");
 const bytes=input.source.bytes;
 if(!input.candidate_id.trim()||!input.source.uri.trim()||!input.source.archive_ref.trim()||
    !language(input.original_language)||!language(input.selected_language)||
    bytes.length===0||bytes.length>5_000_000||
    !hex.test(input.source.sha256)||hash(bytes)!==input.source.sha256)
  throw Error("Untrusted or modified source snapshot");
 const decoded=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
 if(Buffer.compare(Buffer.from(decoded,"utf8"),Buffer.from(bytes))!==0)
  throw Error("Source UTF-8 must preserve all bytes");
 const reasons:string[]=[];
 const add=(reason:string)=>{if(!reasons.includes(reason))reasons.push(reason);};
 const year=new Date(checkedAt).getUTCFullYear();
 const original=status(input.original_authors,year);
 if(original==="unverified")add("original_author_facts_missing");
 if(original==="protected")add("original_author_still_protected");
 if(input.version==="unknown"||input.version==="adaptation")add("selected_text_version_unverified");
 if(input.version==="original"&&input.selected_language!==input.original_language)
  add("language_not_original");
 if(input.version==="translation"&&input.selected_language===input.original_language)
  add("translation_language_ambiguous");
 if(input.edition_contribution==="unknown"||input.edition_contribution==="inseparable")
  add("creative_edition_text_unresolved");
 let credits:GutenbergHeaderCredits|null=null;
 if(input.source.provider==="gutenberg"){
  credits=parseGutenbergHeader(bytes);
  if(!credits.has_start_marker||!credits.author||
    !input.original_authors.some(p=>normalize(p.name)===normalize(credits!.author!)))
   add("gutenberg_author_metadata_mismatch");
  if(credits.language!==input.selected_language)add("gutenberg_language_metadata_mismatch");
  if(credits.translator){
   if(input.version!=="translation")add("gutenberg_translation_discovered");
   if(!input.translators.some(p=>normalize(credits!.translator!).includes(normalize(p.name))))
    add("gutenberg_translator_metadata_mismatch");
  }else if(input.version==="translation"&&input.translators.length===0)
   add("translator_facts_missing");
 }
 const translation=input.version==="translation"?status(input.translators,year):"term_expired";
 if(input.version==="translation"&&translation==="unverified")add("translator_facts_missing");
 if(input.version==="translation"&&translation==="protected")add("translator_still_protected");
 if(input.version==="original"&&input.translators.length>0)add("translator_unexpected_in_original");
 if(input.edition_contribution==="separable"&&
  !input.components.some(c=>c.kind==="EDITION_CONTENT"||c.kind==="EDITORIAL_ADDITION"))
  add("edition_additions_not_separated");

 const seen=new Set<string>();
 const ranged=input.components.filter(p=>p.byte_start!==null||p.byte_end!==null);
 const spans=ranged.map(c=>({id:c.id,start:c.byte_start,end:c.byte_end}))
  .sort((a,b)=>(a.start??-1)-(b.start??-1));
 if(input.components.length===0||input.components.some(p=>
    !p.id||seen.has(p.id)||(seen.add(p.id),false)||
    ((p.byte_start===null)!==(p.byte_end===null))||
    (p.byte_start!==null&&(!Number.isSafeInteger(p.byte_start)||!Number.isSafeInteger(p.byte_end)||
     p.byte_start<0||p.byte_end!<=p.byte_start||p.byte_end!>bytes.length))))
  throw Error("Invalid or duplicate source component boundaries");
 let cursor=0;
 for(const span of spans){
  if(span.start!==cursor)throw Error("Source component coverage gap or overlap");
  cursor=span.end!;
 }
 if(cursor!==bytes.length)throw Error("Source component inventory must cover archived bytes");
 if(input.components.some(c=>c.kind==="UNKNOWN"))add("unknown_source_component");
 const selectedKind:CapturedPartKind=input.version==="translation"?"TRANSLATION":"WORK_CONTENT";
 const textParts=input.components.filter(c=>c.kind===selectedKind&&c.byte_start!==null);
 if(textParts.length===0)add("selected_text_not_captured");
 for(const part of textParts){
  const text=new TextDecoder("utf-8",{fatal:true})
   .decode(bytes.subarray(part.byte_start!,part.byte_end!));
  if(/\[(?:Illustration|Image|Translation|Translator|Translated by)\b/i.test(text))
   add("embedded_rights_components_unseparated");
 }
 let decision:TextRightsSnapshot["decision"]="eligible_for_editorial_draft";
 if(original==="protected"||translation==="protected"||
   reasons.some(x=>["gutenberg_translation_discovered","language_not_original",
    "original_author_still_protected","translator_still_protected",
    "selected_text_version_unverified","creative_edition_text_unresolved",
    "embedded_rights_components_unseparated"].includes(x)))
  decision="find_alternative_source";
 else if(reasons.length>0)decision="needs_facts";
 const components:RightsComponentDecision[]=input.components.map(c=>{
  const inclusion=c.kind===selectedKind&&c.byte_start!==null;
  return {id:c.id,kind:c.kind,
   action:inclusion?(decision==="eligible_for_editorial_draft"?"include":"hold"):"exclude",
   reason:inclusion?(decision==="eligible_for_editorial_draft"?"Original or independently cleared translated text":"Selected text requires alternate version or facts"):
     "Excluded from text-only ingest; retained in immutable captured source.",
   byte_start:c.byte_start,byte_end:c.byte_end,
   sha256:c.byte_start===null?null:hash(bytes.subarray(c.byte_start,c.byte_end!))};
 });
 return {
  schema:"artales.text-rights-screen.v1",decision,reason_codes:reasons,
  original_status:original,selected_text_status:decision==="eligible_for_editorial_draft"?"eligible":
   decision==="find_alternative_source"?"protected":"unverified",
  candidate_id:input.candidate_id,checked_at:checkedAt,captured_at:input.source.captured_at,
  source_uri:input.source.uri,source_archive_ref:input.source.archive_ref,
  source_sha256:input.source.sha256,original_authors:input.original_authors,
  translators:input.translators,original_language:input.original_language,
  selected_language:input.selected_language,version:input.version,components,
  included:decision==="eligible_for_editorial_draft"?components.filter(c=>c.action==="include").map(c=>c.id):[],
  excluded:components.filter(c=>c.action==="exclude").map(c=>c.id),
  needs_specialist_review:reasons.some(x=>["unknown_source_component","creative_edition_text_unresolved",
   "gutenberg_author_metadata_mismatch","gutenberg_translator_metadata_mismatch"].includes(x)),
  publication_authorized:false,
 };
}
