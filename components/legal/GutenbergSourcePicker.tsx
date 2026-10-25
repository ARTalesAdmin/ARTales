"use client";
import {useEffect,useState} from "react";
import type {GutenbergBook,CatalogFile} from "@/lib/legal/gutenbergCatalog";
export function GutenbergSourcePicker({candidateId}:{candidateId:string}){
 const [items,setItems]=useState<GutenbergBook[]>([]);
 const [pending,setPending]=useState(true);
 const [error,setError]=useState(false);
 useEffect(()=>{let cancelled=false;fetch(`/member/candidates/${candidateId}/legal/catalog`,{cache:"no-store"})
 .then(async r=>{if(!r.ok)throw Error("catalog");return r.json() as Promise<{items:GutenbergBook[]}>})
 .then(d=>{if(!cancelled)setItems(d.items)})
 .catch(()=>{if(!cancelled)setError(true)})
 .finally(()=>{if(!cancelled)setPending(false)});
 return()=>{cancelled=true}},[candidateId]);
 const choose=(book:GutenbergBook,file:CatalogFile)=>{
  const form=document.getElementById("legal-source-form");
  if(!(form instanceof HTMLFormElement))return;
  const put=(field:string,value:string)=>{
   const el=form.elements.namedItem(field);
   if(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)el.value=value;
  };
  put("source_kind","gutenberg");put("edition_title",book.title);
  put("source_url",book.catalogUrl);put("download_url",file.url);
  put("read_url",book.readUrl??"");put("language_code",book.languages[0]??"");
  put("translator",book.translators.map(x=>x.name).join("; "));
  put("translator_died",book.translators.length===1&&book.translators[0].died?String(book.translators[0].died):"");
  put("author_died",book.authors.length===1&&book.authors[0].died?String(book.authors[0].died):"");
  put("translation_status",book.translators.length?"translated":"unknown");
  put("text_format",file.format);
  put("evidence_url",book.catalogUrl);
  // Unknown rights, language identity, completeness, and OCR quality must NOT be implicitly approved.
  put("original_rights","unknown");put("translation_rights","unknown");
  put("source_terms","unknown");put("identity_match","uncertain");
  put("language_match","uncertain");put("completeness","unknown");
  put("text_quality","unknown");
  form.scrollIntoView({behavior:"smooth",block:"start"});
 };
 return <section className="ca-card"><h2>Gutenberg · dostupné verze</h2>
  <p>Výsledky katalogu jsou pouze návrhy. Vyber přesný soubor a následně ověř práva konkrétního textu, překladu a ilustrací.</p>
  {pending?<p role="status">Hledám v katalogu…</p>:error?<p role="alert">Katalog není dostupný; zdroj lze zadat ručně.</p>:
  items.length===0?<p>Žádné odpovídající katalogové záznamy. Lze vložit vlastní zdroj.</p>:
  <div className="ca-list">{items.map(book=><article className="ca-card" key={book.id}>
   <div><strong>{book.title}</strong><p>{book.authors.map(x=>x.name).join("; ")||"Autor neuveden"} · {book.languages.join(", ")||"jazyk neuveden"} · Gutenberg #{book.id}</p>
   <a href={book.catalogUrl} target="_blank" rel="noopener noreferrer">Katalogový záznam ↗</a>
   {book.translators.length?<p>Překlad: {book.translators.map(x=>x.name).join("; ")}</p>:null}
   </div><div className="ca-links">{book.files.map(file=><button key={file.url} type="button" className="ca-btn ca-secondary" onClick={()=>choose(book,file)}>Vybrat {file.label}</button>)}</div>
  </article>)}</div>}
 </section>;
}
