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
export function legalFacts(book:GutenbergBook,year=2026){
 const creators=book.authors;
 const cleared=creators.length>0&&creators.every(p=>p.died!==null&&p.died+70<year);
 const impossible=creators.some(p=>p.died!==null&&p.died+70>=year);
 const authorStatus=cleared?"likely_public_domain":impossible?"protected":"needs_evidence";
 const translationStatus=book.translators.length?"needs_evidence":"not_identified";
 return {
  author:{status:authorStatus,people:creators,rule:"CZ/EU: death + 70 years; separate contributions and exceptions require review"},
  translation:{status:translationStatus,people:book.translators,reason:"Catalog omission does not prove absence of translation"},
  illustrations:{status:"needs_evidence",archive:"unverified",publish:"unverified",textMayProceed:true},
  source:{status:"needs_evidence",url:book.catalogUrl,usCopyrightFlag:book.usCopyrightFlag},
  verdict:cleared?"review_required":"escalate",
  checkedAt:new Date().toISOString(),territory:"CZ/EU",
  reason:"Preliminary metadata assessment; no rights clearance or snapshot without human verification."
 };
}
