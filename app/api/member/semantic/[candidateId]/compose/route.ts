import {NextResponse} from "next/server";
import {requireAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {SNAPSHOT_GENERAL_V1_ENABLED} from "@/lib/ingest/snapshotGeneralFlag";
import {extractEpub} from "@/lib/ingest/epubSemanticExtractor";
import {composeSemanticRevision,verifySemanticRevision} from "@/lib/semantic/compose";
import {SEMANTIC_PIPELINE_ENABLED} from "@/lib/semantic/featureFlag";
export const runtime="nodejs"; export const dynamic="force-dynamic"; export const maxDuration=60;
export async function POST(req:Request,{params}:{params:Promise<{candidateId:string}>}){
 if(!SNAPSHOT_GENERAL_V1_ENABLED||!SEMANTIC_PIPELINE_ENABLED)return NextResponse.json({error:"pipeline_disabled"},{status:503});
 if(!["https://artales.net","https://www.artales.net"].includes(req.headers.get("origin")??""))return NextResponse.json({error:"invalid_origin"},{status:403});
 const {candidateId}=await params;const actor=await requireAdmin();const db=await createClient();
 const [{data:snapshot,error:se},{data:review,error:re},{data:existing,error:ee}]=await Promise.all([
 db.from("candidate_snapshots").select("sha256,storage_path,storage_bucket,readback_status").eq("candidate_id",candidateId).maybeSingle(),
 db.from("candidate_snapshot_reviews").select("text_correspondence,image_disposition").eq("candidate_id",candidateId).order("reviewed_at",{ascending:false}).order("id",{ascending:false}).limit(1).maybeSingle(),
 db.from("candidate_semantic_revisions").select("revision_sha256").eq("candidate_id",candidateId).limit(1).maybeSingle()]);
 if(se||re||ee)return NextResponse.json({error:"semantic_registry_not_ready"},{status:503});
 if(!snapshot||snapshot.readback_status!=="sha256_verified"||review?.text_correspondence!=="confirmed"||review.image_disposition!=="exclude_all")return NextResponse.json({error:"semantic_evidence_not_ready"},{status:409});
 if(existing)return NextResponse.redirect(new URL("/member/semantic/"+candidateId,req.url),303);
 const {data:file,error:fe}=await db.storage.from(snapshot.storage_bucket).download(snapshot.storage_path);
 if(fe||!file)return NextResponse.json({error:"semantic_archive_missing"},{status:409});
 const extracted=extractEpub(new Uint8Array(await file.arrayBuffer()));
 if(extracted.epub_sha256!==snapshot.sha256)return NextResponse.json({error:"semantic_source_digest_mismatch"},{status:409});
 const revision=composeSemanticRevision({work_id:candidateId,work_slug:"candidate-"+candidateId,snapshot_ref:"sha256:"+snapshot.sha256,source_bytes_sha256:extracted.text_sha256,component_id:extracted.component_id,original_byte_start:0,original_raw:extracted.text});
 verifySemanticRevision(revision,extracted.text);
 const {error}=await db.from("candidate_semantic_revisions").insert({candidate_id:candidateId,snapshot_sha256:snapshot.sha256,revision_sha256:revision.revision_sha256,revision,source_text:extracted.text,component_id:extracted.component_id,source_manifest:{documents:extracted.documents,assets:extracted.assets,epub_sha256:extracted.epub_sha256},image_selection:"none",status:"draft",authored_by:actor.id});
 if(error)return NextResponse.json({error:"semantic_revision_insert_failed"},{status:409});
 return NextResponse.redirect(new URL("/member/semantic/"+candidateId,req.url),303);
}