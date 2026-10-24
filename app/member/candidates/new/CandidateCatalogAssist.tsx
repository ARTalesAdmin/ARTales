"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = { key:string; title:string; author:string; firstPublished:number|null; sourceUrl:string };
export default function CandidateCatalogAssist() {
  const [query,setQuery]=useState("");
  const [items,setItems]=useState<Suggestion[]>([]);
  const [state,setState]=useState<"idle"|"loading"|"ready"|"error">("idle");
  const [selected,setSelected]=useState<string|null>(null);
  const ctrl=useRef<AbortController|null>(null);
  useEffect(()=>{
    ctrl.current?.abort();
    if(query.trim().length<3){setItems([]);setState("idle");return;}
    const ac=new AbortController();ctrl.current=ac;
    const timer=setTimeout(async()=>{
      setState("loading");
      try {
        const resp=await fetch("/member/candidates/catalog?q="+encodeURIComponent(query.trim()),{signal:ac.signal,cache:"no-store"});
        if(!resp.ok)throw new Error("catalog_failed");
        const payload=await resp.json() as {items:Suggestion[]};
        setItems(payload.items??[]);setState("ready");
      }catch(e){if(!ac.signal.aborted){setItems([]);setState("error");}}
    },350);
    return()=>{clearTimeout(timer);ac.abort();};
  },[query]);
  return <section className="ca-card ca-form" aria-label="Volitelné bibliografické vyhledání">
    <h2>Pomoc s vyplněním</h2>
    <p className="ca-hint">Volitelné hledání v Open Library. Záznam je pouze bibliografický námět, nikoli schválená edice nebo kontrola práv.</p>
    <label>Najít podle názvu<input type="search" value={query} minLength={3} maxLength={120} onChange={e=>{setQuery(e.target.value);setSelected(null);}} placeholder="Zadej alespoň 3 znaky" autoComplete="off"/></label>
    {state==="loading"?<p role="status">Hledám v katalogu…</p>:null}
    {state==="error"?<p role="status">Katalog není dostupný. Kandidáta můžeš založit ručně.</p>:null}
    {state==="ready"&&!items.length?<p role="status">Bez nalezených výsledků. Pokračuj ručně.</p>:null}
    {state==="ready"&&items.length?<div className="ca-suggestions" aria-label="Bibliografické výsledky">{items.map(item=><button key={item.key} type="button" className="ca-suggestion" aria-pressed={selected===item.key} onClick={()=>{
      const title=document.querySelector<HTMLInputElement>('#candidate-title');
      const author=document.querySelector<HTMLInputElement>('#candidate-author');
      const reference=document.querySelector<HTMLInputElement>('#candidate-reference');
      if(title)title.value=item.title;
      if(author)author.value=item.author;
      if(reference)reference.value=item.sourceUrl;
      setSelected(item.key);
    }}><strong>{item.title}</strong><span>{item.author}{item.firstPublished?" · "+item.firstPublished:""}</span></button>)}</div>:null}
  </section>;
}
