import {
  PRESCREEN_GENRES,identityKey,planPrescreen,scoreGenre,
  type BibliographicTitle,type PortfolioInventory,type PrescreenGenre,
  type PrescreenWeights
} from "./engine";
import {searchGenre,enrichAuthor,pause} from "./openLibrary";

/**
 * One bounded bibliographic run shared by the preview fixture and the
 * authenticated DB-backed path. Search is live; legal clearance is separate.
 * No writes or stateful side-effects occur in this module.
 */
export type PrescreenLookup = {
  search:(genre:PrescreenGenre,offset:number,limit:number)=>Promise<BibliographicTitle[]>;
  enrich:(row:BibliographicTitle)=>Promise<BibliographicTitle>;
  delay:(ms:number)=>Promise<unknown>;
  now:()=>number;
};
const network:PrescreenLookup={search:searchGenre,enrich:enrichAuthor,delay:pause,now:Date.now};

export async function runLivePrescreen(
 target:number,inventory:PortfolioInventory,weights:PrescreenWeights,
 lookup:PrescreenLookup=network,
 options:{maxQueries?:number;maxEnrichments?:number;budgetMs?:number}={}
) {
 const started=lookup.now();
 const maxQueries=options.maxQueries??Math.min(6,Math.max(3,target));
 const maxEnrichments=options.maxEnrichments??Math.min(14,Math.max(5,target*2));
 const budgetMs=options.budgetMs??42500;
 const source:BibliographicTitle[]=[];
 const seenSource=new Set<string>();
 const excluded=new Set(inventory.existingIdentityKeys);
 const excludedWorks=new Set([...inventory.existingWorkKeys,...inventory.existingCandidateKeys]);
 const pages=new Map<PrescreenGenre,number>();
 const exploredGenres:PrescreenGenre[]=[];
 const errors:string[]=[];
 let searched=0,enriched=0,queries=0;
 let result=planPrescreen([],inventory,target,weights);
 while(result.missing>0 && queries<maxQueries && lookup.now()-started<budgetMs){
  const ranked=[...PRESCREEN_GENRES].sort((a,b)=>{
    const selected=Object.fromEntries(PRESCREEN_GENRES.map(g=>[
      g,result.candidates.filter(c=>c.genre===g).length
    ])) as Partial<Record<PrescreenGenre,number>>;
    return scoreGenre(b,weights,inventory,selected,target)-
           scoreGenre(a,weights,inventory,selected,target) || a.localeCompare(b);
  });
  // First cover distinct underrepresented forms, then advance catalog pages.
  const unseen=ranked.find(g=>!pages.has(g));
  const genre=unseen??ranked[0];
  const page=pages.get(genre)??0;
  pages.set(genre,page+1);
  exploredGenres.push(genre);
  queries++;
  try{
   // A single genre lookup examines a small, fixed first (or next) page.
   const rows=await lookup.search(genre,page*16,16);
   searched+=rows.length;
   for(const row of rows){
    if(result.missing===0 || enriched>=maxEnrichments || lookup.now()-started>=budgetMs)break;
    if(seenSource.has(row.workKey))continue;
    seenSource.add(row.workKey);
    const key=identityKey(row.title,row.author);
    if(excluded.has(key)||excludedWorks.has(row.workKey)){
      // Duplicates remain auditable but do not consume author lookups.
      source.push(row);
    }else{
      if(enriched || queries>1)await lookup.delay(1050);
      try{source.push(await lookup.enrich(row));}
      catch {source.push(row);errors.push("author_metadata_unavailable:"+row.workKey);}
      enriched++;
    }
    result=planPrescreen(source,inventory,target,weights);
   }
   if(rows.length===0)errors.push("catalog_empty:"+genre);
  }catch(e){
   errors.push("catalog_lookup_failed:"+genre+":"+(e instanceof Error?e.message:"unknown"));
  }
 }
 return {...result,exploredGenres,errors,searched,enriched,queries,
  boundedBy:result.missing>0?(lookup.now()-started>=budgetMs?"time_budget":
     queries>=maxQueries?"source_limit":"metadata_limit"):null};
}
