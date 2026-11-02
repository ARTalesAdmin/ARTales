import {NextResponse} from "next/server";
import {requireAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {SNAPSHOT_GENERAL_V1_ENABLED} from "@/lib/ingest/snapshotGeneralFlag";
import {parseSnapshotReview} from "@/lib/ingest/snapshotReview";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const allowed=new Set(["https://artales.net","https://www.artales.net"]);
export async function POST(req:Request,{params}:{params:Promise<{candidateId:string}>}){
 if(!SNAPSHOT_GENERAL_V1_ENABLED)return NextResponse.json({error:"not_enabled"},{status:503});
 if(!allowed.has(req.headers.get("origin")??"") ||
    (req.headers.get("sec-fetch-site")&&req.headers.get("sec-fetch-site")!=="same-origin"))
  return NextResponse.json({error:"invalid_origin"},{status:403});
 const {candidateId}=await params;const len=Number(req.headers.get("content-length")??"0");
 if(!req.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded") ||
    !Number.isSafeInteger(len)||len<1||len>6000)
  return NextResponse.json({error:"invalid_form"},{status:400});
 const profile=await requireAdmin();const db=await createClient();
 const {data:receipt,error:e}=await db.from("candidate_snapshots").select("sha256").eq("candidate_id",candidateId).maybeSingle();
 if(e||!receipt)return NextResponse.json({error:"receipt_missing"},{status:409});
 const body=await req.text();
 if(Buffer.byteLength(body,"utf8")!==len)return NextResponse.json({error:"invalid_form_size"},{status:400});
 let review;
 try{review=parseSnapshotReview(new URLSearchParams(body),candidateId,receipt.sha256);}
 catch{return NextResponse.json({error:"invalid_review"},{status:400});}
 const {error}=await db.from("candidate_snapshot_reviews").insert({...review,reviewed_by:profile.id});
 if(error)return NextResponse.json({error:"review_insert_failed"},{status:409});
 return NextResponse.redirect(new URL("/member/snapshot/"+candidateId+"?result=reviewed",req.url),303);
}
