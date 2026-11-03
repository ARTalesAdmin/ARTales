/** Non-destructive editorial projection. The archived Gutenberg original and
 * immutable semantic revision (including source byte anchors) stay intact.
 * Only bounded, identified distribution apparatus is omitted from ARTales.
 */
export type EditionRange={start:number;end:number};
export type EditionSelection={
 range:EditionRange;
 method:"gutenberg-markers"|"gutenberg-markers-with-contents"|"source-unaltered";
 headerOmitted:boolean;footerOmitted:boolean;
 warnings:string[];
};
const escapeRegExp=(s:string)=>s.replace(/[.*+?^$\u007b\u007d()|[\]\\]/g,"\\$&");
function markerMatches(source:string,kind:"START"|"END"){
 const re=new RegExp("^\\*{3}\\s*"+kind+" OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\\n]*\\*{3}[ \\t]*$","gim");
 return [...source.matchAll(re)];
}
export function selectEditorialEdition(source:string):EditionSelection{
 const starts=markerMatches(source,"START"),ends=markerMatches(source,"END");
 if(!starts.length&&!ends.length){
  if(/project gutenberg eBook|project gutenberg license/i.test(source))
   throw Error("Gutenberg apparatus has no verifiable boundaries; editorial assessment required.");
  return {range:{start:0,end:source.length},method:"source-unaltered",
   headerOmitted:false,footerOmitted:false,warnings:[]};
 }
 if(starts.length!==1||ends.length!==1)
  throw Error("Missing or ambiguous Gutenberg apparatus boundary.");
 const first=starts[0],last=ends[0];
 let start=first.index!+first[0].length;
 const end=last.index!;
 if(start>=end)throw Error("Inverted Gutenberg source markers.");
 let method:EditionSelection["method"]="gutenberg-markers";
 // Remove the *electronic edition's* title/TOC only when its first entry
 // matches a subsequent, distinct literary chapter heading. Do not remove
 // author forewords, appendices or unnamed notes by speculative heuristics.
 const between=source.slice(start,end);
 const contents=/(?:^|\n)[ \t]*Contents[ \t]*(?:\n|$)/i.exec(between);
 if(contents){
  const afterContents=between.slice(contents.index+contents[0].length);
  const firstEntry=/^[ \t]*CHAPTER[ \t]+I[.:-][ \t]*([^\n]+)[ \t]*$/im.exec(afterContents);
  if(firstEntry){
   const chapter=firstEntry[1].trim();
   const pattern=new RegExp("(^|\\n)([ \\t]*I[ \\t]*\\n{2,}[ \\t]*"+
     escapeRegExp(chapter)+"[ \\t]*)(?=\\n)","m");
   const literary=pattern.exec(afterContents.slice(firstEntry.index+firstEntry[0].length));
   if(literary){
    start+=contents.index+contents[0].length+firstEntry.index+firstEntry[0].length+
     literary.index+literary[1].length;
    method="gutenberg-markers-with-contents";
   }
  }
 }
 const warnings:string[]=[];
 const tail=source.slice(Math.max(start,end-1800),end);
 const lastEnd=tail.search(/(?:^|\n)[ \t]*THE END[. ]*(?:\n|$)/im);
 if(lastEnd>=0 && /(?:^|\n)[ \t]*NOTE[.\u2014:\-]/im.test(tail.slice(lastEnd)))
  warnings.push("Poznámka za koncem příběhu: ověřit, zda je autorská; automaticky ponechána.");
 if(start>=end||!source.slice(start,end).trim())
  throw Error("Empty literary text after editorial clipping.");
 return {range:{start,end},method,headerOmitted:start>0,footerOmitted:end<source.length,warnings};
}

/** Review signal, not an auto-deletion. Edition-source note remains visible until
 * the editor explicitly excludes it in a new signed semantic revision. */
export function detectEditionReviewSignals(source:string,atoms:ReadonlyArray<{
 id:string;raw:string;anchor:{normalized_start:number;normalized_end:number}
}>,excluded:ReadonlyArray<string>=[]){
 const span=selectEditorialEdition(source).range;
 const endMarker=/\bTHE END\.?\s*$/gim;
 const matches=[...source.slice(span.start,span.end).matchAll(endMarker)];
 if(!matches.length)return [];
 const cutoff=span.start+matches.at(-1)!.index!+matches.at(-1)![0].length;
 return atoms.filter(a=>a.anchor.normalized_start>=cutoff&&
   a.anchor.normalized_end<=span.end&&!excluded.includes(a.id)&&
   /^\s*(?:NOTE[.\u2014: -]|TRANSCRIBER[\u2019'S ]+NOTE)/im.test(a.raw))
   .map(a=>({atomId:a.id,sourceStart:a.anchor.normalized_start,
    reason:"Sporná závěrečná ediční poznámka: editor určí, zda patří do vydání.",
    kind:"source_ambiguity" as const}));
}
