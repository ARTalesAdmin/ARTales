import {NextResponse} from "next/server";
import {requireEditorOrAdmin} from "@/lib/guards";
import {canProgressCandidate} from "@/lib/editorial/candidateAuthority";
import {createClient} from "@/lib/supabase/server";
import {isAutomaticScreen} from "@/lib/legal/reviewHistory";
import {assessGutenbergRisk} from "@/lib/legal/riskDecision";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const valid=(s:string)=>/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
const origins=new Set(["https://artales.net","https://www.artales.net"]);
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!LEGAL_SCREEN_V1_ENABLED)return NextResponse.json({error:"disabled"},{status:404});
 if(!origins.has(req.headers.get("origin")??"")||
    (req.headers.get("sec-fetch-site")&&req.headers.get("sec-fetch-site")!=="same-origin"))
  return NextResponse.json({error:"invalid_origin"},{status:403});
 if(!req.headers.get("content-type")?.startsWith("application/json")||
    Number(req.headers.get("content-length")??0)>4096)
  return NextResponse.json({error:"invalid_body"},{status:400});
 const actor=await requireEditorOrAdmin(),{id}=await params;
 if(!valid(id)||!await canProgressCandidate(id,actor))
  return NextResponse.json({error:"candidate_progress_forbidden"},{status:403});
 const input=await req.json().catch(()=>null) as {
  choice?:string;sourceId?:string;decisionNo?:number;confirm?:boolean
 }|null;
 if(!input||!valid(input.sourceId??"")||!Number.isSafeInteger(input.decisionNo)||
    !["accept","stop"].includes(input.choice??"")||
    (input.choice==="accept"&&input.confirm!==true))
  return NextResponse.json({error:"invalid_choice"},{status:400});
 const db=await createClient();
 const [{data:latest,error:latestError},{data:source,error:sourceError},{data:lock,error:lockError}]=await Promise.all([
  db.from("candidate_legal_decisions").select("decision_no,source_id,verdict,rationale")
   .eq("candidate_id",id).order("decision_no",{ascending:false}).limit(1).maybeSingle(),
  db.from("candidate_legal_sources").select("*").eq("id",input.sourceId)
   .eq("candidate_id",id).maybeSingle(),
  db.from("candidate_legal_locks").select("candidate_id").eq("candidate_id",id).maybeSingle()
 ]);
 if(latestError||sourceError||lockError||!latest||!source||lock)
  return NextResponse.json({error:"legal_state_not_ready"},{status:409});
 if(latest.source_id!==input.sourceId)
  return NextResponse.json({error:"stale_screen"},{status:409});
 // A previous accepted risk decision may have committed when the following
 // lock failed. Retry the lock, never write a second approval or risk row.
 if(latest.verdict==="approved"&&latest.rationale.startsWith("ARTALES_RISK_ACCEPTED_V1:")){
  const approved=await db.from("candidate_legal_locks").insert({
   candidate_id:id,source_id:input.sourceId,decision_no:latest.decision_no,
   locked_by:actor.id,source_url:"https://placeholder.invalid",
   download_url:"https://placeholder.invalid",source_facts:{},illustrations:[]
  });
  return approved.error?NextResponse.json({error:"risk_lock_failed"},{status:409}):
   NextResponse.json({autoLocked:true,recovered:true});
 }
 if(latest.decision_no!==input.decisionNo||!isAutomaticScreen(latest))
  return NextResponse.json({error:"stale_screen"},{status:409});
 if(input.choice==="stop"){
  const stopped=await db.from("candidate_legal_decisions").insert({
   candidate_id:id,source_id:input.sourceId,verdict:"deferred",territory:"CZ/EU",
   rationale:"Právní nejistota ponechána otevřená. Editor rozhodl zastavit přípravu díla, automatické pokračování neproběhlo.",
   reviewed_by:actor.id
  });
  return stopped.error?NextResponse.json({error:"stop_failed"},{status:409}):
   NextResponse.json({stopped:true});
 }
 const assessment=assessGutenbergRisk(source);
 if(!assessment.eligible)
  return NextResponse.json({error:"risk_not_eligible",blocking:assessment.blocking},{status:422});
 const {data:existingRisk,error:riskReadError}=await db.from("candidate_legal_risk_acceptances")
  .select("screening_decision_no").eq("candidate_id",id).eq("source_id",input.sourceId)
  .eq("screening_decision_no",input.decisionNo).eq("accepted_by",actor.id).maybeSingle();
 if(riskReadError)return NextResponse.json({error:"risk_registry_unavailable"},{status:503});
 if(!existingRisk){
  const {error:riskWriteError}=await db.from("candidate_legal_risk_acceptances").insert({
   candidate_id:id,source_id:input.sourceId,screening_decision_no:input.decisionNo,
   accepted_by:actor.id,uncertainties:assessment.uncertainties
  });
  if(riskWriteError)return NextResponse.json({error:"risk_acceptance_not_recorded"},{status:409});
 }
 const rationale="ARTALES_RISK_ACCEPTED_V1: Oprávněný editor výslovně přijal evidované nejistoty původního automatického screenu #"+
  input.decisionNo+" pro přípravu textového vydání bez ilustrací. Nejde o tvrzení, že chybějící údaje byly právně ověřeny. Nejistoty: "+
  assessment.uncertainties.join("; ").slice(0,2700);
 const approved=await db.from("candidate_legal_decisions").insert({
  candidate_id:id,source_id:input.sourceId,verdict:"approved",territory:"CZ/EU",
  rationale,reviewed_by:actor.id
 }).select("decision_no").single();
 if(approved.error)return NextResponse.json({error:"risk_approval_failed"},{status:409});
 const locked=await db.from("candidate_legal_locks").insert({
  candidate_id:id,source_id:input.sourceId,decision_no:approved.data.decision_no,
  locked_by:actor.id,source_url:"https://placeholder.invalid",
  download_url:"https://placeholder.invalid",source_facts:{},illustrations:[]
 });
 if(locked.error)return NextResponse.json({error:"risk_lock_failed"},{status:409});
 return NextResponse.json({autoLocked:true,riskAccepted:true},
  {headers:{"Cache-Control":"private, no-store"}});
}
