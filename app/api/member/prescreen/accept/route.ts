import {NextResponse} from "next/server";
import {requirePrescreenAccess} from "@/lib/prescreen/access";
import {createClient} from "@/lib/supabase/server";
export async function POST(request:Request){
 const access=await requirePrescreenAccess();
 if(access.fixture)return NextResponse.json({error:"fixture_write_disabled"},{status:403});
 const body=await request.json().catch(()=>null);
 const id=body?.decisionId;
 if(typeof id!=="string"||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))
  return NextResponse.json({error:"invalid_decision_id"},{status:400});
 const db=await createClient();
 const {data,error}=await db.rpc("accept_prescreen_decision",{p_decision_id:id});
 if(error)return NextResponse.json({error:"prescreen_accept_failed"},{status:503});
 return NextResponse.json(data);
}
