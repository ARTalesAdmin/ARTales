import {NextResponse} from "next/server";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {isAutomaticScreen} from "@/lib/legal/reviewHistory";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
export async function GET(_req:Request,{params}:{params:Promise<{id:string;decisionNo:string}>}){
 if(!LEGAL_SCREEN_V1_ENABLED)return new Response("Not found",{status:404});
 await requireEditorOrAdmin();
 const {id,decisionNo}=await params;
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)||!/^[1-9]\d{0,17}$/.test(decisionNo))return new Response("Not found",{status:404});
 const db=await createClient();
 const {data:d}=await db.from("candidate_legal_decisions").select("decision_no,candidate_id,source_id,verdict,rationale,recorded_at,source_facts").eq("candidate_id",id).eq("decision_no",Number(decisionNo)).maybeSingle();
 if(!d)return new Response("Not found",{status:404});
 const {data:s}=d.source_id?await db.from("candidate_legal_sources").select("edition_title,source_url,download_url,notes").eq("id",d.source_id).eq("candidate_id",id).maybeSingle():{data:null};
 // Notes belong to a reusable edition and can be newer than this audit. Do not export them as historical proof.
 const report={schema:"artales.legal.audit.v1",candidateId:id,decisionNo:d.decision_no,recordedAt:d.recorded_at,type:isAutomaticScreen(d)?"automatic":"editor",verdict:d.verdict,sourceId:d.source_id,edition:s?.edition_title??null,sourceUrl:s?.source_url??null,downloadUrl:s?.download_url??null,rationale:d.rationale,sourceFacts:d.source_facts,notice:"This immutable decision row does not imply final legal clearance or a snapshot. Edition metadata may have changed since this audit."};
 return new NextResponse(JSON.stringify(report,null,2),{headers:{"Content-Type":"application/json; charset=utf-8","Content-Disposition":`attachment; filename="artales-legal-audit-${decisionNo}.json"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
