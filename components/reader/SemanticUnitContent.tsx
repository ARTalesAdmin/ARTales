import type {CSSProperties,ReactNode} from "react";
import type {
 SemanticAtom,SemanticBlockPresentation,SemanticPageUnit,SemanticNode,SemanticPoem
} from "@/lib/semantic/model";
import ProtectedProseText from "@/components/reader/ProtectedProseText";

/** Canonical, source-preserving semantic display. Shared by editor QA and public reader.
 * Pagination and reader preferences are external. This component NEVER edits raw atoms.
 */
export function semanticPresentationStyle(p?:SemanticBlockPresentation):CSSProperties|undefined{
 if(!p)return undefined;
 const spaces={none:"0",normal:"1em",generous:"2.5em"};
 const indents={none:"0",small:"1em",medium:"2em",large:"3em"};
 return {textAlign:p.align,marginBlockStart:spaces[p.space_before],
  marginBlockEnd:spaces[p.space_after],paddingInlineStart:indents[p.indent]};
}
function atomView(atom:SemanticAtom,prose:boolean,terms:readonly string[]):ReactNode{
 const italic=atom.marks.some(x=>x.kind==="italic");
 const bold=atom.marks.some(x=>x.kind==="bold");
 return <span data-atom-id={atom.id} data-source-start={atom.anchor.normalized_start}
  data-source-end={atom.anchor.normalized_end} className="semantic-reader__atom"
  style={{fontStyle:italic?"italic":undefined,fontWeight:bold?700:undefined,
   marginInlineStart:atom.marks.some(x=>x.kind==="indent")?"1.3em":undefined}}>
  {prose?<ProtectedProseText raw={atom.raw} terms={terms}/>:atom.raw}
 </span>;
}
function poemView(node:SemanticPoem):ReactNode{
 return <figure className={"semantic-reader__poem semantic-reader__poem--"+node.layout}
  data-semantic-id={node.id}>
  {node.stanzas.map(s=><div className="semantic-reader__stanza" key={s.id}>
   {s.lines.map(line=><div key={line.atom.id} className="semantic-reader__verse">
    {atomView(line.atom,false,[])}
   </div>)}
  </div>)}
 </figure>;
}
function semanticNodeView(node:SemanticNode,terms:readonly string[]):ReactNode{
 if(node.kind==="chapter"||node.kind==="section")
  return <section key={node.id} data-semantic-id={node.id}
   style={semanticPresentationStyle(node.presentation)}>
   {node.kind==="chapter"?<h2>{atomView(node.heading,false,terms)}</h2>
     :<h3>{atomView(node.heading,false,terms)}</h3>}
   {node.children.map(child=>semanticNodeView(child,terms))}
  </section>;
 if(node.kind==="poem")
  return <div key={node.id} style={semanticPresentationStyle(node.presentation)}>
   {poemView(node)}
  </div>;
 if(!("atom" in node))return null;
 const body=atomView(node.atom,true,terms);
 if(node.kind==="quote"||node.kind==="epigraph")
  return <blockquote key={node.id} style={semanticPresentationStyle(node.presentation)}>{body}</blockquote>;
 if(node.kind==="footnote")
  return <aside key={node.id} role="note" style={semanticPresentationStyle(node.presentation)}>
   <sup>{node.footnote_label??"*"}</sup>{body}
  </aside>;
 return <p key={node.id} data-semantic-id={node.id}
  style={semanticPresentationStyle(node.presentation)}>{body}</p>;
}
/** The editor's measurement and actual page, and the public reader, all use this. */
export default function SemanticUnitContent({unit,protectedTerms=[]}:{
 unit:SemanticPageUnit;protectedTerms?:readonly string[]
}):ReactNode{
 if(unit.fragment&&unit.node.kind==="paragraph"){
  const {start,end}=unit.fragment;
  const atom=unit.node.atom;
  return <p data-semantic-id={unit.node.id} data-source-atom={atom.id}
   data-fragment-start={start} data-fragment-end={end}
   className={"semantic-reader__fragment"+
    (unit.fragment.continuation_before?" semantic-reader__fragment--continued":"")}
   style={semanticPresentationStyle(unit.node.presentation)}>
   <span className="semantic-reader__atom" data-atom-id={atom.id}>
    <ProtectedProseText raw={atom.raw.slice(start,end)} terms={protectedTerms}/>
   </span>
  </p>;
 }
 if(unit.kind==="title_page"&&unit.node.kind==="title_page")
  return <div className="semantic-reader__title-page">
   <span className="semantic-reader__brand">{unit.node.brand}</span>
   <h2>{unit.node.title}</h2><p>{unit.node.authors.join(" · ")}</p>
   {unit.node.edition_note&&<small>{unit.node.edition_note}</small>}
  </div>;
 if((unit.kind==="chapter_heading"||unit.kind==="section_heading")&&
  (unit.node.kind==="chapter"||unit.node.kind==="section"))
  return <div className="semantic-reader__heading"
   style={semanticPresentationStyle(unit.node.presentation)}>
   {unit.kind==="chapter_heading"
    ?<h3>{atomView(unit.node.heading,false,protectedTerms)}</h3>
    :<h4>{atomView(unit.node.heading,false,protectedTerms)}</h4>}
  </div>;
 if(unit.node.kind==="chapter"||unit.node.kind==="section"||unit.node.kind==="title_page")
  return null;
 return semanticNodeView(unit.node,protectedTerms);
}
