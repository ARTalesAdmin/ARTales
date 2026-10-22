import {assessChronology,screenEuCzAuthorTerm,type BibliographicTitle,type PrescreenGenre,type PrescreenWeights,PRESCREEN_GENRES} from "./engine";
import {DEFAULT_THEME_WEIGHTS,PRESCREEN_THEMES,type PrescreenTheme,type ThemeWeights} from "./themes";

/** Independent, admin-owned bibliographic discovery; never a legal clearance. */
export const SHADOW_FORM_WEIGHTS:PrescreenWeights={
  prose:45,poetry:15,drama:10,fairy_tale:15,essay:10,other:5
};
export const SHADOW_THEME_WEIGHTS:ThemeWeights={...DEFAULT_THEME_WEIGHTS};

export type ShadowDecision={
  state:"suggested"|"deferred"|"review";
  reason:string;
  reconsiderYear:number|null;
  standardTermEndYear:number|null;
};

/** Slider/number controls always leave the selected section totaling exactly 100. */
export function rebalancePercentages<K extends string>(
  weights:Record<K,number>,changed:K,rawValue:number
):Record<K,number>{
  const keys=Object.keys(weights) as K[];
  if(!keys.includes(changed)||!Number.isFinite(rawValue))throw new Error("invalid_weight_change");
  const value=Math.min(100,Math.max(0,Math.round(rawValue)));
  const others=keys.filter(k=>k!==changed);
  const remaining=100-value;
  if(others.length===0)return {...weights,[changed]:100};
  const previous=others.reduce((sum,k)=>sum+Math.max(0,weights[k]||0),0);
  const shares=others.map((key,index)=>{
    const exact=previous>0?Math.max(0,weights[key]||0)/previous*remaining:remaining/others.length;
    return {key,index,count:Math.floor(exact),fraction:exact-Math.floor(exact)};
  });
  let left=remaining-shares.reduce((sum,s)=>sum+s.count,0);
  for(const share of [...shares].sort((a,b)=>b.fraction-a.fraction||a.index-b.index)){
    if(left--<=0)break;
    share.count++;
  }
  const out={...weights,[changed]:value};
  for(const share of shares)out[share.key]=share.count;
  return out;
}

const SUBJECT_PATTERNS:ReadonlyArray<readonly [PrescreenTheme,RegExp]>=[
  ["horror",/\b(horror|ghost stor|gothic fiction|supernatural fiction)\b/i],
  ["romance",/\b(romance|love stor|romantic fiction)\b/i],
  ["detective",/\b(detective|crime fiction|police procedur)\b/i],
  ["science_fiction",/\b(science fiction|space opera|dystopian fiction)\b/i],
  ["fantasy",/\b(fantasy|magic and fiction|fantastic fiction)\b/i],
  ["adventure",/\b(adventure|exploration fiction|sea stor)\b/i],
  ["humor",/\b(humor|humour|comedy|comic fiction)\b/i],
  ["historical",/\b(historical fiction|historical novel)\b/i],
  ["mystery",/\b(mystery|mysteries|suspense fiction)\b/i],
  ["social",/\b(social fiction|social problem|social conditions)\b/i]
];

export function themesFromSubjects(subjects:unknown):PrescreenTheme[]{
  if(!Array.isArray(subjects))return [];
  const texts=subjects.filter((s):s is string=>typeof s==="string").slice(0,100);
  return PRESCREEN_THEMES.filter(tag=>SUBJECT_PATTERNS.some(
    ([name,pattern])=>name===tag&&texts.some(s=>pattern.test(s))
  ));
}
export function formFromSubjects(subjects:unknown):PrescreenGenre|null{
  if(!Array.isArray(subjects))return null;
  const terms=subjects.filter((s):s is string=>typeof s==="string").join(" | ").toLowerCase();
  if(/\b(poetry|poems|verse)\b/.test(terms))return "poetry";
  if(/\b(drama|plays|theater|theatre)\b/.test(terms))return "drama";
  if(/\b(fairy tales|fairy stories|folk tales)\b/.test(terms))return "fairy_tale";
  if(/\b(essays|essay)\b/.test(terms))return "essay";
  if(/\b(novels|fiction|short stories)\b/.test(terms))return "prose";
  return null;
}
export function primaryTheme(tags:readonly PrescreenTheme[],weights:ThemeWeights):PrescreenTheme|null{
  return [...new Set(tags)].sort((a,b)=>weights[b]-weights[a]||
    PRESCREEN_THEMES.indexOf(a)-PRESCREEN_THEMES.indexOf(b))[0]??null;
}

export function preliminaryShadowDecision(
  row:BibliographicTitle,asOfYear=new Date().getUTCFullYear()
):ShadowDecision{
  if((row.authorCount??1)>1)return {state:"review",reason:"multiple_authors_need_individual_terms",
    reconsiderYear:null,standardTermEndYear:null};
  const invalid=assessChronology(row,asOfYear);
  if(invalid)return {state:"review",reason:invalid,reconsiderYear:null,standardTermEndYear:null};
  const term=screenEuCzAuthorTerm(row,asOfYear);
  if(!term)return {state:"review",reason:"author_term_unavailable",
    reconsiderYear:null,standardTermEndYear:null};
  if(!term.standardTermElapsed)return {state:"deferred",
    reason:"eu_cz_author_life_plus_70_not_elapsed",
    reconsiderYear:term.reviewNotBeforeYear,standardTermEndYear:term.standardTermEndYear};
  return {state:"suggested",reason:"eu_cz_author_term_elapsed_not_legal_clearance",
    reconsiderYear:null,standardTermEndYear:term.standardTermEndYear};
}

/** Weighted topic AND form deficits affect the actual catalog queries, not just UI. */
export type KnownShadowTitle={form:PrescreenGenre;primary_theme:PrescreenTheme|null};
export function planShadowQueries(
  known:readonly KnownShadowTitle[],forms:PrescreenWeights,themes:ThemeWeights,
  count=4
):Array<{kind:"form"|"theme";key:string}>{
  const n=Math.min(8,Math.max(1,Math.floor(count)));
  const total=known.length;
  const formRank=PRESCREEN_GENRES.filter(x=>forms[x]>0).map(key=>({
    kind:"form" as const,key,
    deficit:(total+n)*forms[key]/100-known.filter(x=>x.form===key).length
  })).sort((a,b)=>b.deficit-a.deficit||a.key.localeCompare(b.key));
  const labeled=known.filter(x=>x.primary_theme!==null);
  const themeRank=PRESCREEN_THEMES.filter(x=>themes[x]>0).map(key=>({
    kind:"theme" as const,key,
    deficit:(labeled.length+n)*themes[key]/100-labeled.filter(x=>x.primary_theme===key).length
  })).sort((a,b)=>b.deficit-a.deficit||a.key.localeCompare(b.key));
  const selection:Array<{kind:"form"|"theme";key:string}>=[];
  for(let i=0;selection.length<n&&i<Math.max(formRank.length,themeRank.length);i++){
    if(formRank[i]&&selection.length<n)selection.push({kind:"form",key:formRank[i].key});
    if(themeRank[i]&&selection.length<n)selection.push({kind:"theme",key:themeRank[i].key});
  }
  return selection;
}
