import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {readLockedSnapshotPacket} from "@/lib/ingest/server/readLockedSnapshotPacket";
import {SNAPSHOT_389_CANDIDATE,runSnapshot389MirrorPilot} from "@/lib/ingest/snapshot389Pilot";
import {fetchSnapshot389FromMirror} from "@/lib/ingest/snapshot389Mirror";
import {getGutenbergBook} from "@/lib/legal/gutenbergCatalog";
import {planLockedSnapshot} from "@/lib/ingest/verifiedLegalSnapshotHandoff";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const allowedOrigins=new Set(["https://artales.net","https://www.artales.net"]);

/** One-shot, single-title, authenticated admin-only archive.
 * A successful response is byte preservation evidence, not publication or
 * completion of the independent text/edition/provenance review.
 */
export async function POST(request:Request){
  const origin=request.headers.get("origin")??"";
  const fetchSite=request.headers.get("sec-fetch-site");
  if(!allowedOrigins.has(origin)||(fetchSite&&fetchSite!=="same-origin"))
    return NextResponse.json({ok:false,error:"invalid_request_origin"},{status:403});
  const contentType=request.headers.get("content-type")??"";
  const declared=Number(request.headers.get("content-length"));
  if(!/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(contentType) ||
      !Number.isSafeInteger(declared)||declared<1||declared>2048)
    return NextResponse.json({ok:false,error:"invalid_request_body"},{status:413});
  let body:URLSearchParams;
  try {body=new URLSearchParams(await request.text());}
  catch{return NextResponse.json({ok:false,error:"invalid_form"},{status:400});}
  if(body.get("candidate_id")!==SNAPSHOT_389_CANDIDATE ||
      body.get("confirm_private_original_with_cover")!=="archive_only_not_publication" ||
      [...body.keys()].some(k=>!["candidate_id","confirm_private_original_with_cover"].includes(k)))
    return NextResponse.json({ok:false,error:"explicit_confirmation_required"},{status:400});
  try{
    const legal=await readLockedSnapshotPacket(SNAPSHOT_389_CANDIDATE);
    // This is user-scoped Supabase, NOT a service-role bypass.
    const db=await createClient();
    const book=await getGutenbergBook(389);
    if(!book)throw Error("verified_catalog_unavailable");
    const plan=planLockedSnapshot(legal,book);
    const bytes=await fetchSnapshot389FromMirror();
    const result=await runSnapshot389MirrorPilot(plan,bytes,legal.actor.id,
      new Date().toISOString(),db,true);
    console.info("ARTales Snapshot #389 SHA-256 readback verified",{
      candidate_id:SNAPSHOT_389_CANDIDATE,decision_no:9,
      sha256:result.source_sha256,bytes:result.archive.bytes,
      embedded_images:result.archive.embedded_images,
      archive_scope:"private_only",publication_authorized:false,
    });
    return NextResponse.json({ok:true,result},
      {headers:{"Cache-Control":"no-store"}});
  }catch(error){
    const code=error instanceof Error?error.message:"snapshot_unknown_error";
    // No secrets, cookies, source contents or Supabase object metadata in the response.
    const publicCode=/^(snapshot_|raw_source_|legal_|source_|catalog_|verified_catalog_unavailable|untrusted_)/.test(code)
      ?code:"snapshot_389_internal_failure";
    console.warn("ARTales Snapshot #389 pilot refused",{code:publicCode});
    return NextResponse.json({ok:false,error:publicCode},
      {status:409,headers:{"Cache-Control":"no-store"}});
  }
}
