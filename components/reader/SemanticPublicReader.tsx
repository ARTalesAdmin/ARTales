import type {SemanticRevision,SemanticNode,SemanticAtom} from "@/lib/semantic/model";
import ProtectedProseText from "@/components/reader/ProtectedProseText";
import {selectEditorialEdition} from "@/lib/semantic/editionProjection";
export type ApprovedSemanticImage={anchor_atom_id:string;storage_path:string;caption:string;sha256:string};
function safeUrl(path:string){
 if(!/^works\/[a-f0-9-]{36}\/inline\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(path))return null;
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!base||!/^https:\/\//.test(base))return null;
 return base.replace(/\/$/,"")+"/storage/v1/object/public/artales-images/"+
 path.split("/").map(encodeURIComponent).join("/");
}
export default function SemanticPublicReader({revision,title,isPreview,visuals=[],protectedTerms=[]}:{
 revision:SemanticRevision;title:string;isPreview:boolean;visuals?:ApprovedSemanticImage[];
 protectedTerms?:string[];
}){
 const atom=(a:SemanticAtom)=><ProtectedProseText raw={a.raw} terms={protectedTerms}/>;
 const images=new Map<string,ApprovedSemanticImage[]>();
 for(const image of visuals){
  const list=images.get(image.anchor_atom_id)??[];
  list.push(image);images.set(image.anchor_atom_id,list);
 }
 const illustrations=(anchorId:string)=>{
  const matched=images.get(anchorId)??[];
  return matched.map(item=>{
   const url=safeUrl(item.storage_path);
   if(!url)return null;
   return <figure key={item.storage_path} style={{margin:"2rem auto",maxWidth:680,textAlign:"center"}}>
    {/* eslint-disable-next-line @next/next/no-img-element -- immutable public Storage image, reviewed externally */}
    <img src={url} alt={item.caption||"Ilustrace díla"} loading="lazy" style={{maxWidth:"100%",height:"auto"}}/>
    {item.caption?<figcaption>{item.caption}</figcaption>:null}
   </figure>;
  });
 };
 const node=(n:SemanticNode):React.ReactNode=>{
  if(n.kind==="chapter"||n.kind==="section")return <section key={n.id} style={{marginBlock:"2.5rem"}}>
   {n.kind==="chapter"?<h2>{atom(n.heading)}</h2>:<h3>{atom(n.heading)}</h3>}
   {illustrations(n.heading.id)}
   {n.children.map(node)}
  </section>;
  if(n.kind==="poem")return <figure key={n.id} style={{whiteSpace:"pre-wrap"}}>
   {n.stanzas.map(s=><div key={s.id} style={{marginBottom:"1em"}}>{s.lines.map(l=>
    <div key={l.atom.id}>{atom(l.atom)}{illustrations(l.atom.id)}</div>)}</div>)}
  </figure>;
  if(!("atom" in n))return null;
  const body=n.kind==="quote"||n.kind==="epigraph"
   ?<blockquote>{atom(n.atom)}</blockquote>
   :n.kind==="footnote"
    ?<aside role="note"><sup>{n.footnote_label??"*"}</sup>{atom(n.atom)}</aside>
    :<p style={{whiteSpace:"pre-wrap",lineHeight:1.8,marginBlock:"1em"}}>{atom(n.atom)}</p>;
  return <div key={n.id}>{body}{illustrations(n.atom.id)}</div>;
 };
 const range=selectEditorialEdition(revision.source.normalized_text).range;
 const within=(n:SemanticNode):SemanticNode|null=>{
   if(n.kind==="chapter"||n.kind==="section"){
     const start=n.heading.anchor.normalized_start,end=n.heading.anchor.normalized_end;
     const children=n.children.map(within).filter((v):v is SemanticNode=>v!==null);
     if(start>=range.start&&end<=range.end)return {...n,children};
     if(children.length)throw Error("Editorial boundary intersects a chapter heading.");
     return null;
   }
   if(n.kind==="poem"){
     const atoms=n.stanzas.flatMap(s=>s.lines.map(l=>l.atom));
     if(!atoms.length)return null;
     if(atoms[0].anchor.normalized_start>=range.start&&
        atoms.at(-1)!.anchor.normalized_end<=range.end)return n;
     return null;
   }
   if(!("atom" in n))return null;
   const start=n.atom.anchor.normalized_start,end=n.atom.anchor.normalized_end;
   if(start<range.end&&end>range.start&&(start<range.start||end>range.end))
     throw Error("Editorial boundary intersects an atom.");
   return start>=range.start&&end<=range.end?n:null;
 };
 const excluded=new Set(revision.editorial_exclusions??[]);
 const withoutExclusions=(n:SemanticNode):SemanticNode|null=>{
   if(n.kind==="chapter"||n.kind==="section")
    return {...n,children:n.children.map(withoutExclusions).filter((v):v is SemanticNode=>v!==null)};
   if(n.kind==="poem")return n;
   return "atom" in n&&excluded.has(n.atom.id)?null:n;
 };
 const approvedBlocks=revision.blocks.map(within).filter((v):v is SemanticNode=>v!==null).map(withoutExclusions).filter((v):v is SemanticNode=>v!==null);
 const blocks=isPreview?approvedBlocks.slice(0,Math.min(4,approvedBlocks.length)):approvedBlocks;
 return <article style={{maxWidth:780,margin:"0 auto",padding:"36px 24px",fontFamily:"Georgia,serif",fontSize:"1.15rem",lineHeight:1.8}}>
  <h1>{title}</h1>
  {blocks.map(node)}
  {isPreview?<p><em>Ukázka díla. Plný text je dostupný v režimu čtení.</em></p>:null}
 </article>;
}
