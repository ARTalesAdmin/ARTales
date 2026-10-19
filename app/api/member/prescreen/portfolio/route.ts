import {NextResponse} from "next/server";
import {requirePrescreenAccess} from "@/lib/prescreen/access";
import {fixtureInventory,fixtureWeights,PRESCREEN_FIXTURE_WORKS} from "@/lib/prescreen/fixture";
import {createClient} from "@/lib/supabase/server";
import {loadPrescreenPortfolio} from "@/lib/prescreen/data";
import {validatePrescreenWeights, type PrescreenWeights} from "@/lib/prescreen/engine";
import {isPrescreenGenre} from "@/lib/prescreen/portfolio";

export async function GET(){
 const access=await requirePrescreenAccess();
 if(access.fixture)return NextResponse.json({fixture:true,weights:fixtureWeights,
   snapshot:{genreCounts:fixtureInventory.genreCounts,unknownGenre:0,
     publishedTotal:2,draftTotal:2,activeCandidateTotal:0,classificationComplete:true},
   works:PRESCREEN_FIXTURE_WORKS.map((w,i)=>({id:String(i),...w})),revision:1});
 try{
   const data=await loadPrescreenPortfolio(await createClient());
   return NextResponse.json({fixture:false,weights:data.weights,revision:data.revision,
     snapshot:data.snapshot,works:data.works});
 }catch{return NextResponse.json({error:"portfolio_unavailable"},{status:503});}
}
export async function POST(request:Request){
 const access=await requirePrescreenAccess();
 if(access.fixture)return NextResponse.json({error:"fixture_write_disabled"},{status:403});
 const input=await request.json().catch(()=>null);
 const db=await createClient();
 if(input?.kind==="weights"){
   const weights=input.weights as PrescreenWeights;
   if(!weights||!validatePrescreenWeights(weights))return NextResponse.json({error:"invalid_weights"},{status:400});
   const {data:current,error:readError}=await db.from("prescreen_genre_policy")
     .select("revision").eq("id",1).single();
   if(readError||!current)return NextResponse.json({error:"policy_unavailable"},{status:503});
   const {data,error}=await db.from("prescreen_genre_policy").update({
     weights,revision:current.revision+1,updated_by:access.userId,updated_at:new Date().toISOString()
   }).eq("id",1).eq("revision",current.revision).select("revision").maybeSingle();
   if(error||!data)return NextResponse.json({error:"policy_conflict_or_write_failed"},{status:409});
   return NextResponse.json({revision:data.revision});
 }
 if(input?.kind==="classify"){
   const workId=input.workId,genre=input.genre;
   if(typeof workId!=="string"||!/^[0-9a-f-]{36}$/i.test(workId)||!isPrescreenGenre(genre))
     return NextResponse.json({error:"invalid_classification"},{status:400});
   const {data:existing,error:readError}=await db.from("prescreen_work_genres")
     .select("work_id").eq("work_id",workId).maybeSingle();
   if(readError)return NextResponse.json({error:"classification_read_failed"},{status:503});
   const payload={work_id:workId,genre,basis:"admin_review",
     updated_by:access.userId,updated_at:new Date().toISOString()};
   const {error}=existing?
     await db.from("prescreen_work_genres").update(payload).eq("work_id",workId):
     await db.from("prescreen_work_genres").insert(payload);
   if(error)return NextResponse.json({error:"classification_write_failed"},{status:503});
   return NextResponse.json({updated:true});
 }
 return NextResponse.json({error:"invalid_action"},{status:400});
}
