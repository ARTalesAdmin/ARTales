"use client";
import {useState} from "react";
import type {GutenbergBook,CatalogFile} from "@/lib/legal/gutenbergCatalog";
type Selection={book:GutenbergBook;file:CatalogFile|null};
function matchScore(book:GutenbergBook,title:string,author:string):number{
 const normalize=(x:string)=>x.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
 const t=normalize(book.title),q=normalize(title),a=normalize(author);
 const same=t===q?100:t.startsWith(q)||q.startsWith(t)?60:t.includes(q)?35:0;
 const authorHit=book.authors.some(p=>normalize(p.name).split(" ").some(w=>w.length>3&&a.includes(w)));
 return same+(authorHit?25:0);
}
export function AutomaticLegalScreen({candidateId,title,author}:{candidateId:string;title:string;author:string}){
 const [state,setState]=useState<"idle"|"loading"|"done"|"error">("idle");
 const [books,setBooks]=useState<GutenbergBook[]>([]);
 const [selected,setSelected]=useState<Selection|null>(null);
 const [detail,setDetail]=useState(false);
 const [message,setMessage]=useState("");
 async function run(){
  setState("loading");setSelected(null);setMessage("");
  try{
   const r=await fetch(`/member/candidates/${candidateId}/legal/catalog`,{cache:"no-store"});
   if(!r.ok)throw Error("catalog");
   const data=await r.json() as {items:GutenbergBook[]};
   setBooks(data.items.sort((a,b)=>matchScore(b,title,author)-matchScore(a,title,author)));
   setState("done");
   if(data.items.length===1)void chooseBook(data.items[0]);
  }catch{setState("error");setMessage("Katalog právě neodpověděl. Právní výsledek nebyl vytvořen.");}
 }
 async function chooseBook(book:GutenbergBook){
  setDetail(true);setMessage("");
  try{
   const r=await fetch(`/member/candidates/${candidateId}/legal/catalog/${book.id}`,{cache:"no-store"});
   if(!r.ok)throw Error("detail");
   const payload=await r.json() as {book:GutenbergBook|null};
   const resolved=payload.book??book;
   const file=resolved.files[0]??book.files[0]??null;
   setSelected({book:resolved,file});
   if(!file)setMessage("Dílo je nalezené, ale konkrétní přímá URL textu není ověřena. Zdroj není připraven k uzamčení.");
  }catch{
   setSelected({book,file:book.files[0]??null});
   setMessage("Detail Gutenberg nyní nelze ověřit; zůstává bibliografický záznam, nikoli právní schválení.");
  }finally{setDetail(false)}
 }
 function handoff(){
  if(!selected?.file)return;
  const form=document.getElementById("legal-source-form");
  if(!(form instanceof HTMLFormElement))return;
  const put=(name:string,value:string)=>{const el=form.elements.namedItem(name);if(el instanceof HTMLInputElement||el instanceof HTMLSelectElement)el.value=value};
  const {book,file}=selected;
  put("source_kind","gutenberg");put("edition_title",book.title);put("source_url",book.catalogUrl);
  put("download_url",file.url);put("read_url",book.readUrl??"");
  put("language_code",book.languages[0]??"");put("text_format",file.format);
  put("author_died",book.authors.length===1&&book.authors[0].died?String(book.authors[0].died):"");
  put("translator",book.translators.map(p=>p.name).join("; "));
  put("translation_status",book.translators.length?"translated":"unknown");
  put("translator_died",book.translators.length===1&&book.translators[0].died?String(book.translators[0].died):"");
  put("evidence_url",book.catalogUrl);put("original_rights","unknown");put("translation_rights","unknown");
  put("source_terms","unknown");put("identity_match","uncertain");
  put("language_match","uncertain");put("completeness","unknown");put("text_quality","unknown");
  const advanced=form.closest("details");if(advanced)advanced.open=true;
  form.scrollIntoView({behavior:"smooth",block:"start"});
 }
 return <section className="ca-card" aria-label="Automatický právní screen">
  <h2>Právní screen · automatický výběr</h2>
  <p>Najdu odpovídající dílo, ověřím dostupný soubor a sestavím předběžný protokol. Nejasná práva zůstanou k potvrzení editorovi.</p>
  <button type="button" className="ca-btn ca-primary" onClick={run} disabled={state==="loading"}>{state==="loading"?"Vyhledávám a prověřuji…":"Provést právní screen"}</button>
  {state==="error"?<p role="alert">{message}</p>:null}
  {state==="done"?<section aria-live="polite"><h3>Výběr nalezeného díla</h3>
   {books.length===0?<p>Žádný katalogový záznam — nejde o právní zamítnutí.</p>:
    books.slice(0,12).map((book,i)=><div key={book.id} className="ca-card">
     <strong>{i===0?"Doporučená shoda: ":"Alternativa: "}{book.title}</strong>
     <p>{book.authors.map(p=>p.name).join("; ")||"Autor neuveden"} · Gutenberg #{book.id} · {book.files.length} rozpoznaných souborů</p>
     <button className="ca-btn ca-secondary" type="button" onClick={()=>void chooseBook(book)} disabled={detail}>Vybrat dílo a prověřit konkrétní verzi</button>
     <p><a href={book.catalogUrl} target="_blank" rel="noopener noreferrer">Záznam Gutenberg ↗</a></p>
    </div>)}
  </section>:null}
  {detail?<p role="status">Ověřuji konkrétní vydání…</p>:null}
  {selected?<section className="ca-card" aria-live="polite"><h3>Komponentní právní protokol · návrh</h3>
   <p><strong>Dílo:</strong> {selected.book.title} · Gutenberg #{selected.book.id}</p>
   <p><strong>Autor:</strong> {selected.book.authors.map(p=>p.name+(p.died?" · úmrtí "+p.died:"")).join("; ")||"neznámý"} — nutné doložit práva CZ/EU</p>
   <p><strong>Překlad:</strong> {selected.book.translators.length?selected.book.translators.map(p=>p.name).join("; "):"V katalogu neurčen; je nutné ověřit, zda jde o originál"}</p>
   <p><strong>Ilustrace:</strong> Inventář a práva k archivaci/publikaci zatím neověřeny; text samotný tím není vyloučen</p>
   <p><strong>Zdrojový soubor:</strong> {selected.file?<a href={selected.file.url} target="_blank" rel="noopener noreferrer">{selected.file.label} · zobrazit zdroj</a>:"Nenalezen ověřitelný přímý odkaz"}</p>
   <p><strong>Verdikt:</strong> {selected.file?"Vybraný zdroj; právní důkazy vyžadují potvrzení":"Pozastaveno — nutné dohledat konkrétní soubor"}</p>
   <p><strong>Kontrola:</strong> Automatický návrh není schválením práv ani zámkem.</p>
   {message?<p role="status">{message}</p>:null}
   {selected.file?<button className="ca-btn ca-primary" type="button" onClick={handoff}>Převzít zdroj k právnímu potvrzení</button>:null}
  </section>:null}
 </section>;
}
