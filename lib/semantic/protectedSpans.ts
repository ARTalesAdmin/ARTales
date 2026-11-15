import {projectSemanticProseText} from "./displayText";

/**
 * Universal semantic typography, independent of font, viewport, or page size.
 * This affects only presentation; no source atom text or SHA changes.
 */
export type ProtectedTextSpan={start:number;end:number};
const autoPatterns=[
  /(?:Mr|Mrs|Ms|Dr|Prof|Sir|Lady|St)\.?[ \u00a0]+[\p{Lu}][\p{L}\p{M}'-]+(?:[ \u00a0]+[\p{Lu}][\p{L}\p{M}'-]+){0,2}/u.source,
  /(?:[\p{Lu}]\.[ \u00a0]*){1,3}[\p{Lu}][\p{L}\p{M}]+/u.source,
  /[\p{Lu}][\p{Ll}\p{M}]{2,}(?:[ \u00a0]+[\p{Lu}][\p{Ll}\p{M}]{2,}){1,2}/u.source,
  /[0-9]+(?:[.,][0-9]+)?[ \u00a0]+(?:kg|g|km|cm|mm|m|°C|°F|%)/u.source,
];
function literalPattern(value:string){
  return value.replace(/[.*+?^$()|{}[\]\\]/g,"\\$&").replace(/\s+/g,"[\\s\\u00a0]+");
}
export function getProtectedTextSpans(raw:string,terms:readonly string[]=[]):ProtectedTextSpan[]{
  const normalized=projectSemanticProseText(raw);
  const explicit=[...new Set(terms.map(x=>x.trim()).filter(x=>x.length>=2&&x.length<=80))]
    .sort((a,b)=>b.length-a.length).slice(0,60).map(literalPattern);
  const pattern=[...explicit,...autoPatterns].join("|");
  const regex=new RegExp("(?<![\\p{L}\\p{N}])(?:"+pattern+")(?![\\p{L}\\p{N}])","giu");
  const matches=[...normalized.matchAll(regex)]
    .map(m=>({start:m.index,end:m.index+m[0].length}));
  matches.sort((a,b)=>a.start-b.start||b.end-a.end);
  const merged:ProtectedTextSpan[]=[];
  for(const hit of matches){
    const previous=merged.at(-1);
    if(previous&&hit.start<previous.end)previous.end=Math.max(previous.end,hit.end);
    else merged.push({...hit});
  }
  return merged;
}
export function isProtectedTextBoundary(raw:string,offset:number,terms:readonly string[]=[]):boolean{
  return getProtectedTextSpans(raw,terms).some(span=>span.start<offset&&offset<span.end);
}
