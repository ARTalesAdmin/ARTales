import {projectSemanticProseText} from "@/lib/semantic/displayText";

/** Rendering-only line-grouping. Every source character is preserved verbatim. */
export default function ProtectedProseText({raw,terms=[]}:{raw:string;terms?:readonly string[]}){
 const text=projectSemanticProseText(raw);
 const clean=[...new Set(terms.filter(t=>t.length>=2&&t.length<=80))]
  .sort((a,b)=>b.length-a.length).slice(0,60);
 const escaped=clean.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
 // The semantic renderer handles common nonbreaking language constructs globally,
 // rather than asking each editor to maintain per-title typographic rules.
 const automatic=[
  "(?:Mr|Mrs|Ms|Dr|Prof|Sir|Lady|St)\\.?[ \\u00A0]+[\\p{Lu}][\\p{L}\\p{M}]+",
  "(?:[\\p{Lu}]\\.[ \\u00A0]*){1,3}[\\p{Lu}][\\p{L}\\p{M}]+",
  "[0-9]+(?:[.,][0-9]+)?[ \\u00A0]+(?:kg|g|km|cm|mm|m|°C|°F|%)"
 ];
 const patterns=[...escaped,...automatic];
 const regex=new RegExp("(?<![\\p{L}\\p{N}])(?:"+patterns.join("|")+
  ")(?![\\p{L}\\p{N}])","giu");
 const output:React.ReactNode[]=[];
 let start=0,match:RegExpExecArray|null;
 while((match=regex.exec(text))!==null){
  if(match.index>start)output.push(text.slice(start,match.index));
  output.push(<span key={match.index} style={{whiteSpace:"nowrap"}}
   data-work-protected-term={match[0]}>{match[0]}</span>);
  start=match.index+match[0].length;
 }
 if(start<text.length)output.push(text.slice(start));
 return <>{output}</>;
}
