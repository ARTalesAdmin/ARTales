import type {CatalogPerson,GutenbergBook} from "./gutenbergCatalog";
export type VerifiedRights={people:CatalogPerson[];contributors:{role:string;name:string;died:number|null}[];usStatus:"public_domain"|"restricted"|"unknown";url:string;checked:boolean};
function xmlText(s:string){return s.replace(/<[^>]*>/g," ").replace(/&#(\d+);/g,(_,n:string)=>String.fromCodePoint(Number(n))).replace(/&amp;/g,"&").trim()}
function find(block:string,tag:string){const match=block.match(new RegExp("<(?:[\\w-]+:)?"+tag+"\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?"+tag+">","i"));return match?xmlText(match[1]):""}
export function parseGutenbergRdf(xml:string,bookId:number):VerifiedRights{
 const result:VerifiedRights={people:[],contributors:[],usStatus:"unknown",url:"https://www.gutenberg.org/ebooks/"+bookId+".rdf",checked:true};
 if(xml.length>900000||!/rdf:RDF|<RDF\b/.test(xml))throw Error("invalid_rdf");
 const rights=[...xml.matchAll(/<(?:dcterms:)?rights\b[^>]*>([\s\S]*?)<\/(?:dcterms:)?rights>/gi)].map(m=>xmlText(m[1]).toLowerCase()).join(" ");
 if(rights.includes("public domain in the usa")||rights.includes("public domain in the united states"))result.usStatus="public_domain";
 else if(rights.includes("copyright")||rights.includes("restricted"))result.usStatus="restricted";
 const agents=new Map<string,CatalogPerson>();
 for(const m of xml.matchAll(/<pgterms:agent\b([^>]*)>([\s\S]*?)<\/pgterms:agent>/gi)){
  const id=m[1].match(/rdf:about="([^"]+)"/)?.[1]??"";
  const name=find(m[2],"name"),year=Number(find(m[2],"deathdate"));
  if(name)agents.set(id,{name,died:Number.isInteger(year)&&year>=1000&&year<=2100?year:null});
 }
 for(const m of xml.matchAll(/<(dcterms:creator|marcrel:[a-z]{3})\b[^>]*>([\s\S]*?)<\/\1>/gi)){
  const role=m[1],reference=m[2].match(/rdf:resource="([^"]+)"/)?.[1];
  const nestedName=find(m[2],"name"),nestedDeath=Number(find(m[2],"deathdate"));
  const person=(reference?agents.get(reference):undefined)??(nestedName?{name:nestedName,died:Number.isInteger(nestedDeath)&&nestedDeath>=1000&&nestedDeath<=2100?nestedDeath:null}:null);
  if(person){
   result.contributors.push({role,name:person.name,died:person.died});
   if(role==="dcterms:creator")result.people.push(person);
  }
 }
 return result;
}
export async function getGutenbergRights(book:GutenbergBook):Promise<VerifiedRights>{
 const url="https://www.gutenberg.org/ebooks/"+book.id+".rdf";
 const empty:VerifiedRights={people:[],contributors:[],usStatus:"unknown",url,checked:false};
 try{
  const res=await fetch(url,{headers:{"Accept":"application/rdf+xml, application/xml"},signal:AbortSignal.timeout(7500),next:{revalidate:3600}});
  if(!res.ok||Number(res.headers.get("content-length")??0)>900000)return empty;
  return parseGutenbergRdf((await res.text()).slice(0,900001),book.id);
 }catch{return empty}
}
