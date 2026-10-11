"use client";
import {useMemo,useState, type CSSProperties} from "react";
import {projectSemanticProseText} from "@/lib/semantic/displayText";
import type {SemanticRevision,SemanticNode,SemanticAtom,SemanticPoem} from "@/lib/semantic/model";
import {projectSemanticReader,verifyReaderProjection} from "@/lib/semantic/readerProjection";
import "./semantic-reader.css";

type Props={revision:SemanticRevision;original:string;legacySynthetic:string};
function inline(atom:SemanticAtom, prose=false){
  // Raw text is deliberately rendered through React escaped text, never as HTML.
  const italic=atom.marks.some(x=>x.kind==="italic");
  const bold=atom.marks.some(x=>x.kind==="bold");
  return <span data-atom-id={atom.id} data-source-start={atom.anchor.normalized_start}
    data-source-end={atom.anchor.normalized_end} className="semantic-reader__atom"
    style={{fontStyle:italic?"italic":undefined,fontWeight:bold?700:undefined,
      marginInlineStart:atom.marks.some(x=>x.kind==="indent")?"1.3em":undefined}}>{prose?projectSemanticProseText(atom.raw):atom.raw}</span>;
}
function poem(node:SemanticPoem){
 return <figure className={"semantic-reader__poem semantic-reader__poem--"+node.layout}
   data-semantic-id={node.id}>{node.stanzas.map(s=><div className="semantic-reader__stanza" key={s.id}>
   {s.lines.map(line=><div key={line.atom.id} className="semantic-reader__verse">{inline(line.atom)}</div>)}
 </div>)}</figure>;
}
function nodeView(n:SemanticNode):React.ReactNode{
 if(n.kind==="chapter"||n.kind==="section")return <section key={n.id} data-semantic-id={n.id}>
   {n.kind==="chapter"?<h2>{inline(n.heading)}</h2>:<h3>{inline(n.heading)}</h3>}
   {n.children.map(nodeView)}</section>;
 if(n.kind==="poem")return <div key={n.id}>{poem(n)}</div>;
 if(!("atom" in n))return null;
 const body=inline(n.atom,true);
 if(n.kind==="quote"||n.kind==="epigraph")return <blockquote key={n.id}>{body}</blockquote>;
 if(n.kind==="footnote")return <aside key={n.id} role="note"><sup>{n.footnote_label??"*"}</sup>{body}</aside>;
 return <p key={n.id} data-semantic-id={n.id}>{body}</p>;
}
export default function SemanticReaderLab({revision,original,legacySynthetic}:Props){
 const [mode,setMode]=useState<"paged"|"spread"|"scroll">("paged");
 const [scale,setScale]=useState(1);
 const [width,setWidth]=useState(900);
 const [focus,setFocus]=useState(false);
 const pages=useMemo(()=>projectSemanticReader(revision,{mode,viewport_width:width,viewport_height:850,font_scale:scale}),[revision,mode,scale,width]);
 const integrity=verifyReaderProjection(revision,pages);
 return <main className="semantic-reader">
   <header><h1>ARTales · Sémantický Reader v2 (QA)</h1>
    <p>Textová zkouška, nikoli veřejná publikace. Legacy sloupec je výhradně syntetický.</p>
    <div className="semantic-reader__controls">
      <label>Režim <select value={mode} onChange={e=>setMode(e.target.value as typeof mode)}>
       <option value="paged">Stránky</option><option value="spread">Dvoustrany</option><option value="scroll">Plynulý text</option></select></label>
      <label>Velikost <input aria-label="Velikost textu" type="range" min="0.85" max="1.3" step="0.05" value={scale} onChange={e=>setScale(Number(e.target.value))}/></label>
      <label>Test viewportu <select value={width} onChange={e=>setWidth(Number(e.target.value))}>
       <option value={360}>Mobil 360</option><option value={768}>Tablet 768</option><option value={900}>Desktop 900</option></select></label>
      <label><input type="checkbox" checked={focus} onChange={e=>setFocus(e.target.checked)}/> Samostatná čtečka</label>
      <span role="status">{integrity.ok?"QA: zachováno pořadí jednotek":"QA selhala"} · {pages.length} stránek</span>
    </div>
   </header>
   <div className={"semantic-reader__triptych"+(focus?" semantic-reader__triptych--focus":"")}>
    {!focus&&<section aria-label="Archivní Gutenberg"><h2>Gutenberg #11 · originál</h2>
     <pre className="semantic-reader__original">{original}</pre></section>}
    {!focus&&<section aria-label="Syntetické legacy srovnání"><h2>ARTales legacy · pouze simulace</h2>
     <p>Skutečný produkční snapshot Alice zatím nebyl bezpečně převzat. Srovnání záměrně není prohlášeno za ověřené.</p>
     <pre className="semantic-reader__original">{legacySynthetic}</pre></section>}
    <section aria-label="Nová sémantická revize"><h2>ARTales · sémantická kompozice</h2>
     <div className="semantic-reader__viewport" style={{width:focus?width:"100%",maxWidth:"100%",["--reader-scale" as string]:scale} as CSSProperties} data-target-width={width} data-focused={focus}>
     <div className={"semantic-reader__pages semantic-reader__pages--"+mode}>
     {pages.map(page=><article className="semantic-reader__page" key={page.index} data-overflow={page.overflow}>
       {page.units.map(u=>u.kind==="chapter_heading"||u.kind==="section_heading"?
        <div key={u.id}>{u.kind==="chapter_heading"?<h3>{inline((u.node as Extract<SemanticNode,{kind:"chapter"|"section"}>).heading)}</h3>:
          <h4>{inline((u.node as Extract<SemanticNode,{kind:"chapter"|"section"}>).heading)}</h4>}</div>:
        <div key={u.id}>{u.node.kind==="chapter"||u.node.kind==="section"?null:nodeView(u.node)}</div>)}
       <footer>QA strana {page.index+1}{page.overflow==="scroll_unit"?" · dlouhý celek, bez rozdělení":""}</footer>
     </article>)}
     </div>
     </div>
    </section>
   </div>
 </main>;
}
