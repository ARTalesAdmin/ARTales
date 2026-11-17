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
  // Keep editorial phrases case-insensitive but auto-detect capitalized
  // proper names CASE-SENSITIVELY. A global 'i' flag causes \p{Lu} to
  // match lowercase words and incorrectly protects prose such as "met Mr".
  const bounded=(pattern:string)=>"(?<![\\p{L}\\p{N}])(?:"+pattern+")(?![\\p{L}\\p{N}])";
  const matches=[
    ...(explicit.length?[...normalized.matchAll(new RegExp(bounded(explicit.join("|")),"giu"))]:[]),
    ...normalized.matchAll(new RegExp(bounded(autoPatterns.join("|")),"gu")),
  ].map(m=>({start:m.index,end:m.index+m[0].length}));
  matches.sort((a,b)=>a.start-b.start||b.end-a.end);
  const merged:ProtectedTextSpan[]=[];
  for(const hit of matches){
    const previous=merged.at(-1);
    if(previous&&hit.start<previous.end)previous.end=Math.max(previous.end,hit.end);
    else merged.push({...hit});
  }
  return merged;
}
/** Single segmentation policy for both React output and Chromium measurement.
 * Protection changes only wrapping; the concatenated text remains source-identical.
 */
export type SemanticProseSegment={text:string;protected:boolean};
export function segmentSemanticProse(raw:string,terms:readonly string[]=[]):SemanticProseSegment[]{
 const text=projectSemanticProseText(raw);
 const spans=getProtectedTextSpans(raw,terms);
 const output:SemanticProseSegment[]=[];
 let cursor=0;
 for(const span of spans){
  if(span.start>cursor)output.push({text:text.slice(cursor,span.start),protected:false});
  output.push({text:text.slice(span.start,span.end),protected:true});
  cursor=span.end;
 }
 if(cursor<text.length)output.push({text:text.slice(cursor),protected:false});
 return output;
}
export function isProtectedTextBoundary(raw:string,offset:number,terms:readonly string[]=[]):boolean{
  return getProtectedTextSpans(raw,terms).some(span=>span.start<offset&&offset<span.end);
}
