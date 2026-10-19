import {NextResponse} from "next/server";
import {requirePrescreenAccess} from "@/lib/prescreen/access";
import {fixtureInventory,fixtureWeights,PRESCREEN_FIXTURE_WORKS} from "@/lib/prescreen/fixture";
import {createClient} from "@/lib/supabase/server";
import {loadPrescreenPortfolio} from "@/lib/prescreen/data";
import {validatePrescreenWeights, type PrescreenWeights} from "@/lib/prescreen/engine";
import {isPrescreenGenre} from "@/lib/prescreen/portfolio";
import {DEFAULT_THEME_WEIGHTS,validThemeWeights,normalizeThemeTags} from "@/lib/prescreen/themes";

export async function GET(){
 const access=await requirePrescreenAccess();
 if(access.fixture)return NextResponse.json({fixture:true,weights:fixtureWeights,
   snapshot:{genreCounts:fixtureInventory.genreCounts,unknownGenre:0,
     publishedTotal:2,draftTotal:2,activeCandidateTotal:0,classificationComplete:true},
   works:PRESCREEN_FIXTURE_WORKS.map((w,i)=>({id:String(i),...w,themes:[]})),themes:{weights:DEFAULT_THEME_WEIGHTS,revision:1},revision:1});
 try{
   const data=await loadPrescreenPortfolio(await createClient());
   const db=await createClient();
   const [{data:themePolicy,error:policyError},{data:themes,error:tagsError}]=await Promise.all([
     db.from("prescreen_theme_policy").select("weights,revision").eq("id",1).single(),
     db.from("prescreen_work_themes").select("work_id,theme").limit(5000)
   ]);
   if(policyError||tagsError)return NextResponse.json({error:"theme_policy_unavailable"},{status:503});
   const byWork=new Map<string,string[]>();
   for(const tag of themes??[])byWork.set(tag.work_id,[...(byWork.get(tag.work_id)??[]),tag.theme]);
   return NextResponse.json({fixture:false,weights:data.weights,revision:data.revision,
     themes:{weights:themePolicy.weights,revision:themePolicy.revision},
     snapshot:data.snapshot,works:data.works.map(w=>({...w,themes:normalizeThemeTags(byWork.get(w.id))}))});
 }catch{return NextResponse.json({error:"portfolio_unavailable"},{status:503});}
}
export async function POST(request:Request){
 const access=await requirePrescreenAccess();
 if(access.fixture)return NextResponse.json({error:"fixture_write_disabled"},{status:403});
 const input=await request.json().catch(()=>null);
 const db=await createClient();
 if(input?.kind==="theme_weights"){
   if(!validThemeWeights(input.weights))return NextResponse.json({error:"invalid_theme_weights"},{status:400});
   const {data:current,error:readError}=await db.from("prescreen_theme_policy").select("revision").eq("id",1).single();
   if(readError||!current)return NextResponse.json({error:"theme_policy_unavailable"},{status:503});
   const {data,error}=await db.from("prescreen_theme_policy").update({
     weights:input.weights,revision:current.revision+1,updated_by:access.userId,
     updated_at:new Date().toISOString()
   }).eq("id",1).eq("revision",current.revision).select("revision").maybeSingle();
   if(error||!data)return NextResponse.json({error:"theme_policy_conflict"},{status:409});
   return NextResponse.json({revision:data.revision});
 }
 if(input?.kind==="theme_tag"){
   if(typeof input.workId!=="string"||!(/^[0-9a-f-]{36}$/i.test(input.workId)) ||
      !Array.isArray(input.tags)||input.tags.length>10)
     return NextResponse.json({error:"invalid_tags"},{status:400});
   const tags=normalizeThemeTags(input.tags);
   if(tags.length!==input.tags.length)return NextResponse.json({error:"invalid_tags"},{status:400});
   const {data:existing,error:readError}=await db.from("prescreen_work_themes")
     .select("theme").eq("work_id",input.workId);
   if(readError)return NextResponse.json({error:"theme_read_failed"},{status:503});
   const previous=new Set((existing??[]).map(x=>x.theme));
   const next=new Set(tags);
   const remove=[...previous].filter(t=>!next.has(t));
   const add=tags.filter(t=>!previous.has(t));
   if(remove.length){
     const {error}=await db.from("prescreen_work_themes").delete()
       .eq("work_id",input.workId).in("theme",remove);
     if(error)return NextResponse.json({error:"theme_remove_failed"},{status:503});
   }
   if(add.length){
     const {error}=await db.from("prescreen_work_themes").insert(add.map(theme=>({
       work_id:input.workId,theme,updated_by:access.userId
     })));
     if(error)return NextResponse.json({error:"theme_add_failed"},{status:503});
   }
   return NextResponse.json({updated:true,tags});
 }
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
