import {createHash} from "node:crypto";
import {isCandidateUuid} from "@/lib/ingest/candidateUuid";
import {NextResponse} from "next/server";
import {requireEditorOrAdmin} from "@/lib/guards";
import {canProgressCandidate} from "@/lib/editorial/candidateAuthority";
import {createClient} from "@/lib/supabase/server";
import {SNAPSHOT_GENERAL_V1_ENABLED} from "@/lib/ingest/snapshotGeneralFlag";
import {SEMANTIC_PIPELINE_ENABLED} from "@/lib/semantic/featureFlag";
import {extractEpub} from "@/lib/ingest/epubSemanticExtractor";
import {inspectGutenbergText} from "@/lib/legal/textRightsCheck";
import {getGutenbergRights} from "@/lib/legal/gutenbergRights";
import {verifyAutomaticEdition,formatAutomaticEditionAudit,AutomaticEditionHold} from "@/lib/ingest/automaticSnapshotEvidence";
import {composeSemanticRevision,verifySemanticRevision} from "@/lib/semantic/compose";
import type {GutenbergBook} from "@/lib/legal/gutenbergCatalog";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const sha=(v:Uint8Array)=>createHash("sha256").update(v).digest("hex");

export async function POST(req:Request,{params}:{params:Promise<{candidateId:string}>}){
 if(!SNAPSHOT_GENERAL_V1_ENABLED||!SEMANTIC_PIPELINE_ENABLED)
  return NextResponse.json({error:"pipeline_disabled"},{status:503});
 if(!["https://artales.net","https://www.artales.net"].includes(req.headers.get("origin")??"")||
    (req.headers.get("sec-fetch-site")&&req.headers.get("sec-fetch-site")!=="same-origin"))
  return NextResponse.json({error:"invalid_origin"},{status:403});
 const actor=await requireEditorOrAdmin(),{candidateId}=await params;
 if(!isCandidateUuid(candidateId))return NextResponse.json({error:"invalid_candidate"},{status:400});
 if(!await canProgressCandidate(candidateId,actor))
  return NextResponse.json({error:"candidate_progress_forbidden"},{status:403});
 const db=await createClient();
 const [candidateResult,lockResult,receiptResult,existingResult]=await Promise.all([
  db.from("work_candidates").select("proposed_title,proposed_author_name").eq("id",candidateId).maybeSingle(),
  db.from("candidate_legal_locks").select("source_id,decision_no,source_url,download_url,source_facts").eq("candidate_id",candidateId).maybeSingle(),
  db.from("candidate_snapshots").select("source_id,decision_no,gutenberg_id,catalog_url,locked_file_url,sha256,byte_count,embedded_images,readback_status,storage_bucket,storage_path").eq("candidate_id",candidateId).maybeSingle(),
  db.from("candidate_semantic_revisions").select("revision_sha256").eq("candidate_id",candidateId).limit(1).maybeSingle()
 ]);
 if(candidateResult.error||lockResult.error||receiptResult.error||existingResult.error||
  !candidateResult.data||!lockResult.data||!receiptResult.data)
  return NextResponse.json({error:"linked_evidence_unavailable"},{status:409});
 if(existingResult.data)return NextResponse.redirect(new URL("/member/editorial-detail/"+candidateId+"?composed=1#tasks",req.url),303);
 const candidate=candidateResult.data,lock=lockResult.data,receipt=receiptResult.data;
 const [src,decision,file]=await Promise.all([
  db.from("candidate_legal_sources").select("id,source_kind,edition_title,source_url,download_url,author_died,translator_died,translation_status,translator,translation_rights,original_rights,illustration_use,source_terms,language_code,identity_match,language_match,notes").eq("id",lock.source_id).eq("candidate_id",candidateId).maybeSingle(),
  db.from("candidate_legal_decisions").select("source_id,decision_no,verdict,territory").eq("candidate_id",candidateId).eq("decision_no",lock.decision_no).maybeSingle(),
  db.storage.from(receipt.storage_bucket).download(receipt.storage_path)
 ]);
 if(src.error||decision.error||file.error||!src.data||!decision.data||!file.data)
  return NextResponse.json({error:"legal_or_archive_unavailable"},{status:409});
 const bytes=new Uint8Array(await file.data.arrayBuffer());
 const archivedSha256=sha(bytes);
 if(bytes.length!==receipt.byte_count||archivedSha256!==receipt.sha256)
  return NextResponse.json({error:"archive_sha_or_size_mismatch"},{status:409});
 let extract;
 try{extract=extractEpub(bytes);}catch{return NextResponse.json({error:"invalid_archived_epub"},{status:422});}
 // The approved immutable legal audit is the only source of the publication
 // date used to classify a standalone historical title-page copyright.
 // Never infer it from the text being scanned or from the file name.
 let approvedOriginalPublicationYear:number|null=null;
 try{
  const legalAudit=JSON.parse(src.data.notes??"{}") as {
   schema?:string;gutenbergId?:number;originalPublicationYear?:number
  };
  if(legalAudit.schema==="artales.public-domain-check.v1"&&
     legalAudit.gutenbergId===receipt.gutenberg_id&&
     Number.isSafeInteger(legalAudit.originalPublicationYear))
   approvedOriginalPublicationYear=legalAudit.originalPublicationYear!;
 }catch{}
 const textCheck=inspectGutenbergText(extract.text,true,{
  approvedOriginalPublicationYear,currentYear:new Date().getUTCFullYear()
 });
 const rdfBook: GutenbergBook={id:receipt.gutenberg_id,title:candidate.proposed_title,
  authors:[],translators:[],languages:[src.data.language_code],catalogUrl:receipt.catalog_url,
  files:[],readUrl:null,usCopyrightFlag:null};
 const liveRdf=await getGutenbergRights(rdfBook);
 let proof;
 try{
  proof=verifyAutomaticEdition({
   candidate,lock,source:src.data,decision:decision.data,receipt,
   archivedSha256,archivedBytes:bytes.length,spineDocuments:extract.documents.length,
   textCharacters:extract.text.length,sourceTextSha256:extract.text_sha256,
   imageCount:extract.assets.length,textCheck,liveRdf,
   verifiedAt:new Date().toISOString(),year:new Date().getUTCFullYear()
  });
 }catch(e){
  return NextResponse.json({error:e instanceof AutomaticEditionHold?e.reason:"evidence_not_verified"},{status:409});
 }
 const {data:review,error:reviewError}=await db.from("candidate_snapshot_reviews")
  .select("text_correspondence,image_disposition").eq("candidate_id",candidateId)
  .order("reviewed_at",{ascending:false}).order("id",{ascending:false}).limit(1).maybeSingle();
 if(reviewError||review?.text_correspondence==="rejected"||
    (review&&review.text_correspondence==="confirmed"&&review.image_disposition!=="exclude_all"))
  return NextResponse.json({error:"conflicting_prior_review"},{status:409});
 if(review?.text_correspondence!=="confirmed"){
  const {error:e}=await db.from("candidate_snapshot_reviews").insert({
   candidate_id:candidateId,snapshot_sha256:receipt.sha256,
   text_correspondence:"confirmed",image_disposition:"exclude_all",
   evidence_note:formatAutomaticEditionAudit(proof).slice(0,4000),reviewed_by:actor.id
  });
  if(e)return NextResponse.json({error:"automatic_evidence_insert_failed"},{status:409});
 }
 const revision=composeSemanticRevision({
  work_id:candidateId,work_slug:"candidate-"+candidateId,
  snapshot_ref:"sha256:"+receipt.sha256,source_bytes_sha256:extract.text_sha256,
  component_id:extract.component_id,original_byte_start:0,original_raw:extract.text
 });
 verifySemanticRevision(revision,extract.text);
 const {error:composeError}=await db.from("candidate_semantic_revisions").insert({
  candidate_id:candidateId,snapshot_sha256:receipt.sha256,
  revision_sha256:revision.revision_sha256,revision,source_text:extract.text,
  component_id:extract.component_id,source_manifest:{documents:extract.documents,
   assets:extract.assets,epub_sha256:extract.epub_sha256,
   automaticEditionEvidence:proof},image_selection:"none",status:"draft",authored_by:actor.id
 });
 if(composeError){
  // Diagnostic code only, not document content or private data.
  console.error("artales_auto_compose_insert_failed",{
   code:composeError.code,constraint:composeError.details?.slice(0,160)??null,
   message:composeError.message.slice(0,200)
  });
  return NextResponse.json({error:"semantic_revision_insert_failed"},{status:409});
 }
 return NextResponse.redirect(new URL("/member/editorial-detail/"+candidateId+"?composed=1#tasks",req.url),303);
}
