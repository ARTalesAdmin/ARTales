import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {authorizeAlice114Capture,ALICE_114_HTML,ALICE_114_CATALOG,
 ALICE_PINNED_ENGLISH_SOURCE_SHA256,ALICE_PILOT_CANDIDATE_ID} from "@/lib/pilots/alice114CaptureGate";
import {discoverGutenbergImages} from "@/lib/ingest/gutenbergImageManifest";
import {captureAndArchiveGutenbergImage} from "@/lib/ingest/gutenbergImageCapturePipeline";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

async function boundedDownload(uri:string, limit:number){
 const response=await fetch(uri,{redirect:"error",cache:"no-store",
  headers:{accept:"text/html,image/gif,image/png,image/jpeg"} ,
  signal:AbortSignal.timeout(16000)});
 if(!response.ok)throw Error("trusted_source_http_error");
 const n=Number(response.headers.get("content-length")??"0");
 if(n>limit)throw Error("trusted_source_oversize");
 const b=new Uint8Array(await response.arrayBuffer());
 if(b.length>limit||!b.length)throw Error("trusted_source_oversize");
 return {status:response.status,bytes:b,contentType:response.headers.get("content-type")??""};
}
export async function POST(request:NextRequest){
 if(process.env.ARTALES_ENABLE_ALICE_ARTWORK_CAPTURE!=="1")
  return NextResponse.json({error:"not_found"},{status:404,headers:{"Cache-Control":"no-store"}});
 try{
  if(Number(request.headers.get("content-length")??"0")>512)
   return NextResponse.json({error:"invalid_body"},{status:400});
  const session=await createClient();
  const {data:{user},error}=await session.auth.getUser();
  if(error||!user)return NextResponse.json({error:"unauthorized"},{status:401});
  const {data:profile,error:profileError}=await session.from("profiles")
   .select("id,role,is_active").eq("id",user.id).single();
  if(profileError||!profile||profile.id!==user.id||profile.role!=="admin"||profile.is_active!==true)
   return NextResponse.json({error:"forbidden"},{status:403});
  const raw=await request.text();
  if(Buffer.byteLength(raw,"utf8")>512)
   return NextResponse.json({error:"invalid_body"},{status:400,headers:{"Cache-Control":"no-store"}});
  const json=JSON.parse(raw) as unknown;
  const {ordinal,grant}=authorizeAlice114Capture({
   deployment:process.env.VERCEL_ENV==="production"?"production":"disabled",
   request_url:request.url,
   origin:request.headers.get("origin"),
   fetch_site:request.headers.get("sec-fetch-site"),
   content_type:request.headers.get("content-type"),
   actor:{user_id:user.id,profile_id:profile.id,role:profile.role,is_active:profile.is_active},
   json,
  });
  const index=await boundedDownload(ALICE_114_HTML,1_000_000);
  if(!/text\/html/i.test(index.contentType))throw Error("gutenberg_index_media_invalid");
  const html=new TextDecoder("utf-8",{fatal:true}).decode(index.bytes);
  const manifest=discoverGutenbergImages({html,source_url:ALICE_114_HTML,
   catalog_url:ALICE_114_CATALOG,expected_count:42});
  const reference=manifest.images[ordinal-1];
  if(!reference||reference.ordinal!==ordinal)throw Error("gutenberg_image_not_found");
  const capturedAt=new Date().toISOString();
  const archived=await captureAndArchiveGutenbergImage({
   grant,reference,candidate_id:ALICE_PILOT_CANDIDATE_ID,
   text_snapshot_ref:"sha256:"+ALICE_PINNED_ENGLISH_SOURCE_SHA256,
   captured_at:capturedAt,checked_at:capturedAt,
   artist:{name:"John Tenniel",living:false,death_year:1914,
    evidence_url:"https://www.gutenberg.org/ebooks/114"},
   artist_provenance:"original_artist",us_catalog_status:"public_domain",
   express_no_reuse:false,
   fetchSource:async uri=>boundedDownload(uri,10_000_000),
   storage:createAdminClient(),
  });
  return NextResponse.json({
   ok:true,component_id:archived.snapshot.component_id,sha256:archived.snapshot.sha256,
   bytes:archived.archive.source_byte_length,
   archived:true,private_bucket:archived.archive.source_bucket,
   publication_authorized:false,
  },{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  const reason=error instanceof Error?error.message:"capture_failed";
  console.error("alice_illustration_capture_failed",reason);
  return NextResponse.json({ok:false,error:"capture_not_completed"},{status:422,headers:{"Cache-Control":"no-store"}});
 }
}
