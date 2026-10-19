import {NextResponse} from "next/server";
import {requirePrescreenAccess} from "@/lib/prescreen/access";
import {createClient} from "@/lib/supabase/server";
export async function GET(request:Request){
 const access=await requirePrescreenAccess();
 if(access.fixture)return NextResponse.json({fixture:true,runs:[],decisions:[]});
 const db=await createClient();
 const runId=new URL(request.url).searchParams.get("runId");
 if(runId){
   if(!/^[0-9a-f-]{36}$/i.test(runId))return NextResponse.json({error:"invalid_run_id"},{status:400});
   const {data:decisions,error:decisionError}=await db.from("prescreen_decisions")
      .select("id,source_work_key,title,author,genre,chronology,outcome,reason,accepted_candidate_id,created_at")
      .eq("run_id",runId).order("created_at",{ascending:true}).limit(500);
   if(decisionError)return NextResponse.json({error:"prescreen_decisions_unavailable"},{status:503});
   return NextResponse.json({fixture:false,runId,decisions:decisions??[]});
 }

 const {data:runs,error}=await db.from("prescreen_runs")
   .select("id,requested,status,created_at,progress").order("created_at",{ascending:false}).limit(25);
 if(error)return NextResponse.json({error:"prescreen_history_unavailable"},{status:503});
 return NextResponse.json({fixture:false,runs:runs??[]});
}
