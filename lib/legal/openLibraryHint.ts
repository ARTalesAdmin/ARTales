/** Bibliographic-only fallback. Open Library data never grants copyright clearance. */
export type OpenLibraryHint={authorDeathYear:number|null;firstPublishYear:number|null;sourceUrl:string|null;matched:boolean};
const empty:OpenLibraryHint={authorDeathYear:null,firstPublishYear:null,sourceUrl:null,matched:false};
const normalize=(s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
export function extractOpenLibraryHint(data:unknown,title:string,author:string):OpenLibraryHint{
 if(!data||typeof data!=="object")return empty;
 const d=data as {docs?:unknown};
 if(!Array.isArray(d.docs))return empty;
 const wanted=normalize(title),surname=normalize(author).split(" ").filter(x=>x.length>=4).at(-1);
 for(const raw of d.docs.slice(0,10)){
  if(!raw||typeof raw!=="object")continue;
  const r=raw as {title?:unknown;author_name?:unknown;first_publish_year?:unknown;key?:unknown};
  if(typeof r.title!=="string"||normalize(r.title)!==wanted||!Array.isArray(r.author_name))continue;
  if(!surname||!r.author_name.some(x=>typeof x==="string"&&normalize(x).includes(surname)))continue;
  const year=Number(r.first_publish_year);
  const sourceUrl=typeof r.key==="string"&&/^\/works\/OL\d+W$/.test(r.key)?"https://openlibrary.org"+r.key:null;
  return {matched:true,authorDeathYear:null,firstPublishYear:Number.isInteger(year)&&year>1400&&year<=2026?year:null,sourceUrl};
 }
 return empty;
}
export async function getOpenLibraryHint(title:string,author:string):Promise<OpenLibraryHint>{
 if(title.length<3||!author.trim())return empty;
 const url=new URL("https://openlibrary.org/search.json");
 url.searchParams.set("title",title.slice(0,100));url.searchParams.set("author",author.slice(0,80));url.searchParams.set("limit","5");
 try{
  const res=await fetch(url,{signal:AbortSignal.timeout(6000),headers:{"Accept":"application/json"},next:{revalidate:86400}});
  if(!res.ok||Number(res.headers.get("content-length")??0)>250000)return empty;
  const text=(await res.text()).slice(0,250001);
  if(text.length>250000)return empty;
  return extractOpenLibraryHint(JSON.parse(text),title,author);
 }catch{return empty}
}
