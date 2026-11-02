import type {SemanticRevision,SemanticNode,SemanticAtom} from "@/lib/semantic/model";
import {projectSemanticProseText} from "@/lib/semantic/displayText";
function atom(a:SemanticAtom){return projectSemanticProseText(a.raw);}
function node(n:SemanticNode):React.ReactNode{
 if(n.kind==="chapter"||n.kind==="section")return <section key={n.id} style={{marginBlock:"2.5rem"}}>
  {n.kind==="chapter"?<h2>{atom(n.heading)}</h2>:<h3>{atom(n.heading)}</h3>}
  {n.children.map(node)}
 </section>;
 if(n.kind==="poem")return <figure key={n.id} style={{whiteSpace:"pre-wrap"}}>
  {n.stanzas.map(s=><div key={s.id} style={{marginBottom:"1em"}}>{s.lines.map(l=><div key={l.atom.id}>{atom(l.atom)}</div>)}</div>)}
 </figure>;
 if(n.kind==="quote"||n.kind==="epigraph")return <blockquote key={n.id}>{atom(n.atom)}</blockquote>;
 if(n.kind==="footnote")return <aside key={n.id} role="note"><sup>{n.footnote_label??"*"}</sup>{atom(n.atom)}</aside>;
 if(!("atom" in n))return null;
 return <p key={n.id} style={{whiteSpace:"pre-wrap",lineHeight:1.8,marginBlock:"1em"}}>{atom(n.atom)}</p>;
}
export default function SemanticPublicReader({revision,title,isPreview}:{
 revision:SemanticRevision;title:string;isPreview:boolean
}){
 const blocks=isPreview?revision.blocks.slice(0,Math.min(4,revision.blocks.length)):revision.blocks;
 return <article style={{maxWidth:780,margin:"0 auto",padding:"36px 24px",fontFamily:"Georgia,serif",fontSize:"1.15rem",lineHeight:1.8}}>
  <h1>{title}</h1>
  {blocks.map(node)}
  {isPreview?<p><em>Ukázka díla. Plný text je dostupný v režimu čtení.</em></p>:null}
 </article>;
}
