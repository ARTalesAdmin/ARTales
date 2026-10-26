import {NextResponse} from "next/server";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {getMatchingGutenberg,legalFacts} from "@/lib/legal/automaticAssessment";
import {getGutenbergRights} from "@/lib/legal/gutenbergRights";
import {getOpenLibraryHint} from "@/lib/legal/openLibraryHint";
import {checkGutenbergText} from "@/lib/legal/textRightsCheck";
import {inspectGutenbergEpub} from "@/lib/legal/epubInspection";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
import {assessPublicDomain,compactCheckEvidence} from "@/lib/legal/publicDomainCheck";
export const runtime="nodejs";
export async function POST(_req:Request,{params}:{params:Promise<{id:string}>}){
 if(!LEGAL_SCREEN_V1_ENABLED)return NextResponse.json({error:"disabled"},{status:404});
 const profile=await requireEditorOrAdmin();
 const {id}=await params;
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))return NextResponse.json({error:"invalid"},{status:400});
 const db=await createClient();
 const {data:c}=await db.from("work_candidates").select("proposed_title,proposed_author_name,prescreen_metadata").eq("id",id).maybeSingle();
 if(!c)return NextResponse.json({error:"candidate_missing"},{status:404});
 const {data:locked}=await db.from("candidate_legal_locks").select("candidate_id").eq("candidate_id",id).maybeSingle();
 if(locked)return NextResponse.json({error:"already_locked"},{status:409});
 try{
  const found=await getMatchingGutenberg(c.proposed_title,c.proposed_author_name);
  if(!found.selected)return NextResponse.json({error:"no_verified_file",matches:found.matches.map(b=>({id:b.id,title:b.title,url:b.catalogUrl}))},{status:422});
  const book=found.selected;
  const file=book.files.find(f=>f.format==="html")??book.files.find(f=>f.format==="plain_text")??book.files[0];
  const year=Number((c.prescreen_metadata as {authorDied?:number}|null)?.authorDied);
  const prescreenDeath=Number.isInteger(year)&&year>=1000&&year<=2026?year:null;
  const rights=await getGutenbergRights(book);
  const openLibrary=rights.people.some(p=>p.died===null)||!rights.people.length?await getOpenLibraryHint(book.title,c.proposed_author_name):null;
  const people=rights.people.length?rights.people:book.authors;
  const named=book.authors.length===1?book.authors[0]:null;
  const mergedPeople=people.map(p=>({...p,died:p.died??(people.length===1&&named?.died!==null?named?.died??null:null)}));
  const rolePeople=(roles:string[])=>rights.contributors.filter(p=>roles.some(role=>p.role.toLowerCase().endsWith(":"+role))).map(p=>({name:p.name,died:p.died}));
  const translators=rolePeople(["trl"]);
  const illustrators=rolePeople(["ill","art"]);
  const enriched={...book,authors:mergedPeople,translators:translators.length?translators:book.translators};
  // Language equality is indicative only; translator credits take precedence.
  const originalLanguageConfirmed=false; // Language alone cannot establish that a particular edition is not translated.
  const facts=legalFacts(enriched,2026,prescreenDeath,{originalLanguageConfirmed,illustrators,usStatus:rights.usStatus});
  // US status is evidence only; retain CZ/EU source clearance as a distinct unresolved decision.
  const [textCheck,epub]=await Promise.all([checkGutenbergText(book),inspectGutenbergEpub(book)]);
  const rawFirstPublished=Number((c.prescreen_metadata as {firstPublished?:number}|null)?.firstPublished);
  const firstPublication=openLibrary?.firstPublishYear??(Number.isInteger(rawFirstPublished)&&rawFirstPublished>=1400&&rawFirstPublished<=2026?rawFirstPublished:null);
  const check=assessPublicDomain({book:enriched,rights,prescreenDeath,candidateAuthor:c.proposed_author_name,originalPublicationYear:firstPublication,textCheck,epub,year:2026});
  const textRestriction=textCheck.status==="possible_restriction"||!!epub.notice;
  const translationUnresolved=enriched.translators.length>0?facts.translation.status!=="likely_public_domain":epub.translationCredit||textCheck.translationCredit;
  const recommendation=facts.author.status==="protected"?"exclude":
   facts.author.status!=="likely_public_domain"||textRestriction||translationUnresolved?"review":
   "text_only";
  const recommendationReason=recommendation==="text_only"
   ?"Ochranná doba původního autora uplynula. Doporučen pouze původní text bez ilustrací; před uzamčením potvrdit shodu konkrétního souboru a nepřítomnost překladu."
   :recommendation==="exclude"?"Ochranná doba původního autora dosud trvá."
   :textRestriction?"Ve zdroji bylo nalezeno upozornění vyžadující kontrolu."
   :translationUnresolved?"Překlad nebo práva překladatele vyžadují ověření."
   :"Chybí rozhodující údaje pro doporučení.";
  const details={...facts,recommendation,recommendationReason,textCheck,epub,sourceMetadata:{rdfUrl:rights.url,usStatus:rights.usStatus,contributors:rights.contributors,openLibrary}};
  // Save the evidence and the preliminary verdict, not a final copyright approval.
  const payload={
   candidate_id:id,source_kind:"gutenberg",edition_title:book.title,
   source_url:book.catalogUrl,download_url:file.url,
   read_url:book.readUrl,translation_status:check.translation.people.length?"translated":check.translation.status==="not_applicable"?"original":"unknown",
   language_code:book.languages[0]??"",translator:enriched.translators.map(p=>p.name).join("; ").slice(0,300),
   author_died:mergedPeople.length===1?mergedPeople[0].died??prescreenDeath:null,
   translator_died:enriched.translators.length===1?enriched.translators[0].died:null,
   text_format:file.format,identity_match:"confirmed",language_match:check.text.status==="public_domain"?"matches":"uncertain",
   completeness:"unknown",text_quality:"unknown",original_rights:check.text.status==="public_domain"?"public_domain":"unknown",
   translation_rights:check.translation.status==="not_applicable"?"not_applicable":check.translation.status==="public_domain"?"public_domain":"unknown",illustration_use:check.outcome==="yes_with_illustrations"?"public_domain":"excluded",source_terms:check.gutenbergUsStatus==="public_domain"&&check.sourceTextStatus!=="possible_restriction"?"cleared":"unknown",
   evidence_url:book.catalogUrl,notes:compactCheckEvidence(check),
   created_by:profile.id,updated_by:profile.id
  };
  const {data:previous}=await db.from("candidate_legal_sources").select("id").eq("candidate_id",id).eq("source_url",book.catalogUrl).eq("download_url",file.url).maybeSingle();
  let sourceId=previous?.id as string|undefined;
  if(!sourceId){
   const inserted=await db.from("candidate_legal_sources").insert(payload).select("id").single();
   if(inserted.error)return NextResponse.json({error:"cannot_save_source"},{status:500});
   sourceId=inserted.data.id;
  }
  const rationale="Automaticky připravený komponentní právní screen: "+facts.reason+"; "+facts.author.status+"; "+facts.translation.status+"; kontrola textu: "+textCheck.status+"; "+(textCheck.notice??textCheck.explanation).slice(0,230)+ ". Výsledek datací: "+check.outcome+".";
  const decision=await db.from("candidate_legal_decisions").insert({candidate_id:id,source_id:sourceId,verdict:"needs_evidence",territory:"CZ/EU",rationale,reviewed_by:profile.id}).select("decision_no,recorded_at").single();
  if(decision.error)return NextResponse.json({error:"cannot_save_audit"},{status:500});
  return NextResponse.json({sourceId,decisionNo:decision.data.decision_no,bookId:book.id,title:book.title,file,componentFacts:facts,check,recommendation,recommendationReason,textCheck,epub,rights,openLibrary,alternativeCount:found.matches.length-1,recordedAt:decision.data.recorded_at},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({error:"catalog_unavailable"},{status:503})}
}
