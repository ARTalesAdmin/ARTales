import {NextResponse} from "next/server";
import {requireEditorOrAdmin} from "@/lib/guards";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
import {createClient} from "@/lib/supabase/server";

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 if(!LEGAL_SCREEN_V1_ENABLED)return new Response("Not found",{status:404});
 await requireEditorOrAdmin();
 const {id}=await params;
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
  return new Response("Not found",{status:404});
 const db=await createClient();
 const [{data:c},{data:lock}]=await Promise.all([
  db.from("work_candidates").select("id,proposed_title,proposed_author_name").eq("id",id).maybeSingle(),
  db.from("candidate_legal_locks").select("*").eq("candidate_id",id).maybeSingle()
 ]);
 if(!c||!lock)return new Response("Not found",{status:404});
 const report={
  schema:"artales.legal-screen.handoff.v1",territory:"CZ/EU",
  candidate:{id:c.id,title:c.proposed_title,author:c.proposed_author_name},
  selected:{sourceId:lock.source_id,sourceUrl:lock.source_url,downloadUrl:lock.download_url},
  components:{
   text:{rights:lock.source_facts?.originalRights??"unknown",evidence:lock.source_facts?.evidenceUrl??null},
   translation:{type:lock.source_facts?.translationStatus??"unknown",translator:lock.source_facts?.translator??null,rights:lock.source_facts?.translationRights??"unknown"},
   illustrations:lock.illustrations??[]
  },
  verdict:"text_approved_for_next_stage",decisionNo:lock.decision_no,
  lockedAt:lock.locked_at,lockedBy:lock.locked_by,
  notice:"Approval is source and rights-specific. This record is not a downloaded snapshot or publication license for third parties."
 };
 return new NextResponse(JSON.stringify(report,null,2),{
  headers:{"Content-Type":"application/json; charset=utf-8",
   "Content-Disposition":'attachment; filename="artales-legal-screen-'+id+'.json"',
   "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}
 });
}
