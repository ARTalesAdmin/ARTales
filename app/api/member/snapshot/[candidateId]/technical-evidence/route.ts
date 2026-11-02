import {createHash} from "node:crypto";
import {NextResponse} from "next/server";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {SNAPSHOT_GENERAL_V1_ENABLED} from "@/lib/ingest/snapshotGeneralFlag";
import {extractEpub} from "@/lib/ingest/epubSemanticExtractor";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function GET(_req:Request,{params}:{params:Promise<{candidateId:string}>}){
 if(!SNAPSHOT_GENERAL_V1_ENABLED)return NextResponse.json({error:"feature_disabled"},{status:503});
 const {candidateId}=await params;
 await requireEditorOrAdmin();
 if(!uuid.test(candidateId))return NextResponse.json({error:"invalid_candidate"},{status:400});
 const db=await createClient();
 const {data:receipt,error}=await db.from("candidate_snapshots")
  .select("sha256,byte_count,embedded_images,storage_bucket,storage_path,catalog_url,readback_status")
  .eq("candidate_id",candidateId).maybeSingle();
 if(error||!receipt)return NextResponse.json({error:"snapshot_receipt_not_available"},{status:409});
 if(receipt.readback_status!=="sha256_verified")
  return NextResponse.json({error:"snapshot_not_verified"},{status:409});
 const {data:file,error:downloadError}=await db.storage.from(receipt.storage_bucket).download(receipt.storage_path);
 if(downloadError||!file)return NextResponse.json({error:"archive_download_unavailable"},{status:409});
 const bytes=new Uint8Array(await file.arrayBuffer());
 const sha=createHash("sha256").update(bytes).digest("hex");
 if(sha!==receipt.sha256||bytes.length!==receipt.byte_count)
  return NextResponse.json({error:"archive_integrity_mismatch"},{status:409});
 try {
  const extracted=extractEpub(bytes);
  if(extracted.epub_sha256!==sha||extracted.assets.length!==receipt.embedded_images)
   return NextResponse.json({error:"epub_manifest_mismatch"},{status:409});
  return NextResponse.json({
   schema:"artales.snapshot-technical-evidence.v1",status:"technical_integrity_verified",
   candidateId,sha256:sha,bytes:bytes.length,catalogUrl:receipt.catalog_url,
   spineDocuments:extracted.documents,sourceTextCharacters:extracted.text.length,
   sourceTextSha256:extracted.text_sha256,
   embeddedAssets:extracted.assets,
   editorialDecision:"not_automatically_approved",
   message:"Hash, bytes and EPUB structure verified. Edition correspondence and legal rights require separate human review."
  },{headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({error:"epub_structure_invalid_or_unsupported"},{status:422});
 }
}
