/**
 * Secondary genre/theme tags, distinct from the mutually-exclusive literary form.
 * A work may have any number of tags. Weights are *relative discovery priorities*
 * and NOT mutually-exclusive shares of the entire library.
 */
export const PRESCREEN_THEMES=[
 "horror","romance","detective","science_fiction","fantasy","adventure",
 "humor","historical","mystery","social"
] as const;
export type PrescreenTheme=typeof PRESCREEN_THEMES[number];
export type ThemeWeights=Record<PrescreenTheme,number>;

export const DEFAULT_THEME_WEIGHTS:ThemeWeights={
 horror:12,romance:12,detective:12,science_fiction:10,fantasy:10,
 adventure:16,humor:8,historical:8,mystery:7,social:5
};

export const THEME_LABELS:Record<PrescreenTheme,string>={
 horror:"Horor",romance:"Romantika",detective:"Detektivka",
 science_fiction:"Sci-fi",fantasy:"Fantasy",adventure:"Dobrodružství",
 humor:"Humor",historical:"Historické",mystery:"Záhady",
 social:"Společenské"
};

export function isPrescreenTheme(value:unknown):value is PrescreenTheme{
 return typeof value==="string"&&PRESCREEN_THEMES.some(tag=>tag===value);
}
export function normalizeThemeTags(input:unknown):PrescreenTheme[]{
 if(!Array.isArray(input))return [];
 return [...new Set(input.filter(isPrescreenTheme))].sort(
   (a,b)=>PRESCREEN_THEMES.indexOf(a)-PRESCREEN_THEMES.indexOf(b)
 );
}
export function validThemeWeights(input:unknown):input is ThemeWeights{
 if(!input||typeof input!=="object"||Array.isArray(input))return false;
 const v=input as Record<string,unknown>;
 return Object.keys(v).length===PRESCREEN_THEMES.length &&
   PRESCREEN_THEMES.every(t=>Number.isInteger(v[t])&&(v[t] as number)>=0&&(v[t] as number)<=100) &&
   PRESCREEN_THEMES.reduce((sum,t)=>sum+(v[t] as number),0)===100;
}
export function themeCoverage(rows:ReadonlyArray<readonly PrescreenTheme[]>){
 const counts={} as Record<PrescreenTheme,number>;
 for(const t of PRESCREEN_THEMES)counts[t]=0;
 for(const row of rows)for(const t of normalizeThemeTags(row))counts[t]++;
 return counts;
}
/** Highest underrepresented selected theme drives ranking; multi-tag works
    are not unfairly rewarded by simply adding more labels. */
export function themeDeficitScore(
 tags:readonly PrescreenTheme[],weights:ThemeWeights,
 counts:Record<PrescreenTheme,number>,
 taggedWorkCount:number,
 selected:Partial<Record<PrescreenTheme,number>>={}
):number{
 const unique=normalizeThemeTags(tags);
 if(unique.length===0)return 0;
 const denom=Math.max(1,taggedWorkCount+1);
 return Math.max(...unique.map(t=>(weights[t]/100)-(counts[t]+(selected[t]??0))/denom));
}

/** Reader popularity is deliberately *not* used here: it can only generate
  a future proposal requiring explicit admin review and acceptance. */
