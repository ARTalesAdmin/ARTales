import type {SupabaseClient} from "@supabase/supabase-js";
import {identityKey,type BibliographicTitle,type PrescreenGenre,type PrescreenWeights} from "./engine";
import {type ThemeWeights,type PrescreenTheme} from "./themes";
import {planShadowQueries,preliminaryShadowDecision} from "./shadowPolicy";
import {searchGenrePage,searchThemePage,enrichAuthor,pause,type OpenLibraryCatalogPage} from "./openLibrary";
import {SHADOW_PAGE_SIZE,SHADOW_RUN_BUDGET_MS,maximumShadowEnrichments,nextShadowOffset} from "./shadowCursor";

type ShadowPolicy={form_weights:PrescreenWeights;theme_weights:ThemeWeights;revision:number};
export type ShadowCatalog={
  form:(genre:PrescreenGenre,offset:number,limit:number,latestYear?:number)=>Promise<OpenLibraryCatalogPage>;
  theme:(theme:PrescreenTheme,offset:number,limit:number,latestYear?:number)=>Promise<OpenLibraryCatalogPage>;
  enrich:(row:BibliographicTitle)=>Promise<BibliographicTitle>;
  delay:(ms:number)=>Promise<unknown>;
  now:()=>number;
};
const liveCatalog:ShadowCatalog={
  form:searchGenrePage,theme:searchThemePage,enrich:enrichAuthor,delay:pause,now:Date.now
};
const thisYear=()=>new Date().getUTCFullYear();

export async function loadShadowPolicy(db:SupabaseClient):Promise<ShadowPolicy>{
  const {data,error}=await db.from("prescreen_shadow_policy")
    .select("form_weights,theme_weights,revision").eq("id",1).single();
  if(error||!data)throw Error("prescreen_shadow_policy_unavailable");
  return data as ShadowPolicy;
}

/** Safe under partial runs: never advance a cursor beyond an unprocessed raw record.
 * A new click starts the next bounded batch; partial runs are recorded honestly. */
