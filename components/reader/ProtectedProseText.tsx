import {projectSemanticProseText} from "@/lib/semantic/displayText";
import {getProtectedTextSpans} from "@/lib/semantic/protectedSpans";

/** Source-identical, responsive protection for every QA/public typographic setting. */
export default function ProtectedProseText({raw,terms=[]}:{raw:string;terms?:readonly string[]}){
 const text=projectSemanticProseText(raw);
 const spans=getProtectedTextSpans(raw,terms);
 const output:React.ReactNode[]=[];
 let position=0;
 for(const span of spans){
  if(span.start>position)output.push(text.slice(position,span.start));
  output.push(<span key={span.start} style={{whiteSpace:"nowrap"}}
   data-work-protected-term={text.slice(span.start,span.end)}>
   {text.slice(span.start,span.end)}
  </span>);
  position=span.end;
 }
 if(position<text.length)output.push(text.slice(position));
 return <>{output}</>;
}
