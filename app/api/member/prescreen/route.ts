import { NextResponse } from "next/server";
import { requirePrescreenAccess } from "@/lib/prescreen/access";
import { fixtureInventory, fixtureWeights, fixtureNotice, fixtureSuggestions } from "@/lib/prescreen/fixture";
import { savePrescreenRun } from "@/lib/prescreen/persist";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PRESCREEN_WEIGHTS,PRESCREEN_GENRES, planPrescreen, identityKey,
  type BibliographicTitle,type PortfolioInventory,type PrescreenGenre
} from "@/lib/prescreen/engine";
import { enrichAuthor, searchGenre, pause } from "@/lib/prescreen/openLibrary";

export const runtime="nodejs";
export const maxDuration=60;

function baseInventory():PortfolioInventory {
  return {genreCounts:{prose:0,poetry:0,drama:0,fairy_tale:0,essay:0,other:0},
    unknownGenre:0,publishedTotal:0,existingIdentityKeys:[],existingWorkKeys:[],existingCandidateKeys:[]};
}

export async function POST(request:Request) {
  if(process.env.VERCEL_ENV!=="preview"&&process.env.NODE_ENV!=="development")
    return NextResponse.json({error:"preview_only"},{status:404});
  const access=await requirePrescreenAccess();
  const body=await request.json().catch(()=>null);
  const target=Number(body?.target);
  if(!Number.isInteger(target)||target<1||target>12)
    return NextResponse.json({error:"target_1_to_12"},{status:400});
  if(access.fixture){
    const demo=planPrescreen(fixtureSuggestions,fixtureInventory,target,fixtureWeights);
    return NextResponse.json({mode:"isolated_fixture",createdCandidates:0,legalClearance:false,
      approvedForPublication:false,target,portfolio:{published:fixtureInventory.publishedTotal,
      unclassified:fixtureInventory.unknownGenre,genreCounts:fixtureInventory.genreCounts,
      weights:fixtureWeights,classificationComplete:true},selected:demo.candidates,
      decisions:demo.decisions,missing:demo.missing,stopReason:demo.stopReason,
      exploredGenres:[],errors:[],note:fixtureNotice});
  }
  const db=await createClient();
  // DB read is required for duplicate safety: fail closed if unavailable.
  const [{data:works,error:workError},{data:authors,error:authorError}]=await Promise.all([
    db.from("works").select("id,title,primary_author_id,status"),
    db.from("authors").select("id,name")
  ]);
  if(workError||authorError) return NextResponse.json({error:"portfolio_unavailable"},{status:503});
  const inventory=baseInventory();
  inventory.publishedTotal=(works??[]).filter(w=>w.status==="published").length;
  inventory.unknownGenre=(works??[]).length;
  const authorNames=new Map((authors??[]).map(a=>[a.id,a.name]));
  inventory.existingIdentityKeys=(works??[]).map(w=>identityKey(w.title,authorNames.get(w.primary_author_id)??""));
  // The current develop preview uses a fixture DB with no candidate schema.
  // Only read candidates when the schema is available, never silently assume it.
  const {data:prior,error:priorError}=await db.from("work_candidates")
    .select("normalized_title,normalized_author_name,proposed_title,proposed_author_name")
    .limit(1000);
  if(priorError && !["42P01","PGRST205","PGRST204"].includes(priorError.code??""))
    return NextResponse.json({error:"candidate_inventory_unavailable"},{status:503});
  inventory.existingIdentityKeys.push(...(prior??[]).map(c=>identityKey(
    c.normalized_title??c.proposed_title,c.normalized_author_name??c.proposed_author_name)));

  // No inferred weights from unclassified titles: weights remain visibly provisional.
  const weights=DEFAULT_PRESCREEN_WEIGHTS;
  const source:BibliographicTitle[]=[];
  let result=planPrescreen(source,inventory,target,weights);
  const maxPages=6; let pages=0;
  const attempted:PrescreenGenre[]=[];
  const errors:string[]=[];
  while(result.missing && pages < maxPages) {
    const next=PRESCREEN_GENRES.map(g=>({genre:g,
      gap:((weights[g]/100)*(inventory.publishedTotal+target))-(inventory.genreCounts[g]
         + result.candidates.filter(c=>c.genre===g).length)}))
       .sort((a,b)=>b.gap-a.gap||a.genre.localeCompare(b.genre))[0]?.genre??"prose";
    // Prefer different deficient genres across attempts for controlled expansion.
    const genre=attempted.includes(next)?
      PRESCREEN_GENRES.find(g=>!attempted.includes(g))??next:next;
    attempted.push(genre);pages++;
    try {
      const found=await searchGenre(genre,0);
      // Resolve author dates only for a small promising subset; bounded requests.
      for(const row of found.slice(0,12)) {
        try {source.push(await enrichAuthor(row));}catch {source.push(row);}
        await pause(375);
      }
    } catch {errors.push("catalog_lookup_failed:"+genre);}
    result=planPrescreen(source,inventory,target,weights);
  }
  let saved;
  try {
    saved=await savePrescreenRun(db,access.userId,target,weights,
      {published:inventory.publishedTotal,unknownGenre:inventory.unknownGenre},
      result.decisions,{exploredGenres:attempted,missing:result.missing,errors});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:"prescreen_persistence_failed"},
      {status:503});
  }
  return NextResponse.json({mode:"persistent_prescreen",runId:saved.runId,
    savedDecisions:saved.decisions,createdCandidates:0,
    legalClearance:false,approvedForPublication:false,target,
    portfolio:{published:inventory.publishedTotal,
      unclassified:inventory.unknownGenre,genreCounts:inventory.genreCounts,
      weights,classificationComplete:false},
    selected:result.candidates,decisions:result.decisions,
    missing:result.missing,stopReason:result.stopReason,
    exploredGenres:attempted,errors,
    note:"Návrh ke kontrole, nikoli ověřená práva nebo uložená kandidátní fronta."});
}
