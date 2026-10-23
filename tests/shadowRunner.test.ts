import test from "node:test";
import assert from "node:assert/strict";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {BibliographicTitle} from "../lib/prescreen/engine";
import {SHADOW_FORM_WEIGHTS,SHADOW_THEME_WEIGHTS} from "../lib/prescreen/shadowPolicy";
import {mapOpenLibraryPage} from "../lib/prescreen/openLibrary";
import {maximumShadowEnrichments,nextShadowOffset} from "../lib/prescreen/shadowCursor";
import {runShadowPrescreen,type ShadowCatalog} from "../lib/prescreen/shadowRunner";

const row=(n:number):BibliographicTitle=>({
  workKey:"/works/OL"+n+"W",title:"Work "+n,author:"Author "+n,
  authorKey:"OL"+n+"A",genre:"prose",firstPublished:1890,
  authorBorn:1850,authorDied:1900,sourceUrl:"https://openlibrary.org/works/OL"+n+"W",origin:"catalog"
});
function fakeDB(){
  const cursors=new Map<string,number>();
  const titles:Array<Record<string,unknown>>=[];
  const assessments:Array<Record<string,unknown>>=[];
  const runs:Array<Record<string,unknown>>=[];
  const db={from:(table:string)=>{
    let op="select",payload:Record<string,unknown>={},filters:Record<string,unknown>={};
    const result=()=>{
      if(op==="select"){
        if(table==="prescreen_shadow_policy")return {data:{
          form_weights:SHADOW_FORM_WEIGHTS,theme_weights:SHADOW_THEME_WEIGHTS,revision:1},error:null};
        if(table==="prescreen_shadow_titles")return {data:[],error:null};
        if(table==="works"||table==="authors")return {data:[],error:null};
        if(table==="prescreen_shadow_cursors")return {data:cursors.has(String(filters.query_key))?
          {next_offset:cursors.get(String(filters.query_key))}:null,error:null};
      }
      if(op==="insert"){
        if(table==="prescreen_shadow_runs"){
          runs.push(payload);return {data:{id:"run-1"},error:null};
        }
        if(table==="prescreen_shadow_assessments"){
          assessments.push(payload);return {error:null};
        }
      }
      if(op==="upsert"){
        if(table==="prescreen_shadow_titles"){
          titles.push(payload);
          return {data:{id:"title-"+titles.length},error:null};
        }
        if(table==="prescreen_shadow_cursors"){
          cursors.set(String(payload.query_key),Number(payload.next_offset));
          return {error:null};
        }
      }
      if(op==="update"&&table==="prescreen_shadow_runs"){
        runs.push(payload);return {error:null};
      }
      throw Error("unexpected_db_operation:"+table+":"+op);
    };
    const query={
      select:(_columns:string)=>query,
      insert:(data:Record<string,unknown>)=>{op="insert";payload=data;return query;},
      upsert:(data:Record<string,unknown>,_options?:unknown)=>{op="upsert";payload=data;return query;},
      update:(data:Record<string,unknown>)=>{op="update";payload=data;return query;},
      eq:(key:string,value:unknown)=>{filters[key]=value;return query;},
      limit:(_n:number)=>query,
      single:async()=>result(),
      maybeSingle:async()=>result(),
      then:(resolve:(v:unknown)=>unknown,reject?:(e:unknown)=>unknown)=>
        Promise.resolve(result()).then(resolve,reject)
    };
    return query;
  }};
  return {db:db as unknown as SupabaseClient,cursors,titles,assessments,runs};
}
function catalog(page:ShadowCatalog["form"],clock?:()=>number):ShadowCatalog{
  return {form:page,theme:async()=>({fetchedCount:0,entries:[]}),
    enrich:async row=>row,delay:async()=>{},now:clock??(()=>0)};
}

test("12 requested eligible titles are persisted, not capped at five",async()=>{
  const env=fakeDB();
  const page={fetchedCount:12,entries:Array.from({length:12},(_,i)=>({
    sourceOffset:i,item:row(i+1)
  }))};
  const result=await runShadowPrescreen(env.db,"test-admin",12,catalog(async()=>page));
  assert.equal(maximumShadowEnrichments(12),30);
  assert.equal(result.summary.suggested,12);
  assert.equal(result.summary.missing,0);
  assert.equal(result.summary.stopReason,"target_reached");
  assert.equal(env.titles.length,12);
  assert.equal(env.assessments.length,12);
  assert.equal(env.cursors.get("form:prose"),12);
  assert.equal(env.runs.at(-1)?.status,"complete");
});

test("filtered catalog page offsets refer to raw items, not just parsed titles",()=>{
  const doc=(n:number)=>({key:"/works/OL"+n+"W",title:"Work "+n,
    author_name:["Author "+n],author_key:["OL"+n+"A"],first_publish_year:1890});
  const page=mapOpenLibraryPage([doc(1),{key:"invalid"},doc(3)],24,"prose");
  assert.equal(page.fetchedCount,3);
  assert.deepEqual(page.entries.map(e=>e.sourceOffset),[24,26]);
  assert.equal(nextShadowOffset(24,page.fetchedCount,26,false),27);
  assert.equal(nextShadowOffset(24,page.fetchedCount,24,true),25);
  assert.equal(nextShadowOffset(24,page.fetchedCount,null,true),24);
});

test("time budget preserves unfinished source record and reports incomplete",async()=>{
  const env=fakeDB();
  let clock=0;
  const page={fetchedCount:12,entries:[
    {sourceOffset:0,item:row(1)},{sourceOffset:2,item:row(2)},
    {sourceOffset:8,item:row(3)}
  ]};
  const lookup=catalog(async()=>page,()=>clock);
  lookup.enrich=async r=>{clock+=21001;return r;};
  const result=await runShadowPrescreen(env.db,"test-admin",12,lookup);
  assert.equal(result.summary.suggested,2);
  assert.equal(result.summary.stopReason,"time_budget");
  assert.equal(env.cursors.get("form:prose"),3);
  assert.equal(env.runs.at(-1)?.status,"incomplete");
  assert.equal(env.titles.length,2);
});
test("cursor helper rejects invalid source indices",()=>{
  assert.throws(()=>nextShadowOffset(5,12,17,true),/invalid_catalog_offset/);
  assert.throws(()=>maximumShadowEnrichments(13),/requested_1_to_12/);
});
