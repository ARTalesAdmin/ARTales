import {searchGutenberg,getGutenbergBook,type GutenbergBook} from "./gutenbergCatalog";
const normalize=(s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
export function matchBook(book:GutenbergBook,title:string,author:string):boolean{
 const t=normalize(book.title),q=normalize(title);
 const identity=t===q||t.startsWith(q+" ")||q.startsWith(t+" ");
 if(!identity)return false;
 const family=normalize(author).split(" ").filter(w=>w.length>=4);
 if(book.authors.length&&family.length){
  const names=book.authors.map(p=>normalize(p.name)).join(" ");
  if(!family.some(w=>names.includes(w)))return false;
 }
 return true;
}
export async function getMatchingGutenberg(title:string,author:string){
 const results=await searchGutenberg(title,author);
 const matches=results.filter(b=>matchBook(b,title,author)).slice(0,6);
 const detailed=await Promise.all(matches.map(async b=>{
  try{const d=await getGutenbergBook(b.id);return d?{...b,...d,authors:d.authors.length?d.authors:b.authors,files:d.files.length?d.files:b.files}:b;}catch{return b;}
 }));
 const usable=detailed.filter(b=>b.files.length);
 usable.sort((a,b)=>{
  const best=(x:GutenbergBook)=>x.files.some(f=>f.format==="html")?3:x.files.some(f=>f.format==="plain_text")?2:1;
  return best(b)-best(a)||a.id-b.id;
 });
 return {matches:detailed,selected:usable[0]??null};
}
export function legalFacts(book:GutenbergBook,year=2026,prescreenAuthorDied:number|null=null,opts?:{originalLanguageConfirmed?:boolean;illustrators?:{name:string;died:number|null}[];usStatus?:"public_domain"|"restricted"|"unknown"}){
 const creators=book.authors.length?book.authors.map(p=>({...p,died:p.died??(book.authors.length===1?prescreenAuthorDied:null)})):[{name:"Autor z Prescreenu",died:prescreenAuthorDied}];
 const term=(people:{died:number|null}[])=>people.length>0&&people.every(p=>p.died!==null&&p.died+70<year)?"likely_public_domain":people.some(p=>p.died!==null&&p.died+70>=year)?"protected":"needs_evidence";
 const authorStatus=term(creators);
 const translators=book.translators;
 const translationStatus=translators.length?term(translators):opts?.originalLanguageConfirmed?"not_applicable":"not_identified";
 const illustrators=opts?.illustrators??[];
 const illustrationStatus=illustrators.length?term(illustrators):"not_identified";
 return {
  author:{status:authorStatus,people:creators,rule:"CZ/EU: death + 70 years; each creator independently"},
  translation:{status:translationStatus,people:translators,reason:translators.length?"Translation credit from this edition":opts?.originalLanguageConfirmed?"Original-language edition; no translation credit identified":"Missing translator metadata does not prove absence of translation"},
  illustrations:{status:illustrationStatus,people:illustrators,archive:"unverified",publish:"unverified",textMayProceed:true,reason:"Illustration inventory and the exact edition must be checked before image publication"},
  source:{status:opts?.usStatus==="public_domain"?"us_public_domain":opts?.usStatus==="restricted"?"us_restricted":"needs_evidence",url:book.catalogUrl,usCopyrightFlag:book.usCopyrightFlag,reason:"USA statement is evidence, not CZ/EU clearance"},
  verdict:authorStatus==="protected"||translationStatus==="protected"?"escalate":authorStatus==="likely_public_domain"&&(translationStatus==="not_applicable"||translationStatus==="likely_public_domain")?"text_candidate":"review_required",
  checkedAt:new Date().toISOString(),territory:"CZ/EU",
  reason:"Component term assessment; final approval and exact-file QA remain separate."
 };
}
