import {NextResponse} from "next/server";
import {requirePrescreenAccess,isPrescreenFixture} from "@/lib/prescreen/access";
import {createClient} from "@/lib/supabase/server";
export async function GET(){
 const access=await requirePrescreenAccess();
 if(access.fixture)return NextResponse.json({fixture:true,runs:[],decisions:[]});
 const db=await createClient();
 const {data:runs,error}=await db.from("prescreen_runs")
   .select("id,requested,status,created_at,progress").order("created_at",{ascending:false}).limit(25);
 if(error)return NextResponse.json({error:"prescreen_history_unavailable"},{status:503});
 return NextResponse.json({fixture:false,runs:runs??[]});
}
