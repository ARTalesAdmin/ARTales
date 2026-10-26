import {NextResponse} from "next/server";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
import {approvalBlockers,isAutomaticScreen} from "@/lib/legal/reviewHistory";
const valid=(s:string)=>/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!LEGAL_SCREEN_V1_ENABLED)return NextResponse.json({error:"disabled"},{status:404});
 const profile=await requireEditorOrAdmin(),{id}=await params;
 if(!valid(id))return NextResponse.json({error:"invalid"},{status:400});
 const form=await req.formData();
 const sourceId=String(form.get("source_id")??""),decisionNo=Number(form.get("decision_no"));
 const verdict=String(form.get("verdict")??""),rationale=String(form.get("rationale")??"").trim();
 const includeImages=String(form.get("include_illustrations")??"false")==="true";
 if(!valid(sourceId)||!Number.isSafeInteger(decisionNo)||decisionNo<1||!["approved","needs_evidence","deferred","rejected"].includes(verdict)||rationale.length<15||rationale.length>5000)
  return NextResponse.json({error:"invalid"},{status:400});
 const db=await createClient();
 const [{data:run},{data:current},{data:src},{data:lock}]=await Promise.all([
  db.from("candidate_legal_decisions").select("decision_no,source_id,verdict,rationale").eq("candidate_id",id).eq("decision_no",decisionNo).maybeSingle(),
  db.from("candidate_legal_decisions").select("decision_no").eq("candidate_id",id).order("decision_no",{ascending:false}).limit(1).maybeSingle(),
  db.from("candidate_legal_sources").select("*").eq("candidate_id",id).eq("id",sourceId).maybeSingle(),
  db.from("candidate_legal_locks").select("candidate_id").eq("candidate_id",id).maybeSingle()
 ]);
 if(lock)return NextResponse.json({error:"already_locked"},{status:409});
 if(!run||run.source_id!==sourceId||!isAutomaticScreen(run)||!src)return NextResponse.json({error:"invalid_run"},{status:409});
 if(current?.decision_no!==decisionNo)return NextResponse.json({error:"stale_run"},{status:409});
 let recordedOutcome:string|null=null;
 try{const note=JSON.parse(src.notes??"{}") as {schema?:string;outcome?:string};if(note.schema==="artales.public-domain-check.v1")recordedOutcome=note.outcome??null;}catch{}
 if(verdict==="approved"&&(rationale.length<30||approvalBlockers(src).length||recordedOutcome===null||recordedOutcome==="no"||(includeImages&&recordedOutcome!=="yes_with_illustrations")))
  return NextResponse.json({error:"missing_evidence"},{status:422});
 const {error}=await db.from("candidate_legal_decisions").insert({candidate_id:id,source_id:sourceId,verdict,territory:"CZ/EU",rationale,reviewed_by:profile.id});
 return error?NextResponse.json({error:"cannot_save_decision"},{status:422}):NextResponse.json({ok:true});
}
