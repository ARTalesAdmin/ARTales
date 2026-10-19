import { NextResponse } from "next/server";
import { requirePrescreenAccess } from "@/lib/prescreen/access";
import { fixtureInventory, fixtureWeights, fixtureNotice, fixtureSuggestions } from "@/lib/prescreen/fixture";
import { savePrescreenRun } from "@/lib/prescreen/persist";
import {loadPrescreenPortfolio} from "@/lib/prescreen/data";
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
  let portfolio;
  try {portfolio=await loadPrescreenPortfolio(db);}
  catch {return NextResponse.json({error:"prescreen_portfolio_database_unavailable"},{status:503});}
  const {inventory,weights,snapshot,revision}=portfolio;

  // Previously shortlisted titles stay in their durable run history, rather
  // than repeatedly consuming author lookups on every press of the button.
  const {data:shortlisted,error:shortlistError}=await db.from("prescreen_decisions")
    .select("source_work_key,identity_key,outcome").eq("outcome","candidate").limit(2500);
  if(shortlistError)return NextResponse.json({error:"prescreen_history_unavailable"},{status:503});
  inventory.existingWorkKeys=(shortlisted??[]).map(d=>d.source_work_key);
  inventory.existingIdentityKeys.push(...(shortlisted??[]).map(d=>d.identity_key));
  const alreadyConsidered=new Set(inventory.existingIdentityKeys);

  // No inferred weights from unclassified titles: weights remain visibly provisional.

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
      for(const row of found.filter(x=>!alreadyConsidered.has(identityKey(x.title,x.author))).slice(0,12)) {
        alreadyConsidered.add(identityKey(row.title,row.author));
        try {source.push(await enrichAuthor(row));}catch {source.push(row);}
        await pause(375);
      }
    } catch {errors.push("catalog_lookup_failed:"+genre);}
    result=planPrescreen(source,inventory,target,weights);
  }
  let saved;
  try {
    saved=await savePrescreenRun(db,access.userId,target,weights,
      {...snapshot,genrePolicyRevision:revision},
      result.decisions,{exploredGenres:attempted,missing:result.missing,errors});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:"prescreen_persistence_failed"},
      {status:503});
  }
  return NextResponse.json({mode:"persistent_prescreen",runId:saved.runId,
    savedDecisions:saved.decisions,createdCandidates:0,
    legalClearance:false,approvedForPublication:false,target,
    portfolio:{published:snapshot.publishedTotal,drafts:snapshot.draftTotal,
      activeCandidates:snapshot.activeCandidateTotal,unclassified:snapshot.unknownGenre,
      genreCounts:inventory.genreCounts,weights,revision,
      classificationComplete:snapshot.classificationComplete},
    selected:result.candidates,decisions:result.decisions,
    missing:result.missing,stopReason:result.stopReason,
    exploredGenres:attempted,errors,
    note:"Návrh ke kontrole, nikoli ověřená práva nebo uložená kandidátní fronta."});
}
