"use client";
import {useState} from "react";
import type {GutenbergBook,CatalogFile} from "@/lib/legal/gutenbergCatalog";
type Item={book:GutenbergBook;file:CatalogFile;verdict:"candidate"|"needs_review";reason:string};
function estimate(book:GutenbergBook,file:CatalogFile):Item{
 const known=book.authors.length===1&&book.authors[0].died!==null;
 const allAuthorTermsKnown=book.authors.length>0&&book.authors.every(p=>p.died!==null);
 const noTranslator=book.translators.length===0;
 const year=2026;
 const oldEnough=allAuthorTermsKnown&&book.authors.every(p=>(p.died??year)+70<year);
 const possible=oldEnough&&noTranslator;
 return {book,file,verdict:possible?"candidate":"needs_review",
 reason:possible?"Předběžně vyhovuje věk práv autora; ověř konkrétní vydání, případný překlad a podmínky zdroje.":!known?"Neúplná data autora nebo více autorů — lidské ověření.":!noTranslator?"Překlad vyžaduje samostatné právní prověření.":"Původní text vyžaduje další právní podklady."};
}
export function AutomaticLegalScreen({candidateId}:{candidateId:string}){
 const [state,setState]=useState<"idle"|"loading"|"done"|"error">("idle");
 const [items,setItems]=useState<Item[]>([]);
 const [catalogBooks,setCatalogBooks]=useState<GutenbergBook[]>([]);
 async function run(){
  setState("loading");
  try{
   const r=await fetch(`/member/candidates/${candidateId}/legal/catalog`,{cache:"no-store"});
   if(!r.ok)throw Error("catalog");
   const data=await r.json() as {items:GutenbergBook[]};
   setCatalogBooks(data.items);
   const scored=data.items.flatMap(book=>book.files.map(file=>estimate(book,file)));
   scored.sort((a,b)=>Number(b.verdict==="candidate")-Number(a.verdict==="candidate")||
    ({plain_text:0,html:1,epub:2}[a.file.format]-{plain_text:0,html:1,epub:2}[b.file.format])||b.book.id-a.book.id);
   setItems(scored);setState("done");
  }catch{setState("error")}
 }
 function choose(item:Item){
  const form=document.getElementById("legal-source-form");
  if(!(form instanceof HTMLFormElement))return;
  const put=(name:string,value:string)=>{
   const el=form.elements.namedItem(name);
   if(el instanceof HTMLInputElement||el instanceof HTMLSelectElement)el.value=value;
  };
  const {book,file}=item;
  put("source_kind","gutenberg");put("edition_title",book.title);
  put("source_url",book.catalogUrl);put("download_url",file.url);
  put("read_url",book.readUrl??"");put("language_code",book.languages[0]??"");
  put("author_died",book.authors.length===1&&book.authors[0].died?String(book.authors[0].died):"");
  put("translator",book.translators.map(p=>p.name).join("; "));
  put("translator_died",book.translators.length===1&&book.translators[0].died?String(book.translators[0].died):"");
  put("translation_status",book.translators.length?"translated":"unknown");
  put("text_format",file.format);put("evidence_url",book.catalogUrl);
  // Never derive final legal clearance from a catalog entry.
  put("original_rights","unknown");put("translation_rights","unknown");
  put("source_terms","unknown");put("identity_match","uncertain");
  put("language_match","uncertain");put("completeness","unknown");
  put("text_quality","unknown");
  const details=form.closest("details");if(details)details.open=true;
  form.scrollIntoView({behavior:"smooth",block:"start"});
 }
 return <section className="ca-card" aria-label="Automatický právní screen">
  <h2>Automatický právní screen</h2>
  <p>Jedním kliknutím vyhledá možné Gutenberg verze, seřadí formáty a připraví předběžný právní výsledek. Práva konkrétního souboru musí potvrdit editor.</p>
  <button type="button" className="ca-btn ca-primary" onClick={run} disabled={state==="loading"}>{state==="loading"?"Prověřuji katalog…":"Provést právní screen"}</button>
  {state==="error"?<p role="alert">Gutenberg je nyní nedostupný. Zkus opakovat nebo použij ruční výběr.</p>:null}
  {state==="done"?<div role="status"><h3>Výsledek předběžného screeningu</h3>
   {items.length===0?<div><p>{catalogBooks.length?"Katalog našel "+catalogBooks.length+" bibliografických záznamů, ale nezískal ověřené přímé odkazy na jejich soubory. Není to právní zamítnutí.":"Žádná shoda v dostupných katalogových výsledcích. Neznamená to, že dílo neexistuje."}</p>{catalogBooks.map(book=><p key={book.id}><a href={book.catalogUrl} target="_blank" rel="noopener noreferrer">{book.title} — Gutenberg #{book.id}</a></p>)}</div>:items.slice(0,20).map((item,i)=><article className="ca-card" key={item.file.url}>
    <strong>{i===0?"Doporučení: ":"Alternativa: "}{item.book.title}</strong>
    <p>{item.file.label} · Gutenberg #{item.book.id} · {item.verdict==="candidate"?"Předběžně vhodný kandidát":"Vyžaduje právní ověření"}</p>
    <p>{item.reason}</p>
    <a href={item.book.catalogUrl} target="_blank" rel="noopener noreferrer">Zdroj a podklady</a>
    <button className="ca-btn ca-secondary" type="button" onClick={()=>choose(item)}>Převzít verzi k ověření</button>
   </article>)}</div>:null}
 </section>;
}
