import type {SupabaseClient} from "@supabase/supabase-js";
import {identityKey,DEFAULT_PRESCREEN_WEIGHTS,type PortfolioInventory,type PrescreenWeights} from "./engine";
import {countPortfolio,parsePrescreenWeights,type PortfolioSnapshot} from "./portfolio";

export type PrescreenPortfolioWork={id:string;title:string;author:string;status:string;genre:string|null};
export type LoadedPrescreenPortfolio={
  weights:PrescreenWeights;revision:number;
  snapshot:PortfolioSnapshot;inventory:PortfolioInventory;
  works:PrescreenPortfolioWork[];
};

export async function loadPrescreenPortfolio(db:SupabaseClient):Promise<LoadedPrescreenPortfolio>{
  // An unavailable portfolio or uninstalled migration MUST block the real run.
  const [{data:works,error:wErr},{data:authors,error:aErr},
         {data:labels,error:lErr},{data:policy,error:pErr},
         {data:candidates,error:cErr}]=await Promise.all([
    db.from("works").select("id,title,primary_author_id,status").limit(10000),
    db.from("authors").select("id,name").limit(10000),
    db.from("prescreen_work_genres").select("work_id,genre").limit(10000),
    db.from("prescreen_genre_policy").select("weights,revision").eq("id",1).single(),
    db.from("work_candidates").select("id,proposed_title,proposed_author_name,normalized_title,normalized_author_name,status,matched_work_id,prescreen_genre,origin_reference").limit(10000)
  ]);
  if(wErr||aErr||lErr||pErr||cErr)throw new Error("prescreen_portfolio_database_unavailable");
  const weights=parsePrescreenWeights(policy.weights);
  if(!weights)throw new Error("prescreen_genre_policy_invalid");
  const authorNames=new Map((authors??[]).map(a=>[a.id,a.name]));
  const labelsMap=new Map((labels??[]).map(a=>[a.work_id,a.genre]));
  const rows:PrescreenPortfolioWork[]=(works??[]).map(w=>({
    id:w.id,title:w.title,author:authorNames.get(w.primary_author_id)??"",
    status:w.status,genre:labelsMap.get(w.id)??null
  }));
  const candidateRows=(candidates??[]).map(c=>({
    id:c.id,status:c.status,genre:c.prescreen_genre,matched_work_id:c.matched_work_id
  }));
  const snapshot=countPortfolio(works??[],labels??[],candidateRows);
  const existingIdentityKeys=[
    ...rows.filter(w=>w.author).map(w=>identityKey(w.title,w.author)),
    ...(candidates??[]).map(c=>identityKey(
      c.normalized_title||c.proposed_title,
      c.normalized_author_name||c.proposed_author_name))
  ];
  const inventory:PortfolioInventory={
    genreCounts:snapshot.genreCounts,unknownGenre:snapshot.unknownGenre,
    publishedTotal:snapshot.publishedTotal,existingIdentityKeys,
    existingWorkKeys:[],existingCandidateKeys:(candidates??[])
      .map(c=>c.origin_reference).filter((x):x is string=>typeof x==="string")
  };
  return {weights,revision:policy.revision,snapshot,inventory,works:rows};
}

export function fallbackFixturePolicy(){return {...DEFAULT_PRESCREEN_WEIGHTS};}
