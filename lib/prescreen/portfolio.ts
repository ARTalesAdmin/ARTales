import {
  PRESCREEN_GENRES,
  DEFAULT_PRESCREEN_WEIGHTS,
  validatePrescreenWeights,
  type PrescreenGenre,
  type PrescreenWeights
} from "./engine";

/**
 * Portfolio counts include EVERY existing draft and published work. Genre
 * classification is explicit evidence, not guessed from a title or collection.
 */
export type PortfolioWorkRow = {id:string;status:string};
export type PortfolioGenreRow = {work_id:string;genre:string};
export type PortfolioCandidateRow = {
  id:string;status:string;genre:string|null;matched_work_id?:string|null;
};

export type PortfolioSnapshot = {
  genreCounts:PrescreenWeights;
  unknownGenre:number;
  publishedTotal:number;
  draftTotal:number;
  activeCandidateTotal:number;
  knownGenreTotal:number;
  classificationComplete:boolean;
};

/** Only an accepted/active candidate influences a future genre deficit. */
const activeCandidateStatus = new Set(["new","checking","ready","review_required","accepted"]);
export function isPrescreenGenre(value:unknown):value is PrescreenGenre {
  return typeof value==="string" && PRESCREEN_GENRES.some(genre=>genre===value);
}

export function countPortfolio(
  works:readonly PortfolioWorkRow[],
  assignments:readonly PortfolioGenreRow[],
  candidates:readonly PortfolioCandidateRow[]=[]
):PortfolioSnapshot {
  const counts:PrescreenWeights={...DEFAULT_PRESCREEN_WEIGHTS};
  for(const genre of PRESCREEN_GENRES)counts[genre]=0;

  const genresByWork=new Map<string,PrescreenGenre>();
  for(const entry of assignments){
    if(isPrescreenGenre(entry.genre))genresByWork.set(entry.work_id,entry.genre);
  }

  const seenWork=new Set<string>();
  let unknownGenre=0,publishedTotal=0,draftTotal=0,activeCandidateTotal=0;
  for(const work of works){
    if(seenWork.has(work.id))continue;
    seenWork.add(work.id);
    if(work.status==="published")publishedTotal++;
    if(work.status==="draft")draftTotal++;
    const genre=genresByWork.get(work.id);
    if(genre)counts[genre]++;
    else unknownGenre++;
  }

  const seenCandidates=new Set<string>();
  for(const candidate of candidates){
    if(seenCandidates.has(candidate.id) || !activeCandidateStatus.has(candidate.status) ||
       (candidate.matched_work_id && seenWork.has(candidate.matched_work_id)))continue;
    seenCandidates.add(candidate.id);
    activeCandidateTotal++;
    if(isPrescreenGenre(candidate.genre)) counts[candidate.genre]++;
    else unknownGenre++;
  }

  const knownGenreTotal=PRESCREEN_GENRES.reduce((sum,g)=>sum+counts[g],0);
  return {genreCounts:counts,unknownGenre,publishedTotal,draftTotal,
    activeCandidateTotal,knownGenreTotal,classificationComplete:unknownGenre===0};
}

export function parsePrescreenWeights(value:unknown):PrescreenWeights|null {
  if(!value || typeof value!=="object" || Array.isArray(value))return null;
  const record=value as Record<string,unknown>;
  const weights={...DEFAULT_PRESCREEN_WEIGHTS};
  for(const genre of PRESCREEN_GENRES){
    if(typeof record[genre]!=="number")return null;
    weights[genre]=record[genre];
  }
  return validatePrescreenWeights(weights)?weights:null;
}

export function portfolioGenreGaps(snapshot:PortfolioSnapshot,weights:PrescreenWeights,requested:number){
  if(!validatePrescreenWeights(weights))throw Error("genre_weights_invalid");
  const futureTotal=snapshot.knownGenreTotal + requested;
  return PRESCREEN_GENRES.map(genre=>({
    genre,
    actual:snapshot.genreCounts[genre],
    target:weights[genre],
    missing:Math.round(Math.max(0,futureTotal*weights[genre]/100-snapshot.genreCounts[genre])*100)/100
  })).sort((a,b)=>b.missing-a.missing||a.genre.localeCompare(b.genre));
}
