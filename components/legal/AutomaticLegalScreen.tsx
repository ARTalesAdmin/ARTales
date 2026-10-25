"use client";
import {useState} from "react";
type Fact={status:string;people?:{name:string;died:number|null}[];archive?:string;publish?:string;reason?:string;url?:string;textMayProceed?:boolean};
type Result={sourceId:string;decisionNo:number;bookId:number;title:string;file:{url:string;label:string};recordedAt:string;componentFacts:{author:Fact;translation:Fact;illustrations:Fact;source:Fact;verdict:string;reason:string;checkedAt:string}};
const label=(s:string)=>({likely_public_domain:"Předběžně volné",protected:"Chráněné",needs_evidence:"Nutné ověřit",not_identified:"Nepotvrzeno",unverified:"Neověřeno",review_required:"K ověření editorem",escalate:"Eskalace"} as Record<string,string>)[s]??s;
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
  <p>Jeden krok: odpovídající dílo → konkrétní soubor → kontrola autorství, překladu a ilustrací → auditní záznam. Neznámá práva systém nepovažuje za schválená.</p>
  <button type="button" className="ca-btn ca-primary" onClick={run} disabled={state==="running"}>{state==="running"?"Vyhledávám, prověřuji a zapisuji…":"Provést právní screen"}</button>
  {state==="error"?<p role="alert" className="ca-error">{error}</p>:null}
  {result&&facts?<div className="ca-legal-result" aria-live="polite">
   <h3>Právní protokol · {result.title}</h3>
   <p><strong>Vybraná verze:</strong> <a href={result.file.url} target="_blank" rel="noopener noreferrer">Gutenberg #{result.bookId} · {result.file.label}</a></p>
   <table className="ca-legal-table"><thead><tr><th>Složka</th><th>Výsledek</th><th>Důkaz / poznámka</th></tr></thead><tbody>
    <tr><th scope="row">Autor / původní dílo</th><td>{label(facts.author.status)}</td><td>{facts.author.people?.map(p=>p.name+(p.died?" († "+p.died+")":"")).join("; ")||"Chybí údaje"}</td></tr>
    <tr><th scope="row">Překlad</th><td>{label(facts.translation.status)}</td><td>{facts.translation.people?.map(p=>p.name).join("; ")||"Originální jazyk a překlad prověřit"}</td></tr>
    <tr><th scope="row">Ilustrace</th><td>{label(facts.illustrations.status)}</td><td>Archivace: {label(facts.illustrations.archive??"unverified")}; publikace: {label(facts.illustrations.publish??"unverified")}. Neblokuje použitelný text.</td></tr>
    <tr><th scope="row">Zdroj a podmínky</th><td>{label(facts.source.status)}</td><td><a href={facts.source.url} target="_blank" rel="noopener noreferrer">Gutenberg · bibliografický záznam</a></td></tr>
    <tr><th scope="row">Předběžný verdikt</th><td>{label(facts.verdict)}</td><td>{facts.reason}</td></tr>
   </tbody></table>
   <p className="ca-hint">Zapsáno {new Date(result.recordedAt).toLocaleString("cs-CZ")} · Audit #{result.decisionNo}. Právní schválení a uzamčení jsou následná oddělená rozhodnutí.</p>
   <button type="button" onClick={download} className="ca-btn ca-secondary">Stáhnout protokol a odůvodnění (JSON)</button>
   <details><summary>Co musí editor ověřit před schválením</summary><p>Shoda konkrétního textu, úplnost, překlad a podmínky distribuce v CZ/EU. Pro každé ověření je nutný zdroj důkazu.</p></details>
  </div>:null}
 </section>;
}
