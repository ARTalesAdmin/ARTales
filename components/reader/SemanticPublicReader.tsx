import type {SemanticRevision,SemanticNode,SemanticAtom} from "@/lib/semantic/model";
import {projectSemanticProseText} from "@/lib/semantic/displayText";
export type ApprovedSemanticImage={anchor_atom_id:string;storage_path:string;caption:string;sha256:string};
const atom=(a:SemanticAtom)=>projectSemanticProseText(a.raw);
function safeUrl(path:string){
 if(!/^works\/[a-f0-9-]{36}\/inline\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(path))return null;
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!base||!/^https:\/\//.test(base))return null;
 return base.replace(/\/$/,"")+"/storage/v1/object/public/artales-images/"+
 path.split("/").map(encodeURIComponent).join("/");
}
export default function SemanticPublicReader({revision,title,isPreview,visuals=[]}:{
 revision:SemanticRevision;title:string;isPreview:boolean;visuals?:ApprovedSemanticImage[]
}){
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
 const blocks=isPreview?revision.blocks.slice(0,Math.min(4,revision.blocks.length)):revision.blocks;
 return <article style={{maxWidth:780,margin:"0 auto",padding:"36px 24px",fontFamily:"Georgia,serif",fontSize:"1.15rem",lineHeight:1.8}}>
  <h1>{title}</h1>
  {blocks.map(node)}
  {isPreview?<p><em>Ukázka díla. Plný text je dostupný v režimu čtení.</em></p>:null}
 </article>;
}
