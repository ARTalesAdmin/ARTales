import {NextResponse} from "next/server";
import {isPrescreenFixture} from "@/lib/prescreen/access";
import {fixtureInventory} from "@/lib/prescreen/fixture";
import {searchGenre,enrichAuthor} from "@/lib/prescreen/openLibrary";
import {assessChronology,identityKey,planPrescreen,DEFAULT_PRESCREEN_WEIGHTS} from "@/lib/prescreen/engine";
export const runtime="nodejs";
export const maxDuration=30;
/** One isolated live bibliographic smoke request: no database, no write, no rights verdict. */
export async function POST(){
 if(process.env.VERCEL_ENV!=="preview"&&!isPrescreenFixture())
   return NextResponse.json({error:"preview_only"},{status:404});
 if(!isPrescreenFixture())return NextResponse.json({error:"fixture_not_enabled"},{status:403});
 const genre="essay" as const; // test a less-represented literary form
 try{
  const rows=await searchGenre(genre,0,8);
  const already=new Set(fixtureInventory.existingIdentityKeys);
  const picked=rows.find(row=>!already.has(identityKey(row.title,row.author)));
  if(!picked)return NextResponse.json({ok:false,reason:"no_new_bibliographic_record",genre,source:"Open Library",searched:rows.length});
  const enriched=await enrichAuthor(picked).catch(()=>picked);
  const decision=planPrescreen([enriched],fixtureInventory,1,DEFAULT_PRESCREEN_WEIGHTS);
  return NextResponse.json({ok:true,source:"Open Library",genre,searched:rows.length,
    title:enriched.title,author:enriched.author,workKey:enriched.workKey,
    authorKey:enriched.authorKey,sourceUrl:enriched.sourceUrl,
    firstPublished:enriched.firstPublished,authorBorn:enriched.authorBorn,
    authorDied:enriched.authorDied,duplicate:decision.decisions[0]?.outcome==="duplicate",
    outcome:decision.decisions[0]?.outcome??"review",
    reason:decision.decisions[0]?.reason??"no_decision",
    chronology:assessChronology(enriched)??"plausible_not_legal_clearance",
    note:"Živý katalogový test, pouze metadata; fixture nečte reálnou knihovnu ARTales a nic neukládá."});
 }catch(e){return NextResponse.json({ok:false,error:"catalog_lookup_failed",detail:e instanceof Error?e.message:"unknown"},{status:502});}
}

/** Read-only smoke endpoint is intentionally accessible by GET for preview QA. */
export const GET=POST;
