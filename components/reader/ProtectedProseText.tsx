import {projectSemanticProseText} from "@/lib/semantic/displayText";
/** Rendering-only nonbreaking work-level terms, never mutate source bytes or hashes. */
export default function ProtectedProseText({raw,terms=[]}:{raw:string;terms?:readonly string[]}){
 const text=projectSemanticProseText(raw);
 const clean=[...new Set(terms.filter(t=>t.length>=2&&t.length<=80))]
  .sort((a,b)=>b.length-a.length).slice(0,60);
 if(!clean.length)return <>{text}</>;
 const escaped=clean.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
 const regex=new RegExp("(?<![\\p{L}\\p{N}])(?:"+escaped.join("|")+
  ")(?![\\p{L}\\p{N}])","giu");
 const output:React.ReactNode[]=[];let start=0,match:RegExpExecArray|null;
 while((match=regex.exec(text))!==null){
  if(match.index>start)output.push(text.slice(start,match.index));
  output.push(<span key={match.index} style={{whiteSpace:"nowrap"}} data-work-protected-term={match[0]}>
   {match[0]}</span>);
  start=match.index+match[0].length;
 }
 output.push(text.slice(start));
 return <>{output}</>;
}
