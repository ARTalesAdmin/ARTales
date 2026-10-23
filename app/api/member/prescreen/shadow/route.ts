import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {requirePrescreenAccess} from "@/lib/prescreen/access";
import {runShadowPrescreen,loadShadowPolicy,reassessDueTitles} from "@/lib/prescreen/shadowRunner";
import {rebalancePercentages} from "@/lib/prescreen/shadowPolicy";
import {validatePrescreenWeights} from "@/lib/prescreen/engine";
import {validThemeWeights} from "@/lib/prescreen/themes";
export const runtime="nodejs";
export const maxDuration=60;
async function accessDB(){
 const access=await requirePrescreenAccess();
 if(access.fixture)throw Error("fixture_database_writes_disabled");
 return {db:await createClient(),actor:access.userId};
}
export async function GET(request:Request){
 const {db}=await accessDB();
 const url=new URL(request.url);
 const tab=url.searchParams.get("tab")??"titles";
 const policy=await loadShadowPolicy(db);
 if(tab==="titles"){
  await reassessDueTitles(db);
  const {data,error}=await db.from("prescreen_shadow_titles")
   .select("id,title,author,form,themes,primary_theme,state,reason,reconsider_year,first_published,author_died,source_url")
   .order("first_seen_at",{ascending:false}).limit(150);
  if(error)return NextResponse.json({error:"shadow_titles_unavailable"},{status:503});
  const {data:handoffs,error:handoffError}=await db.from("prescreen_shadow_handoffs")
   .select("id,title_id,state,selected_at").limit(500);
  if(handoffError)return NextResponse.json({error:"handoffs_unavailable"},{status:503});
  return NextResponse.json({policy,titles:data??[],handoffs:handoffs??[]});
 }
 if(tab==="runs"){
  const {data,error}=await db.from("prescreen_shadow_runs")
   .select("id,requested,status,summary,started_at").order("started_at",{ascending:false}).limit(30);
  if(error)return NextResponse.json({error:"shadow_runs_unavailable"},{status:503});
  return NextResponse.json({policy,runs:data??[]});
 }
 return NextResponse.json({error:"invalid_tab"},{status:400});
}
export async function POST(request:Request){
 const {db,actor}=await accessDB();
 const body=await request.json().catch(()=>null);
 if(body?.action==="run"){
  const n=body.requested;
  if(!Number.isInteger(n)||n<1||n>12)return NextResponse.json({error:"requested_1_to_12"},{status:400});
  const maxYear=body.maxYear;
  if(maxYear!==null&&maxYear!==undefined&&(!Number.isInteger(maxYear)||maxYear<1000||maxYear>2100))return NextResponse.json({error:"invalid_publication_year"},{status:400});
  try{return NextResponse.json(await runShadowPrescreen(db,actor,n,undefined,maxYear??undefined));}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:"run_failed"},{status:503});}
 }
 if(body?.action==="policy"){
  const {forms,themes,revision}=body;
  if(!validatePrescreenWeights(forms)||!validThemeWeights(themes)||!Number.isInteger(revision))
   return NextResponse.json({error:"invalid_weights"},{status:400});
  const {data,error}=await db.from("prescreen_shadow_policy").update({
   form_weights:forms,theme_weights:themes,revision:revision+1,
   updated_by:actor,updated_at:new Date().toISOString()
  }).eq("id",1).eq("revision",revision).select("revision").maybeSingle();
  if(error||!data)return NextResponse.json({error:"policy_conflict"},{status:409});
  return NextResponse.json({revision:data.revision});
 }
 if(body?.action==="handoff"){
  const id=body.titleId;
  if(typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"invalid_title"},{status:400});
  const {data:title,error:titleError}=await db.from("prescreen_shadow_titles")
   .select("id,state").eq("id",id).single();
  if(titleError||!title)return NextResponse.json({error:"title_not_found"},{status:404});
  if(title.state!=="suggested"&&title.state!=="review")
   return NextResponse.json({error:"title_not_eligible"},{status:409});
  const {error}=await db.from("prescreen_shadow_handoffs").upsert({
   title_id:id,state:"queued",selected_by:actor
  },{onConflict:"title_id"});
  if(error)return NextResponse.json({error:"handoff_failed"},{status:503});
  return NextResponse.json({queued:true});
 }
 if(body?.action==="withdraw"){
  const id=body.titleId;
  if(typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"invalid_title"},{status:400});
  const {data,error}=await db.from("prescreen_shadow_handoffs").update({state:"withdrawn"})
    .eq("title_id",id).eq("state","queued").select("id").maybeSingle();
  if(error)return NextResponse.json({error:"handoff_failed"},{status:503});
  if(!data)return NextResponse.json({error:"handoff_not_queued"},{status:409});
  return NextResponse.json({withdrawn:true});
 }
 return NextResponse.json({error:"invalid_action"},{status:400});
}
