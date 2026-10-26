"use client";
import {useState} from "react";
type Fact={status:string;people?:{name:string;died:number|null}[];archive?:string;publish?:string;reason?:string;url?:string;textMayProceed?:boolean};
type Result={recommendation?:"text_only"|"review"|"exclude";recommendationReason?:string;sourceId:string;decisionNo:number;bookId:number;title:string;file:{url:string;label:string};recordedAt:string;textCheck:{status:string;scope:string;sourceUrl:string|null;notice:string|null;explanation:string};epub?:{checked:boolean;imageCount:number|null;textChecked:boolean;notice:string|null;translationCredit:boolean;reason:string};openLibrary?:{matched:boolean;firstPublishYear:number|null;sourceUrl:string|null};componentFacts:{author:Fact;translation:Fact;illustrations:Fact;source:Fact;verdict:string;reason:string;checkedAt:string}};
const label=(s:string)=>({likely_public_domain:"Předběžně volné",protected:"Chráněné",needs_evidence:"Nutné ověřit",unverified:"Neověřeno",review_required:"K dořešení",text_candidate:"Původní text předběžně vhodný",not_applicable:"Bez zjištěného překladu",not_identified:"Nezjištěno",us_public_domain:"Public domain – USA",us_restricted:"Omezení – USA",escalate:"Ochranná doba / práva k dořešení"} as Record<string,string>)[s]??s;
export function AutomaticLegalScreen({candidateId}:{candidateId:string}){
 const [state,setState]=useState<"idle"|"running"|"success"|"error">("idle");
 const [result,setResult]=useState<Result|null>(null);
 const [error,setError]=useState("");
 async function run(){
  setState("running");setError("");
  try{
   const r=await fetch(`/member/candidates/${candidateId}/legal/automatic`,{method:"POST",cache:"no-store"});
   const data=await r.json();
   if(!r.ok){
    setState("error");
    setError(data.error==="no_verified_file"?"Nebyla ověřena žádná přesná verze stejného díla. Nejde o právní zamítnutí; otevři pokročilé zdroje.":data.error==="already_locked"?"Výsledek je již uzamčen.":"Katalog nebo audit momentálně nelze dokončit. Neproběhlo právní schválení.");
    return;
   }
   setResult(data as Result);setState("success");
  }catch{setState("error");setError("Požadavek se nepodařilo dokončit.");}
 }
 function download(){
  if(!result)return;
  const blob=new Blob([JSON.stringify({schema:"artales.preliminary-legal.v1",candidateId,report:result},null,2)],{type:"application/json"});
  const href=URL.createObjectURL(blob),a=document.createElement("a");a.href=href;a.download="artales-legal-"+candidateId+".json";a.click();URL.revokeObjectURL(href);
 }
 const facts=result?.componentFacts;
 return <section className="ca-card ca-legal-auto">
  <h2>Automatický právní screen</h2>
  <p>Metadata Gutenbergu, autorské lhůty a upozornění v textu. Nejasné složky zůstávají oddělené od použitelného původního textu.</p>
  <button type="button" className="ca-btn ca-primary" onClick={run} disabled={state==="running"}>{state==="running"?"Vyhledávám, prověřuji a zapisuji…":"Provést právní screen"}</button>
  {state==="error"?<p role="alert" className="ca-error">{error}</p>:null}
  {result&&facts?<div className="ca-legal-result" aria-live="polite">
   <h3>{result.title} · {result.recommendation==="text_only"?"Doporučení: pouze původní text":result.recommendation==="exclude"?"Nedoporučeno":"Cíleně dořešit"}</h3>
   <p><strong>Zdroj:</strong> <a href={result.file.url} target="_blank" rel="noopener noreferrer">Gutenberg #{result.bookId} · {result.file.label}</a></p>
   <p><strong>Další krok:</strong> {result.recommendationReason??"Zkontrolovat nevyřešené složky."}</p>
   <details><summary>Podklady a posouzení jednotlivých složek</summary><table className="ca-legal-table"><thead><tr><th>Složka</th><th>Výsledek</th><th>Důkaz / poznámka</th></tr></thead><tbody>
    <tr><th scope="row">Autor / původní dílo</th><td>{label(facts.author.status)}</td><td>{facts.author.people?.map(p=>p.name+(p.died?" († "+p.died+")":"")).join("; ")||"Chybí údaje"}</td></tr>
    <tr><th scope="row">Překlad</th><td>{label(facts.translation.status)}</td><td>{facts.translation.people?.map(p=>p.name).join("; ")||"Originální jazyk a překlad prověřit"}</td></tr>
    <tr><th scope="row">Ilustrace</th><td>{label(facts.illustrations.status)}</td><td>Archivace: {label(facts.illustrations.archive??"unverified")}; publikace: {label(facts.illustrations.publish??"unverified")}. Neblokuje použitelný text.</td></tr>
    <tr><th scope="row">Zdroj a podmínky</th><td>{label(facts.source.status)}</td><td><a href={facts.source.url} target="_blank" rel="noopener noreferrer">Gutenberg · bibliografický záznam</a></td></tr>
    <tr><th scope="row">Kontrola textu</th><td>{result.textCheck.status==="no_explicit_notice"?"Bez nalezeného omezení":result.textCheck.status==="possible_restriction"?"Nutné ověřit upozornění":"Neověřeno"}</td><td>{result.textCheck.explanation}{result.textCheck.notice?" · "+result.textCheck.notice:""}</td></tr>
    <tr><th scope="row">EPUB · ilustrace</th><td>{result.epub?.checked?result.epub.imageCount===0?"Bez dalších obrazových souborů":result.epub.imageCount+" obrazových položek":"Neověřeno"}</td><td>{result.epub?.reason??"EPUB nebyl prověřen."}{result.epub?.notice?" · "+result.epub.notice:""}</td></tr>
    <tr><th scope="row">Doporučení</th><td>{label(facts.verdict)}</td><td>{facts.author.status==="likely_public_domain"?"Ochranná lhůta původních autorů uplynula; překlad, ilustrace a konkrétní soubor posuzovat zvlášť.":"K dořešení zůstává konkrétní autorská složka; podrobnosti jsou v auditu."}</td></tr>
   </tbody></table></details>
   {result.openLibrary?.matched?<p className="ca-hint">Open Library: první vydání {result.openLibrary.firstPublishYear??"nezjištěno"} · {result.openLibrary.sourceUrl?<a href={result.openLibrary.sourceUrl} target="_blank" rel="noopener noreferrer">Bibliografický zdroj</a>:"bez přímého odkazu"}</p>:null}
   <p className="ca-hint">Zapsáno {new Date(result.recordedAt).toLocaleString("cs-CZ")} · Audit #{result.decisionNo}. Právní schválení a uzamčení jsou následná oddělená rozhodnutí.</p>
   <button type="button" onClick={download} className="ca-btn ca-secondary">Stáhnout audit (JSON)</button>

  </div>:null}
 </section>;
}
