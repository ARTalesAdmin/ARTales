import type {GutenbergBook} from "./gutenbergCatalog";

export type TextRightsCheck={
 status:"no_explicit_notice"|"possible_restriction"|"not_checked";
 scope:"complete"|"partial"|"none";
 sourceUrl:string|null;
 notice:string|null;
 translationCredit:boolean;
 explanation:string;
 /** Historical imprint retained in the source, not a new rights authorization. */
 historicalImprints?:string[];
};
export type HistoricalImprintContext={
 /** A publication year from the previously approved, immutable legal audit. */
 approvedOriginalPublicationYear:number|null;
 currentYear:number;
};
function clearedHistoricalImprint(notice:string,position:number,ctx?:HistoricalImprintContext):boolean{
 if(position>12000)return false;
 const m=/^(?:copyright\s*(?:©\s*|\(c\)\s*)?|©\s*)([12][0-9]{3})[.,;:]?$/i.exec(notice.trim());
 if(!m)return false;
 const year=Number(m[1]),current=ctx?.currentYear??new Date().getUTCFullYear();
 if(!Number.isInteger(current)||year<1400||year>current-71)return false;
 // An isolated historical title-page imprint is evidence, not an explicit
 // contemporary demand for permission. Audit it and continue, even when the
 // first-publication field was not supplied. Reject contradictory known dates.
 const publication=ctx?.approvedOriginalPublicationYear;
 return publication===null||publication===undefined||
  (publication>=1400&&publication<=current-71&&Math.abs(year-publication)<=3);
}
/** The default Gutenberg legal/trademark wrapper is not a restriction on an author's text. */
export function inspectGutenbergText(
 text:string,complete=true,context?:HistoricalImprintContext
):Omit<TextRightsCheck,"sourceUrl">{
 const start=/\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*?\*{3}/i.exec(text);
 const bodyStart=start?.index===undefined?0:start.index+start[0].length;
 const bodyEnd=/\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i.exec(text.slice(bodyStart));
 let work=text.slice(bodyStart,bodyEnd?bodyStart+bodyEnd.index:undefined);
 work=work.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ");
 work=work.replace(/<\/?(?:p|div|h\d|br|li|section|tr)\b[^>]*>/gi,"\n").replace(/<[^>]*>/g," ");
 work=work.replace(/&(?:nbsp|amp|lt|gt|quot);/gi," ");
 // Detect all potential rights notices, not just the first. A historical
 // year on the original title page is not by itself a CURRENT restriction once
 // the exact edition and its creator terms have been separately approved.
 // The source text stays immutable, and each tolerated imprint is audited.
 const pattern=/(?:copyright\s*(?:©|\(c\)|\d{4})|©\s*\d{4}|all rights reserved|reprinted by permission|used by permission|reproduction prohibited|permission of the publisher)[^\n]{0,140}/gi;
 const historicalImprints:string[]=[];
 let restriction:string|null=null;
 for(const candidate of work.matchAll(pattern)){
  const phrase=candidate[0].trim();
  if(clearedHistoricalImprint(phrase,candidate.index??work.length,context)){
   historicalImprints.push(phrase.slice(0,170));
  }else{
   restriction=phrase.slice(0,170);
   break;
  }
 }
 const translationCredit=/\b(?:translated by|translation by|translated from the|translation copyright)\b/i.test(work.slice(0,180000));
 if(restriction)return {status:"possible_restriction",scope:complete?"complete":"partial",
  notice:restriction,translationCredit,historicalImprints,
  explanation:"V textu je možné zvláštní omezení — ověřit konkrétní pasáž."};
 return {
  status:complete?"no_explicit_notice":"not_checked",scope:complete?"complete":"partial",notice:null,
  translationCredit,historicalImprints,
  explanation:complete?"V přečteném textu nebylo nalezeno explicitní zvláštní omezení mimo standardní Gutenberg licenci.":"Text nebyl přečten celý; absence zvláštního omezení není potvrzena."
 };
}
export async function checkGutenbergText(book:GutenbergBook):Promise<TextRightsCheck>{
 const candidate=book.files.find(f=>f.format==="html")??book.files.find(f=>f.format==="plain_text");
 const initial:TextRightsCheck={status:"not_checked",scope:"none",sourceUrl:candidate?.url??null,notice:null,translationCredit:false,explanation:"Čitelný text nebyl dostupný pro automatickou kontrolu."};
 if(!candidate)return initial;
 let u:URL;
 try{
  u=new URL(candidate.url);
  if(u.protocol!=="https:"||!(/(^|\.)gutenberg\.org$/i).test(u.hostname)||u.username||u.password)return initial;
 }catch{return initial}
 try{
  const response=await fetch(u.toString(),{headers:{"Accept":"text/html, text/plain;q=0.9"},signal:AbortSignal.timeout(9500),next:{revalidate:3600}});
  if(!response.ok||!response.body)return initial;
  if(Number(response.headers.get("content-length")??0)>1_800_000)return {...initial,explanation:"Text je větší než limit automatické kontroly."};
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let text="",total=0,complete=false;
  for(;;){
   const {done,value}=await reader.read();
   if(done){complete=true;break}
   total+=value.byteLength;
   if(total>1_800_000){await reader.cancel();break}
   text+=decoder.decode(value,{stream:true});
  }
  text+=decoder.decode();
  if(!text.trim())return initial;
  return {...inspectGutenbergText(text,complete),sourceUrl:u.toString()};
 }catch{return {...initial,explanation:"Zdrojový text se nyní nepodařilo načíst. Právní kontrola textu zůstává neověřená."}}
}
