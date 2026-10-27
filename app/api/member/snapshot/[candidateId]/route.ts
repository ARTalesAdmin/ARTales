import {NextResponse} from "next/server";
import {SNAPSHOT_GENERAL_V1_ENABLED} from "@/lib/ingest/snapshotGeneralFlag";
import {requireAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {getGutenbergBook} from "@/lib/legal/gutenbergCatalog";
import {readLockedSnapshotPacket} from "@/lib/ingest/server/readLockedSnapshotPacket";
import {planLockedSnapshot} from "@/lib/ingest/verifiedLegalSnapshotHandoff";
import {proposeGutenbergSnapshotAcquisition} from "@/lib/ingest/gutenbergSnapshotAcquisition";
import {captureRawSource} from "@/lib/ingest/rawSourceSnapshot";
import {archiveRawSource,RAW_SNAPSHOT_BUCKET} from "@/lib/ingest/rawSourceArchive";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validOrigin=new Set(["https://artales.net","https://www.artales.net"]);
async function readForm(req:Request,id:string){
 if(!validOrigin.has(req.headers.get("origin")??"")||
    (req.headers.get("sec-fetch-site") && req.headers.get("sec-fetch-site")!=="same-origin"))
   throw Error("snapshot_origin_denied");
 if(!/^application\/x-www-form-urlencoded(?:\s*;|$)/.test(req.headers.get("content-type")??""))
   throw Error("snapshot_invalid_content_type");
 const len=req.headers.get("content-length");
 if(!len || !/^\d{1,4}$/.test(len) || Number(len)>2048)throw Error("snapshot_form_oversize");
 const reader=req.body?.getReader();
 if(!reader)throw Error("snapshot_form_invalid");
 const parts:Uint8Array[]=[];let actual=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   actual+=value.byteLength;
   if(actual>2048)throw Error("snapshot_form_oversize");
   parts.push(value);
  }
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 if(actual!==Number(len))throw Error("snapshot_form_invalid");
 let body:string;
 try{body=new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(parts.map(x=>Buffer.from(x)),actual));}
 catch{throw Error("snapshot_form_invalid");}
 const form=new URLSearchParams(body);
 if([...form.keys()].length!==2 || form.getAll("candidate_id").length!==1 ||
    form.getAll("private_original_retention").length!==1 ||
    form.get("candidate_id")!==id || form.get("private_original_retention")!=="archive_only")
   throw Error("snapshot_explicit_consent_missing");
}
async function loadMirror(url:string):Promise<Uint8Array>{
 const response=await fetch(url,{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000),
  headers:{Accept:"application/epub+zip,application/octet-stream;q=0.7"}});
 if(response.status!==200||response.redirected||!response.body||response.url!==url)
   throw Error("snapshot_mirror_unavailable");
 const declared=response.headers.get("content-length");
 if(declared&&(!/^\d+$/.test(declared)||Number(declared)>8*1024*1024))
  throw Error("snapshot_mirror_size_refused");
 const reader=response.body.getReader();const parts:Uint8Array[]=[];let total=0;
 try {for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;
   if(total>8*1024*1024)throw Error("snapshot_mirror_size_refused");parts.push(value);}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 if(total<64||(declared&&Number(declared)!==total))throw Error("snapshot_mirror_incomplete");
 return Uint8Array.from(Buffer.concat(parts.map(x=>Buffer.from(x)),total));
}
export async function POST(req:Request,{params}:{params:Promise<{candidateId:string}>}){
 const {candidateId}=await params;
 if(!SNAPSHOT_GENERAL_V1_ENABLED)return NextResponse.json({ok:false,error:"snapshot_general_not_activated"},{status:503});
 if(!uuid.test(candidateId))return NextResponse.json({ok:false,error:"invalid_candidate"},{status:400});
 try{await readForm(req,candidateId);}catch(e){
  return NextResponse.json({ok:false,error:e instanceof Error?e.message:"snapshot_bad_request"},{status:403});
 }
 const actor=await requireAdmin();
 const db=await createClient();
 const {data:existing,error:existingError}=await db.from("candidate_snapshots")
  .select("sha256,storage_path,readback_status").eq("candidate_id",candidateId).maybeSingle();
 if(existingError)return NextResponse.json({ok:false,error:"snapshot_registry_not_ready"},{status:503});
 if(existing)return NextResponse.redirect(new URL(
  `/member/snapshot/${candidateId}?result=already_archived`,req.url),303);
 let claimed=false;
 try{
  const packet=await readLockedSnapshotPacket(candidateId);
  if(packet.actor.id!==actor.id)throw Error("snapshot_actor_mismatch");
  const match=/^https:\/\/www\.gutenberg\.org\/ebooks\/([1-9][0-9]{0,7})$/.exec(packet.lock.source_url);
  if(!match)throw Error("snapshot_catalog_missing");
  const id=Number(match[1]);
  const book=await getGutenbergBook(id);
  if(!book)throw Error("snapshot_catalog_unavailable");
  const plan=planLockedSnapshot(packet,book);
  const proposal=proposeGutenbergSnapshotAcquisition(plan,book);
  const captured=captureRawSource(plan.selection,await loadMirror(proposal.acquisitionUrl),new Date().toISOString());
  const {error:claimError}=await db.from("candidate_snapshot_claims").insert({
    candidate_id:candidateId,source_id:packet.lock.source_id,decision_no:packet.lock.decision_no,
    gutenberg_id:id,sha256:captured.manifest.sha256,claimed_by:actor.id
  });
  if(claimError)throw Error("snapshot_already_claimed_or_denied");
  claimed=true;
  const receipt=await archiveRawSource(captured,db,RAW_SNAPSHOT_BUCKET,
    captured.manifest.embedded_images?{privateImageRetentionApproved:true}:undefined);
  const {error:recordError}=await db.from("candidate_snapshots").insert({
    candidate_id:candidateId,source_id:packet.lock.source_id,decision_no:packet.lock.decision_no,
    gutenberg_id:id,catalog_url:proposal.catalogUrl,locked_file_url:proposal.lockedFileUrl,
    selected_file_url:proposal.selectedFileUrl,acquired_from:proposal.acquisitionUrl,
    storage_path:receipt.path,sha256:receipt.sha256,byte_count:receipt.bytes,
    embedded_images:receipt.embedded_images,private_image_retention:receipt.private_image_retention,
    captured_at:captured.manifest.captured_at,recorded_by:actor.id,
    original_manifest:captured.manifest,readback_status:receipt.storage_readback
  });
  if(recordError)throw Error("snapshot_receipt_registration_failed_needs_reconciliation");
  console.info("ARTales generalized Snapshot archived",{
    candidateId,sha256:receipt.sha256,bytes:receipt.bytes,
    storage_readback:receipt.storage_readback,publication_authorized:false
  });
  return NextResponse.redirect(new URL(
    `/member/snapshot/${candidateId}?result=archived`,req.url),303);
 }catch(e){const error=e instanceof Error?e.message:"snapshot_unknown_failure";
  console.warn("ARTales Snapshot general v1",{candidateId,error,claimed});
  return NextResponse.json({ok:false,error,claimed,reconciliation_required:claimed},
    {status:409,headers:{"Cache-Control":"no-store"}});
 }
}
