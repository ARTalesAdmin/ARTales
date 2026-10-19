import type {SupabaseClient} from "@supabase/supabase-js";
import type {BibliographicTitle,PrescreenDecision,PrescreenWeights} from "./engine";

export async function savePrescreenRun(
  db:SupabaseClient,actor:string,requested:number,weights:PrescreenWeights,
  portfolio:object,decisions:PrescreenDecision[],progress:object
):Promise<{runId:string,decisions:Array<{id:string,source_work_key:string}>}>{
  const {data:run,error:runError}=await db.from("prescreen_runs")
    .insert({created_by:actor,requested,status:"collecting",weights,
      portfolio_snapshot:portfolio,progress}).select("id").single();
  if(runError||!run)throw new Error("prescreen_run_persistence_unavailable");
  const rows=decisions.map(d=>({
    run_id:run.id,source_work_key:d.item.workKey,title:d.item.title,author:d.item.author,
    identity_key:d.identityKey,genre:d.item.genre,
    chronology:{born:d.item.authorBorn,died:d.item.authorDied,first:d.item.firstPublished},
    source_url:d.item.sourceUrl,outcome:d.outcome,reason:d.reason,
    portfolio_score:d.portfolioScore,
    evidence:{origin:d.item.origin,provider:"openlibrary",
      authorKey:d.item.authorKey,sourceWorkKey:d.item.workKey}
  }));
  if(rows.length){
    const {error}=await db.from("prescreen_decisions").insert(rows);
    if(error)throw new Error("prescreen_decisions_persistence_failed");
  }
  const {error:updateError}=await db.from("prescreen_runs").update({
    status:"review",updated_at:new Date().toISOString()}).eq("id",run.id);
  if(updateError)throw new Error("prescreen_run_finalize_failed");
  const {data:saved,error:readError}=await db.from("prescreen_decisions")
    .select("id,source_work_key").eq("run_id",run.id).order("created_at");
  if(readError)throw new Error("prescreen_run_readback_failed");
  return {runId:run.id,decisions:saved??[]};
}
