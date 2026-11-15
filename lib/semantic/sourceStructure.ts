/** Canonical, conservative source-structure assessment BEFORE semantic Compose.
 * Hints are bounded to immutable UTF-16 source offsets; they never rewrite the
 * source, invent content, or mutate an already sealed/published revision.
 * Markup evidence wins over typography; ambiguity is surfaced for QA, not
 * silently turned into a chapter or a poem.
 */
import {selectEditorialEdition} from "./editionProjection";
import type {SemanticStructureHint} from "./compose";

export type StructureCue={
 kind:"chapter"|"section"|"poem";
 start:number;end:number;
 evidence:"xhtml-heading"|"xhtml-poetry";
};
export type StructureReviewSignal={
 start:number;end:number;
 kind:"possible_heading"|"possible_poem"|"conflicting_markup"|"edition_boundary_uncertain";
 reason:string;
};
export type StructureAssessment={
 hints:SemanticStructureHint[];
 reviewSignals:StructureReviewSignal[];
 editionRange:{start:number;end:number}|null;
};

type Paragraph={start:number;end:number;value:string};
function paragraphs(source:string,start:number,end:number):Paragraph[]{
 const result:Paragraph[]=[];
 const separators=/\n{2,}/g;
 separators.lastIndex=start;
 let cursor=start;
 const add=(to:number)=>{
  if(to<=cursor)return;
  const value=source.slice(cursor,to);
  if(value.trim())result.push({start:cursor,end:to,value});
 };
 for(let match=separators.exec(source);match&&match.index<end;match=separators.exec(source)){
  add(match.index);cursor=Math.min(end,match.index+match[0].length);
 }
 add(end);
 return result;
}
const roman=/^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)$/;
const explicit=/^(?:CHAPTER|BOOK|PART)\s+(?:[IVXLCDM]+|\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)(?:[.\s:—–-].*)?$/i;
const notTitle=/^(?:CONTENTS|TABLE OF CONTENTS|INDEX|PREFACE|INTRODUCTION|ACKNOWLEDGEMENTS?|THE END|FINIS|COPYRIGHT|PROJECT GUTENBERG|TRANSCRIBER.S? NOTES?|NOTES?)$/i;
const uppercase=/^[\p{Lu}\p{M}\p{N}][\p{Lu}\p{M}\p{N}\p{P}\p{Zs}'’—–-]{5,100}$/u;
function isStandaloneTitle(raw:string){
 const t=raw.trim();
 return t.length<=100 && uppercase.test(t)&& /[\p{L}]/u.test(t)&&
  !notTitle.test(t)&&!explicit.test(t)&&!/\n/.test(t);
}
function isProseAfter(p?:Paragraph){
 if(!p)return false;
 const value=p.value.trim();
 return value.length>=24 && !roman.test(value) && !isStandaloneTitle(value) &&
  !explicit.test(value);
}
function possiblePoetry(raw:string):boolean{
 const lines=raw.split("\n").map(s=>s.replace(/\s+$/,"")).filter(Boolean);
 if(lines.length<4||lines.length>80)return false;
 const length=lines.map(x=>x.trim().length);
 return length.every(n=>n>=5&&n<=67)&&
   length.reduce((a,b)=>a+b,0)/length.length<51;
}
export function assessSemanticSourceStructure(source:string,cues:readonly StructureCue[]=[]):StructureAssessment{
 let editionRange:{start:number;end:number}|null=null;
 const reviewSignals:StructureReviewSignal[]=[];
 try{editionRange=selectEditorialEdition(source).range;}
 catch{
  reviewSignals.push({start:0,end:Math.min(source.length,1),
   kind:"edition_boundary_uncertain",reason:"Unverified Gutenberg edition boundaries; no automatic semantic roles inferred."});
  return {hints:[],reviewSignals,editionRange:null};
 }
 const {start,end}=editionRange;
 const chosen:SemanticStructureHint[]=[];
 const overlaps=(a:number,b:number)=>chosen.some(h=>a<h.end&&b>h.start);
 // Retain only exact structural spans wholly inside the approved literary
 // range. XHTML and text never generate competing annotations for the same atom.
 for(const cue of [...cues].sort((a,b)=>a.start-b.start)){
  if(!Number.isSafeInteger(cue.start)||!Number.isSafeInteger(cue.end)||
    cue.start<start||cue.end>end||cue.end<=cue.start||!source.slice(cue.start,cue.end).trim())continue;
  if(overlaps(cue.start,cue.end)){
   reviewSignals.push({start:cue.start,end:cue.end,kind:"conflicting_markup",
    reason:"Conflicting structural XHTML cues; editor must resolve source nesting."});
   continue;
  }
  chosen.push({kind:cue.kind,start:cue.start,end:cue.end,
   evidence:{method:cue.evidence,confidence:"high"}});
 }
 const parts=paragraphs(source,start,end);
 for(let i=0;i<parts.length;i++){
  const p=parts[i],raw=p.value.trim(),next=parts[i+1],next2=parts[i+2];
  if(overlaps(p.start,p.end))continue;
  if(explicit.test(raw)){
   chosen.push({kind:"chapter",start:p.start,end:p.end,
    evidence:{method:"deterministic-text",confidence:"high"}});
   continue;
  }
  if(roman.test(raw) && next && isStandaloneTitle(next.value) &&
      isProseAfter(next2)&&!overlaps(next.start,next.end)){
   chosen.push({kind:"chapter",start:p.start,end:p.end,
    evidence:{method:"deterministic-text",confidence:"high"}});
   chosen.push({kind:"section",start:next.start,end:next.end,
    evidence:{method:"deterministic-text",confidence:"high"}});
   i++;continue;
  }
  // Uppercase unnumbered chapter titles require actual surrounding literary
  // prose. Not every uppercase word, caption or contents entry is a heading.
  if(isStandaloneTitle(raw)&&isProseAfter(next)){
   chosen.push({kind:"chapter",start:p.start,end:p.end,
    evidence:{method:"deterministic-text",confidence:"medium"}});
   continue;
  }
  if(possiblePoetry(p.value)){
   reviewSignals.push({start:p.start,end:p.end,kind:"possible_poem",
    reason:"Short hard-wrapped lines resemble verse, but XHTML does not prove poetry."});
  }
 }
 return {hints:chosen.sort((a,b)=>a.start-b.start),
  reviewSignals,editionRange};
}
