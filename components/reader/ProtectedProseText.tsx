import {segmentSemanticProse} from "@/lib/semantic/protectedSpans";

/** The rendered protection segments are also consumed by DOM measurement. */
export default function ProtectedProseText({raw,terms=[]}:{raw:string;terms?:readonly string[]}){
 const output:React.ReactNode[]=[];
 for(const [index,segment] of segmentSemanticProse(raw,terms).entries()){
  if(!segment.protected){output.push(segment.text);continue;}
  output.push(<span key={index} style={{whiteSpace:"nowrap"}}
   data-work-protected-term={segment.text}>{segment.text}</span>);
 }
 return <>{output}</>;
}
