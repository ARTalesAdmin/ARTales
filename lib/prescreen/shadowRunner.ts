import type {SupabaseClient} from "@supabase/supabase-js";
import {identityKey,type BibliographicTitle,type PrescreenGenre,type PrescreenWeights} from "./engine";
import {type ThemeWeights,type PrescreenTheme,PRESCREEN_THEMES} from "./themes";
import {planShadowQueries,preliminaryShadowDecision,type KnownShadowTitle} from "./shadowPolicy";
import {searchGenre,searchTheme,enrichAuthor,pause} from "./openLibrary";

type ShadowPolicy={form_weights:PrescreenWeights;theme_weights:ThemeWeights;revision:number};
type Query={kind:"form"|"theme";key:string};
const thisYear=()=>new Date().getUTCFullYear();
export async function loadShadowPolicy(db:SupabaseClient):Promise<ShadowPolicy>{
  const {data,error}=await db.from("prescreen_shadow_policy").select("form_weights,theme_weights,revision").eq("id",1).single();
  if(error||!data)throw Error("prescreen_shadow_policy_unavailable");
  return data as ShadowPolicy;
}
export async function runShadowPrescreen(db:SupabaseClient,actor:string,requested:number){
  const policy=await loadShadowPolicy(db);
  const {data:known,error:knownError}=await db.from("prescreen_shadow_titles")
    .select("id,source_work_key,identity_key,form,primary_theme,state").limit(10000);
  if(knownError)throw Error("prescreen_shadow_titles_unavailable");
  const knownRows=known??[];
  // Existing published/draft works are not a separate candidate pipeline;
  // reading them prevents duplicate recommendations in the current library.
  const [{data:works,error:worksError},{data:authors,error:authorsError}]=await Promise.all([
    db.from("works").select("title,primary_author_id").limit(10000),
    db.from("authors").select("id,name").limit(10000)
  ]);
  if(worksError||authorsError)throw Error("library_duplicate_reference_unavailable");
  const authorNames=new Map((authors??[]).map(a=>[a.id,a.name]));
  const libraryIdentity=new Set((works??[]).filter(w=>authorNames.has(w.primary_author_id))
    .map(w=>identityKey(w.title,authorNames.get(w.primary_author_id)!)));
  const portfolio=knownRows.map(r=>({form:r.form as PrescreenGenre,primary_theme:r.primary_theme as PrescreenTheme|null}));
  const queries=planShadowQueries(portfolio,policy.form_weights,policy.theme_weights,6);
  const {data:run,error:runErr}=await db.from("prescreen_shadow_runs").insert({
    requested,started_by:actor,policy_revision:policy.revision,planned_queries:queries
  }).select("id").single();
  if(runErr||!run)throw Error("prescreen_shadow_run_unavailable");
  let discovered=0,alreadyKnown=0,suggested=0,review=0,deferred=0,lookupCalls=0;
  const problems:string[]=[];
  const seen=new Set<string>();
  const knownKeys=new Set(knownRows.map(r=>r.source_work_key));
  const knownIdentity=new Set([...knownRows.map(r=>r.identity_key),...libraryIdentity]);
  try{
    for(const query of queries){
      if(suggested>=requested)break;
      const qKey=query.kind+":"+query.key;
      const {data:cursor,error:cursorError}=await db.from("prescreen_shadow_cursors")
        .select("next_offset").eq("query_key",qKey).maybeSingle();
      if(cursorError)throw Error("cursor_read_failed");
      const offset=cursor?.next_offset??0;
      // Rate limiting below API terms; no background crawler. One page per query per click.
      if(lookupCalls)await pause(1100);
      const rows=query.kind==="form"?
        await searchGenre(query.key as PrescreenGenre,offset,12):
        await searchTheme(query.key as PrescreenTheme,offset,12);
      lookupCalls++;
      let consumed=0;
      for(const raw of rows){
        consumed++;
        if(seen.has(raw.workKey))continue;
        seen.add(raw.workKey);
        if(knownKeys.has(raw.workKey)||knownIdentity.has(identityKey(raw.title,raw.author))){alreadyKnown++;continue;}
        // Metadata enrichment is bounded to five lookups per run, not per query.
        if(discovered>=Math.min(requested*3,5))break;
        if(discovered||lookupCalls>1)await pause(1100);
        let row:BibliographicTitle=raw;
        try{row=await enrichAuthor(raw);lookupCalls++;}
        catch{problems.push("author_metadata_missing:"+raw.workKey);}
        const decision=preliminaryShadowDecision(row,thisYear());
        const payload={
          provider:"openlibrary",source_work_key:row.workKey,
          identity_key:identityKey(row.title,row.author),title:row.title,author:row.author,
          author_key:row.authorKey,source_url:row.sourceUrl,form:row.genre,
          themes:row.themes??[],primary_theme:row.primaryTheme??null,
          first_published:row.firstPublished,author_born:row.authorBorn,author_died:row.authorDied,
          author_count:row.authorCount??1,state:decision.state,reason:decision.reason,
          standard_term_end_year:decision.standardTermEndYear,reconsider_year:decision.reconsiderYear,
          last_assessed_year:thisYear(),last_run_id:run.id
        };
        const {data:title,error:titleErr}=await db.from("prescreen_shadow_titles")
          .upsert(payload,{onConflict:"source_work_key"}).select("id").single();
        if(titleErr||!title)throw Error("shadow_title_insert_failed");
        const {error:assessmentErr}=await db.from("prescreen_shadow_assessments")
          .insert({title_id:title.id,run_id:run.id,outcome:decision.state,
            reason:decision.reason,assessed_year:thisYear(),evidence:{
              source:row.sourceUrl,authorKey:row.authorKey,firstPublished:row.firstPublished
            }});
        if(assessmentErr)throw Error("shadow_assessment_insert_failed");
        knownKeys.add(raw.workKey);knownIdentity.add(identityKey(raw.title,raw.author));
        discovered++;
        if(decision.state==="suggested")suggested++;
        if(decision.state==="review")review++;
        if(decision.state==="deferred")deferred++;
      }
      // Save progress only for rows actually examined, including known duplicates.
      const {error:cursorWriteErr}=await db.from("prescreen_shadow_cursors").upsert({
        query_key:qKey,next_offset:offset+consumed,
        updated_at:new Date().toISOString()
      },{onConflict:"query_key"});
      if(cursorWriteErr)throw Error("cursor_save_failed");
    }
  }catch(e){problems.push(e instanceof Error?e.message:"unknown_error");}
  const summary={discovered,alreadyKnown,suggested,review,deferred,lookupCalls,
    problems,missing:Math.max(0,requested-suggested)};
  const {error:finishErr}=await db.from("prescreen_shadow_runs").update({
    status:problems.length?"incomplete":"complete",summary,finished_at:new Date().toISOString()
  }).eq("id",run.id);
  if(finishErr)throw Error("prescreen_shadow_run_finalize_failed");
  return {runId:run.id,queries,summary};
}
export async function reassessDueTitles(db:SupabaseClient){
  const {data,error}=await db.from("prescreen_shadow_titles")
    .select("id,author_died,reconsider_year,state").eq("state","deferred")
    .lte("reconsider_year",thisYear()).limit(200);
  if(error)throw Error("reassessment_query_failed");
  for(const t of data??[]){
    if(typeof t.author_died!=="number")continue;
    const {error:updateErr}=await db.from("prescreen_shadow_titles").update({
      state:"review",reason:"author_term_elapsed_manual_verification_required",
      reconsider_year:null,last_assessed_year:thisYear()
    }).eq("id",t.id).eq("state","deferred");
    if(updateErr)throw Error("reassessment_update_failed");
    const {error:aErr}=await db.from("prescreen_shadow_assessments").insert({
      title_id:t.id,outcome:"review",reason:"author_term_elapsed_manual_verification_required",
      assessed_year:thisYear(),evidence:{trigger:"calendar_reconsideration"}
    });
    if(aErr)throw Error("reassessment_history_failed");
  }
  return (data??[]).length;
}
