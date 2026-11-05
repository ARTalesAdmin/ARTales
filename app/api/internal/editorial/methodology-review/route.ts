import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {timingSafeEqual} from "node:crypto";
export const dynamic="force-dynamic";
const authorized=(header:string|null,secret:string|undefined)=>{
 if(!secret||secret.length<16||!header)return false;
 const a=Buffer.from(header),b=Buffer.from("Bearer "+secret);
 return a.length===b.length&&timingSafeEqual(a,b);
};
export async function GET(request:NextRequest){
 if(!authorized(request.headers.get("authorization"),process.env.CRON_SECRET))
  return NextResponse.json({error:"unauthorized"},{status:401});
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY,url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!key||!url)return NextResponse.json({error:"not_configured"},{status:503});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.rpc("artales_schedule_monthly_methodology_review");
 if(error)return NextResponse.json({error:"database_unavailable"},{status:503});
 return NextResponse.json({status:data?.result??"unknown"});
}
