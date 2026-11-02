import {NextResponse} from "next/server";
import {createHash,randomUUID} from "node:crypto";
import {createClient} from "@/lib/supabase/server";
import {requireAdmin} from "@/lib/guards";
import {SNAPSHOT_GENERAL_V1_ENABLED} from "@/lib/ingest/snapshotGeneralFlag";
import {walkSemanticAtoms,verifySemanticRevision} from "@/lib/semantic/compose";
import type {SemanticRevision} from "@/lib/semantic/model";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const MAX=5*1024*1024;
const sha=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
function format(bytes:Uint8Array){
 const b=Buffer.from(bytes);
 if(b.length>=8&&b.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex")))return ["png","image/png"] as const;
 if(b.length>=4&&b[0]===255&&b[1]===216&&b.at(-2)===255&&b.at(-1)===217)return ["jpg","image/jpeg"] as const;
 if(b.length>=12&&b.subarray(0,4).toString()==="RIFF"&&b.subarray(8,12).toString()==="WEBP")return ["webp","image/webp"] as const;
 throw Error("image_format_unsupported");
}
export async function POST(req:Request,{params}:{params:Promise<{candidateId:string}>}){
 if(!SNAPSHOT_GENERAL_V1_ENABLED)return NextResponse.json({error:"not_enabled"},{status:503});
 if(!["https://artales.net","https://www.artales.net"].includes(req.headers.get("origin")??""))
  return NextResponse.json({error:"invalid_origin"},{status:403});
 const declared=Number(req.headers.get("content-length")??"0");
 if(!Number.isSafeInteger(declared)||declared<1||declared>MAX+12000)return NextResponse.json({error:"image_request_too_large"},{status:413});
 const {candidateId}=await params;const actor=await requireAdmin();const db=await createClient();
 if(!/^[a-f0-9-]{36}$/.test(candidateId))return NextResponse.json({error:"invalid_candidate"},{status:400});
 const [{data:rev,error:revError},{data:snapshot,error:snapError}]=await Promise.all([
  db.from("candidate_semantic_revisions").select("revision,revision_sha256,source_manifest,status").eq("candidate_id",candidateId)
   .order("created_at",{ascending:false}).limit(1).maybeSingle(),
  db.from("candidate_snapshots").select("source_id").eq("candidate_id",candidateId).maybeSingle()
 ]);
 if(revError||snapError||!rev||!snapshot||rev.status!=="draft")return NextResponse.json({error:"semantic_revision_not_ready"},{status:409});
 // Freeze the visual manifest before editorial review starts. Otherwise an
 // image could be added after visual sign-off yet inherit the earlier approval.
 const {data:reviewStarted,error:reviewError}=await db.from("artales_editorial_tasks")
  .select("id").eq("candidate_id",candidateId).eq("revision_sha256",rev.revision_sha256)
  .limit(1).maybeSingle();
 if(reviewError||reviewStarted)return NextResponse.json({error:"visuals_frozen_after_editorial_enqueue"},{status:409});
 const body=await req.formData();
 const file=body.get("image"),origin=String(body.get("provenance")??"");
 const anchor=String(body.get("anchor_atom_id")??"");
 const rightsNote=String(body.get("rights_note")??"").trim(),caption=String(body.get("caption")??"").trim();
 if(!(file instanceof File)||file.size<40||file.size>MAX||rightsNote.length<100||rightsNote.length>4000||
    caption.length>300||!["approved_original","original_art"].includes(origin))
  return NextResponse.json({error:"invalid_image_review"},{status:400});
 const revision=rev.revision as SemanticRevision;
 try{verifySemanticRevision(revision);}
 catch{return NextResponse.json({error:"semantic_revision_corrupt"},{status:409});}
 if(!walkSemanticAtoms(revision.blocks).some(x=>x.id===anchor))
  return NextResponse.json({error:"image_anchor_not_found"},{status:400});
 const bytes=new Uint8Array(await file.arrayBuffer());let extension:string,mime:string;
 try{[extension,mime]=format(bytes);}
 catch{return NextResponse.json({error:"image_format_unsupported"},{status:400});}
 const digest=sha(bytes);
 let sourceSha:string|null=null;
 if(origin==="approved_original"){
  const {data:legal,error:legalError}=await db.from("candidate_legal_sources")
   .select("illustration_use").eq("id",snapshot.source_id).eq("candidate_id",candidateId).maybeSingle();
  const manifest=rev.source_manifest as {assets?:Array<{sha256?:string}>}|null;
  if(legalError||!["public_domain","licensed"].includes(legal?.illustration_use??"")||
    !manifest?.assets?.some(x=>x.sha256===digest))
   return NextResponse.json({error:"original_illustration_rights_not_cleared"},{status:409});
  sourceSha=digest;
 }
 const path="works/"+candidateId+"/inline/"+randomUUID()+"."+extension;
 const store=db.storage.from("artales-images");
 const upload=await store.upload(path,bytes,{upsert:false,contentType:mime,cacheControl:"3600"});
 if(upload.error)return NextResponse.json({error:"visual_upload_failed"},{status:409});
 const {data:readback,error:readError}=await store.download(path);
 if(readError||!readback||sha(new Uint8Array(await readback.arrayBuffer()))!==digest)
  return NextResponse.json({error:"visual_readback_failed"},{status:409});
 const {error}=await db.from("artales_semantic_images").insert({
  candidate_id:candidateId,revision_sha256:rev.revision_sha256,anchor_atom_id:anchor,
  storage_path:path,sha256:digest,source_asset_sha256:sourceSha,
  provenance:origin,rights_note:rightsNote,caption,approved_by:actor.id
 });
 if(error)return NextResponse.json({error:"visual_manifest_registration_failed"},{status:409});
 return NextResponse.redirect(new URL("/member/semantic/"+candidateId+"?image=added",req.url),303);
}