export async function runShadowPrescreen(
  db:SupabaseClient,actor:string,requested:number,catalog:ShadowCatalog=liveCatalog,latestYear?:number
){
  const maxEnrichments=maximumShadowEnrichments(requested);
  const started=catalog.now();
  const policy=await loadShadowPolicy(db);
  const {data:known,error:knownError}=await db.from("prescreen_shadow_titles")
    .select("id,source_work_key,identity_key,form,primary_theme,state").limit(10000);
  if(knownError)throw Error("prescreen_shadow_titles_unavailable");
  const knownRows=known??[];
  const [{data:works,error:worksError},{data:authors,error:authorsError}]=await Promise.all([
    db.from("works").select("title,primary_author_id").limit(10000),
    db.from("authors").select("id,name").limit(10000)
  ]);
  if(worksError||authorsError)throw Error("library_duplicate_reference_unavailable");
  const authorNames=new Map((authors??[]).map(a=>[a.id,a.name]));
  const libraryIdentity=new Set((works??[]).filter(w=>authorNames.has(w.primary_author_id))
    .map(w=>identityKey(w.title,authorNames.get(w.primary_author_id)!)));
  const portfolio=knownRows.map(r=>({
    form:r.form as PrescreenGenre,primary_theme:r.primary_theme as PrescreenTheme|null
  }));
  const queries=planShadowQueries(portfolio,policy.form_weights,policy.theme_weights,6);
  const {data:run,error:runErr}=await db.from("prescreen_shadow_runs").insert({
    requested,started_by:actor,policy_revision:policy.revision,planned_queries:queries
  }).select("id").single();
  if(runErr||!run)throw Error("prescreen_shadow_run_unavailable");

  let discovered=0,alreadyKnown=0,suggested=0,review=0,deferred=0;
  let lookupCalls=0,enrichmentAttempts=0;
  const problems:string[]=[];
  const seen=new Set<string>();
  const knownKeys=new Set(knownRows.map(r=>r.source_work_key));
  const knownIdentity=new Set([...knownRows.map(r=>r.identity_key),...libraryIdentity]);
  try {
    for(const query of queries){
      if(suggested>=requested||enrichmentAttempts>=maxEnrichments||
         catalog.now()-started>=SHADOW_RUN_BUDGET_MS)break;
      const qKey=query.kind+":"+query.key+(latestYear===undefined?"":":before-"+latestYear);
      const {data:cursor,error:cursorError}=await db.from("prescreen_shadow_cursors")
        .select("next_offset").eq("query_key",qKey).maybeSingle();
      if(cursorError)throw Error("cursor_read_failed");
      const offset=cursor?.next_offset??0;
      if(lookupCalls)await catalog.delay(1100);
      if(catalog.now()-started>=SHADOW_RUN_BUDGET_MS)break;

      let page:OpenLibraryCatalogPage;
      try{
        page=query.kind==="form"?
          await catalog.form(query.key as PrescreenGenre,offset,SHADOW_PAGE_SIZE,latestYear):
          await catalog.theme(query.key as PrescreenTheme,offset,SHADOW_PAGE_SIZE,latestYear);
        lookupCalls++;
      }catch(e){
        problems.push("catalog_lookup_failed:"+qKey+":"+
          (e instanceof Error?e.message:"unknown"));
        continue;
      }

      let lastProcessedOffset:number|null=null;
      let interrupted=false;
      for(const {sourceOffset,item:raw} of page.entries){
        if(suggested>=requested||enrichmentAttempts>=maxEnrichments||
           catalog.now()-started>=SHADOW_RUN_BUDGET_MS){
          interrupted=true;
          break;
        }
        if(seen.has(raw.workKey)){
          lastProcessedOffset=sourceOffset;
          continue;
        }
        seen.add(raw.workKey);
        const key=identityKey(raw.title,raw.author);
        if(knownKeys.has(raw.workKey)||knownIdentity.has(key)){
          alreadyKnown++;
          lastProcessedOffset=sourceOffset;
          continue;
        }

        if(lookupCalls)await catalog.delay(1100);
        if(catalog.now()-started>=SHADOW_RUN_BUDGET_MS){
          interrupted=true;
          break;
        }
        enrichmentAttempts++;
        lookupCalls++;
        let row:BibliographicTitle=raw;
        try{row=await catalog.enrich(raw);}
        catch{problems.push("author_metadata_missing:"+raw.workKey);}
        const decision=preliminaryShadowDecision(row,thisYear());
        const payload={
          provider:"openlibrary",source_work_key:row.workKey,
          identity_key:key,title:row.title,author:row.author,
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
        knownKeys.add(raw.workKey);
        knownIdentity.add(key);
        lastProcessedOffset=sourceOffset;
        discovered++;
        if(decision.state==="suggested")suggested++;
        if(decision.state==="review")review++;
        if(decision.state==="deferred")deferred++;
      }
      const nextOffset=nextShadowOffset(offset,page.fetchedCount,lastProcessedOffset,interrupted);
      if(nextOffset>offset){
        const {error:cursorWriteErr}=await db.from("prescreen_shadow_cursors").upsert({
          query_key:qKey,next_offset:nextOffset,updated_at:new Date().toISOString()
        },{onConflict:"query_key"});
        if(cursorWriteErr)throw Error("cursor_save_failed");
      }
    }
  }catch(e){
    problems.push(e instanceof Error?e.message:"unknown_error");
  }
  const fulfilled=suggested>=requested;
  const stopReason=fulfilled?"target_reached":
    catalog.now()-started>=SHADOW_RUN_BUDGET_MS?"time_budget":
    enrichmentAttempts>=maxEnrichments?"enrichment_limit":"bounded_queries_exhausted";
  const summary={discovered,alreadyKnown,suggested,review,deferred,lookupCalls,
    enrichmentAttempts,maxEnrichments,stopReason,latestYear:latestYear??null,problems,
    missing:Math.max(0,requested-suggested)};
  const {error:finishErr}=await db.from("prescreen_shadow_runs").update({
    status:fulfilled&&problems.length===0?"complete":"incomplete",
    summary,finished_at:new Date().toISOString()
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
