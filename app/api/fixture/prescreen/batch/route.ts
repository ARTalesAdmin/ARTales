import {NextResponse} from "next/server";
import {isPrescreenFixture} from "@/lib/prescreen/access";
import {fixtureInventory,fixtureWeights} from "@/lib/prescreen/fixture";
import {runLivePrescreen} from "@/lib/prescreen/liveRunner";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request){
 if(!isPrescreenFixture())return NextResponse.json({error:"fixture_unavailable"},{status:404});
 const body=await request.json().catch(()=>null);
 const target=body?.target;
 if(!Number.isInteger(target)||target<1||target>5)return NextResponse.json({error:"target_1_to_5"},{status:400});
 const result=await runLivePrescreen(target,fixtureInventory,fixtureWeights,undefined,
  {maxQueries:Math.min(4,target+1),maxEnrichments:Math.min(7,target+3),budgetMs:39000});
 return NextResponse.json({mode:"live_isolated_preview",target,createdCandidates:0,legalClearance:false,
  selected:result.candidates,decisions:result.decisions,missing:result.missing,
  stopReason:result.stopReason,boundedBy:result.boundedBy,exploredGenres:result.exploredGenres,
  searched:result.searched,errors:result.errors,
  warning:"Kontrola duplicit pouze proti fiktivní fixture, nikoli vůči produkční knihovně. Přijetí do kandidátů je pouze lokální náhled."});
}
