import {NextResponse} from "next/server";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {getMatchingGutenberg,legalFacts} from "@/lib/legal/automaticAssessment";
import {getGutenbergRights} from "@/lib/legal/gutenbergRights";
import {checkGutenbergText} from "@/lib/legal/textRightsCheck";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
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
  const people=rights.people.length?rights.people:book.authors;
  const enriched={...book,authors:people};
  const facts=legalFacts(enriched,2026,prescreenDeath);
  // US status is evidence only; retain CZ/EU source clearance as a distinct unresolved decision.
  const textCheck=await checkGutenbergText(book);
  const details={...facts,textCheck,sourceMetadata:{rdfUrl:rights.url,usStatus:rights.usStatus,contributors:rights.contributors}};
  // Save the evidence and the preliminary verdict, not a final copyright approval.
  const payload={
   candidate_id:id,source_kind:"gutenberg",edition_title:book.title,
   source_url:book.catalogUrl,download_url:file.url,
   read_url:book.readUrl,translation_status:book.translators.length?"translated":"unknown",
   language_code:book.languages[0]??"",translator:book.translators.map(p=>p.name).join("; ").slice(0,300),
   author_died:people.length===1?people[0].died:null,
   translator_died:book.translators.length===1?book.translators[0].died:null,
   text_format:file.format,identity_match:"confirmed",language_match:"uncertain",
   completeness:"unknown",text_quality:"unknown",original_rights:"unknown",
   translation_rights:"unknown",illustration_use:"unknown",source_terms:"unknown",
   evidence_url:book.catalogUrl,notes:JSON.stringify(details).slice(0,4900),
   created_by:profile.id,updated_by:profile.id
  };
  const {data:previous}=await db.from("candidate_legal_sources").select("id").eq("candidate_id",id).eq("source_url",book.catalogUrl).eq("download_url",file.url).maybeSingle();
  let sourceId=previous?.id as string|undefined;
  if(!sourceId){
   const inserted=await db.from("candidate_legal_sources").insert(payload).select("id").single();
   if(inserted.error)return NextResponse.json({error:"cannot_save_source"},{status:500});
   sourceId=inserted.data.id;
  }
  const rationale="Automaticky připravený komponentní právní screen: "+facts.reason+"; "+facts.author.status+"; "+facts.translation.status+"; kontrola textu: "+textCheck.status+"; "+(textCheck.notice??textCheck.explanation).slice(0,230)+ ".";
  const decision=await db.from("candidate_legal_decisions").insert({candidate_id:id,source_id:sourceId,verdict:"needs_evidence",territory:"CZ/EU",rationale,reviewed_by:profile.id}).select("decision_no,recorded_at").single();
  if(decision.error)return NextResponse.json({error:"cannot_save_audit"},{status:500});
  return NextResponse.json({sourceId,decisionNo:decision.data.decision_no,bookId:book.id,title:book.title,file,componentFacts:facts,textCheck,rights,alternativeCount:found.matches.length-1,recordedAt:decision.data.recorded_at},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({error:"catalog_unavailable"},{status:503})}
}
