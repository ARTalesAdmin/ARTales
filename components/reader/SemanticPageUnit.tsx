import type {CSSProperties,ReactNode} from "react";
import ProtectedProseText from "@/components/reader/ProtectedProseText";
import SemanticEditionTitlePage from "@/components/reader/SemanticEditionTitlePage";
import type {SemanticNode,SemanticAtom,SemanticPoem,SemanticBlockPresentation,SemanticPageUnit} from "@/lib/semantic/model";

// Source-preserving rendering shared between editorial QA and the published Reader.
// Never change this markup in just one reader surface.
function inline(atom:SemanticAtom, prose=false,protectedTerms:readonly string[]=[]) {
  const italic=atom.marks.some(x=>x.kind==="italic");
  const bold=atom.marks.some(x=>x.kind==="bold");
  return <span data-atom-id={atom.id} data-source-start={atom.anchor.normalized_start}
    data-source-end={atom.anchor.normalized_end} className="semantic-reader__atom"
    style={{fontStyle:italic?"italic":undefined,fontWeight:bold?700:undefined,
      marginInlineStart:atom.marks.some(x=>x.kind==="indent")?"1.3em":undefined}}>
    {prose?<ProtectedProseText raw={atom.raw} terms={protectedTerms}/>:atom.raw}
  </span>;
}
function presentationStyle(p?:SemanticBlockPresentation):CSSProperties|undefined {
  if(!p)return undefined;
  const spaces={none:"0",normal:"1em",generous:"2.5em"};
  const indents={none:"0",small:"1em",medium:"2em",large:"3em"};
  return {textAlign:p.align,marginBlockStart:spaces[p.space_before],
    marginBlockEnd:spaces[p.space_after],paddingInlineStart:indents[p.indent]};
}
function poem(node:SemanticPoem) {
  return <figure className={"semantic-reader__poem semantic-reader__poem--"+node.layout}
    data-semantic-id={node.id}>{node.stanzas.map(s=><div className="semantic-reader__stanza" key={s.id}>
      {s.lines.map(line=><div key={line.atom.id} className="semantic-reader__verse">{inline(line.atom)}</div>)}
    </div>)}</figure>;
}
function nodeView(n:SemanticNode,terms:readonly string[]=[]):ReactNode {
  if(n.kind==="chapter"||n.kind==="section")return <section key={n.id} data-semantic-id={n.id}
    style={presentationStyle(n.presentation)}>
    {n.kind==="chapter"?<h2>{inline(n.heading)}</h2>:<h3>{inline(n.heading)}</h3>}
    {n.children.map(child=>nodeView(child,terms))}</section>;
  if(n.kind==="poem")return <div key={n.id} style={presentationStyle(n.presentation)}>{poem(n)}</div>;
  if(!("atom" in n))return null;
  const body=inline(n.atom,true,terms);
  if(n.kind==="quote"||n.kind==="epigraph")return <blockquote key={n.id}
    style={presentationStyle(n.presentation)}>{body}</blockquote>;
  if(n.kind==="footnote")return <aside key={n.id} role="note"
    style={presentationStyle(n.presentation)}><sup>{n.footnote_label??"*"}</sup>{body}</aside>;
  return <p key={n.id} data-semantic-id={n.id} style={presentationStyle(n.presentation)}>{body}</p>;
}
/** The same markup is used both on the visible page and in the offscreen measuring page. */
function coreUnitView(u:SemanticPageUnit,terms:readonly string[]=[]):ReactNode {
  if(u.fragment&&"atom" in u.node){
    const {start,end}=u.fragment;
    const original=u.node.atom;
    // This is a layout-only range; the exact source atom remains immutable.
    const body=<span className="semantic-reader__atom" data-atom-id={original.id}>
      <ProtectedProseText raw={original.raw.slice(start,end)} terms={terms}/>
    </span>;
    const cls="semantic-reader__fragment"+
      (u.fragment.continuation_before?" semantic-reader__fragment--continued":"");
    const props={
      "data-semantic-id":u.node.id,
      "data-source-atom":original.id,
      "data-fragment-start":start,
      "data-fragment-end":end,
      className:cls,
      style:presentationStyle(u.node.presentation),
    };
    if(u.kind==="quote"||u.kind==="epigraph")return <blockquote {...props}>{body}</blockquote>;
    if(u.kind==="footnote")return <aside {...props} role="note">
      {!u.fragment.continuation_before?<sup>{u.node.footnote_label??"*"}</sup>:null}
      {body}
    </aside>;
    return <p {...props}>{body}</p>;
  }
  if(u.kind==="title_page"&&u.node.kind==="title_page"){
    return <div className="semantic-reader__title-page">
      <SemanticEditionTitlePage title={u.node.title} author={u.node.authors.join(" · ")}/>
    </div>;
  }
  if((u.kind==="chapter_heading"||u.kind==="section_heading")&&
    (u.node.kind==="chapter"||u.node.kind==="section")){
    return <div className="semantic-reader__heading" style={presentationStyle(u.node.presentation)}>
      {u.kind==="chapter_heading"?<h3>{inline(u.node.heading)}</h3>:<h4>{inline(u.node.heading)}</h4>}
    </div>;
  }
  if(u.node.kind==="chapter"||u.node.kind==="section"||u.node.kind==="title_page")return null;
  return nodeView(u.node,terms);
}

export type ApprovedSemanticImage={anchor_atom_id:string;storage_path:string;caption:string;sha256:string};
function publishedImageUrl(path:string){
 if(!/^works\/[a-f0-9-]{36}\/inline\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(path))return null;
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!base||!/^https:\/\//.test(base))return null;
 return base.replace(/\/$/,"")+"/storage/v1/object/public/artales-images/"+
  path.split("/").map(encodeURIComponent).join("/");
}
export function unitView(u:SemanticPageUnit,terms:readonly string[]=[],visuals:readonly ApprovedSemanticImage[]=[]):ReactNode{
 const content=coreUnitView(u,terms);
 if(!visuals.length||!u.source_atom_ids.length)return content;
 const illustrations=visuals.filter(image=>u.source_atom_ids.includes(image.anchor_atom_id));
 if(!illustrations.length)return content;
 return <>{content}{illustrations.map((image)=>{
  const url=publishedImageUrl(image.storage_path);
  if(!url)return null;
  return <figure key={image.storage_path} className="semantic-reader__illustration">
   {/* eslint-disable-next-line @next/next/no-img-element -- reviewed public Storage asset */}
   <img src={url} alt={image.caption||"Ilustrace díla"} loading="lazy"/>
   {image.caption?<figcaption>{image.caption}</figcaption>:null}
  </figure>;
 })}</>;
}
