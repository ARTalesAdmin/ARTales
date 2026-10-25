import {parseGutenbergOpds} from "./gutenbergOpds";
/**
 * Read-only Gutenberg catalog adapter. Gutendex serves PG metadata, not rights
 * clearance for CZ/EU. No book content is fetched or stored in Legal Screen.
 */
export type CatalogPerson={name:string;died:number|null};
export type CatalogFile={url:string;label:string;format:"plain_text"|"html"|"epub"};
export type GutenbergBook={
  id:number;title:string;authors:CatalogPerson[];translators:CatalogPerson[];
  languages:string[];catalogUrl:string;files:CatalogFile[];
  readUrl:string|null;usCopyrightFlag:boolean|null;
};
type RawPerson={name?:unknown;death_year?:unknown};
type RawBook={id?:unknown;title?:unknown;authors?:unknown;translators?:unknown;languages?:unknown;formats?:unknown;copyright?:unknown};
const hostAllowed=(url:string):boolean=>{
 try{const u=new URL(url);return u.protocol==="https:" && (u.hostname==="gutenberg.org"||u.hostname.endsWith(".gutenberg.org")) && !u.username && !u.password;}catch{return false;}
};
const persons=(raw:unknown):CatalogPerson[]=>{
 if(!Array.isArray(raw))return [];
 return raw.slice(0,8).flatMap((v:RawPerson)=>{
  const name=typeof v?.name==="string"?v.name.trim().slice(0,200):"";
  if(!name)return [];
  return [{name,died:Number.isInteger(v.death_year)&&Number(v.death_year)>=1000&&Number(v.death_year)<=2100?Number(v.death_year):null}];
 });
};
export function parseGutenbergBook(raw:unknown):GutenbergBook|null{
 if(!raw||typeof raw!=="object")return null;
 const b=raw as RawBook;
 if(!Number.isSafeInteger(b.id)||Number(b.id)<1||Number(b.id)>99999999||typeof b.title!=="string"||!b.title.trim())return null;
 const formats=b.formats&&typeof b.formats==="object"&&!Array.isArray(b.formats)?b.formats as Record<string,unknown>:{};
 const files=Object.entries(formats).flatMap<CatalogFile>(([mime,value])=>{
  if(typeof value!=="string"||!hostAllowed(value)||value.length>1000)return [];
  const key=mime.toLowerCase();
  if(key.startsWith("text/plain")&&!/\.zip(?:[?#]|$)/i.test(value))return [{url:value,label:"TXT",format:"plain_text" as const}];
  if(key.startsWith("text/html"))return [{url:value,label:"HTML",format:"html" as const}];
  if(key.startsWith("application/epub+zip"))return [{url:value,label:"EPUB",format:"epub" as const}];
  return [];
 });
 files.sort((a,b)=>({plain_text:0,html:1,epub:2}[a.format]-{plain_text:0,html:1,epub:2}[b.format]));
 const dedup=files.filter((f,i)=>files.findIndex(x=>x.url===f.url)===i).slice(0,12);
 const html=dedup.find(f=>f.format==="html")?.url??null;
 return {
  id:Number(b.id),title:b.title.trim().slice(0,300),
  authors:persons(b.authors),translators:persons(b.translators),
  languages:Array.isArray(b.languages)?b.languages.filter((v):v is string=>typeof v==="string").slice(0,6):[],
  catalogUrl:`https://www.gutenberg.org/ebooks/${b.id}`,
  files:dedup,readUrl:html,
  usCopyrightFlag:typeof b.copyright==="boolean"?b.copyright:null
 };
}
async function query(path:string):Promise<unknown>{
 const u=new URL(path,"https://gutendex.com");
 if(u.origin!=="https://gutendex.com")throw Error("catalog_host");
 const res=await fetch(u,{headers:{"Accept":"application/json","User-Agent":"ARTales-LegalScreen/1.0 (https://artales.net)"},signal:AbortSignal.timeout(6500),next:{revalidate:1800}});
 if(!res.ok)throw Error("catalog_unavailable");
 const declaredSize=Number(res.headers.get("content-length")??0);
 if(declaredSize>1_000_000)throw Error("catalog_response_oversize");
 return res.json() as Promise<unknown>;
}
async function searchOfficialOpds(title:string,author:string):Promise<GutenbergBook[]>{
 const queryText=[title.trim().slice(0,100),author.trim().slice(0,70)].filter(Boolean).join(" ");
 const u=new URL("https://www.gutenberg.org/ebooks/search.opds/");
 u.searchParams.set("query",queryText);
 const response=await fetch(u.toString(),{headers:{"Accept":"application/atom+xml, application/xml;q=0.9"},signal:AbortSignal.timeout(7500),next:{revalidate:1800}});
 if(!response.ok)throw Error("opds_status_"+response.status);
 const declared=Number(response.headers.get("content-length")??0);
 if(declared>600000)throw Error("opds_too_large");
 return parseGutenbergOpds((await response.text()).slice(0,600001));
}
export async function searchGutenberg(title:string,author:string):Promise<GutenbergBook[]>{
 const cleanTitle=title.trim().slice(0,100),cleanAuthor=author.trim().slice(0,70);
 if(cleanTitle.length<3)return [];
 const phrases=[cleanTitle+" "+cleanAuthor,cleanTitle].filter((v,i,a)=>v.trim()&&a.indexOf(v)===i);
 let discovered:GutenbergBook[]=[];
 let responded=false;
 let failureCount=0;
 for(const phrase of phrases){
  try{
   const books=await searchOfficialOpds(phrase,"");
   responded=true;
   discovered.push(...books.filter(b=>!discovered.some(x=>x.id===b.id)));
  }catch{failureCount++;}
  if(discovered.some(b=>b.files.length>0))break;
 }
 if(discovered.some(b=>b.files.length>0))return discovered.slice(0,16);
 for(const phrase of phrases){
  try{
   const payload=await query("/books/?search="+encodeURIComponent(phrase));
   responded=true;
   if(payload&&typeof payload==="object"&&Array.isArray((payload as {results?:unknown}).results)){
    const results=(payload as {results:unknown[]}).results;
    const books=results.slice(0,32).map(parseGutenbergBook).filter((v):v is GutenbergBook=>v!==null);
    for(const b of books){
     const old=discovered.findIndex(x=>x.id===b.id);
     if(old<0)discovered.push(b);
     else if(discovered[old].files.length===0&&b.files.length>0)discovered[old]=b;
    }
   }
  }catch{failureCount++;}
  if(discovered.some(b=>b.files.length>0))break;
 }
 if(!responded&&failureCount>0)throw new Error("catalog_unavailable");
 return discovered.slice(0,16);
}
export async function getGutenbergBook(id:number):Promise<GutenbergBook|null>{
 if(!Number.isInteger(id)||id<1||id>99999999)return null;
 try{
  const u="https://www.gutenberg.org/ebooks/"+id+".opds";
  const response=await fetch(u,{headers:{"Accept":"application/atom+xml, application/xml;q=0.9"},signal:AbortSignal.timeout(7500),next:{revalidate:1800}});
  if(response.ok){
   const payload=(await response.text()).slice(0,600001);
   const found=parseGutenbergOpds(payload).find(x=>x.id===id);
   if(found?.files.length)return found;
  }
 }catch{}
 try{
  const data=parseGutenbergBook(await query("/books/"+id+"/"));
  if(data)return data;
 }catch{}
 return null;
}
