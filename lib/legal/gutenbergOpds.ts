import type {CatalogFile,CatalogPerson,GutenbergBook} from "./gutenbergCatalog";

/**
 * Parses ONLY the first, bounded Atom/OPDS catalog result page.
 * Project Gutenberg expressly documents this feed for machine-to-machine access.
 * No ebook content is downloaded. All files are linked to their original host.
 */
function unescapeXml(raw:string):string{
 return raw.replace(/&#(x[0-9a-fA-F]+|[0-9]+);|&(amp|lt|gt|quot|apos);/g,(whole,num:string|undefined,entity:string|undefined)=>{
  if(entity)return ({amp:"&",lt:"<",gt:">",quot:'"',apos:"'"} as Record<string,string>)[entity]??whole;
  const point=num?.toLowerCase().startsWith("x")?parseInt(num.slice(1),16):Number(num);
  return Number.isInteger(point)&&point>0&&point<=0x10ffff?String.fromCodePoint(point):whole;
 }).replace(/<[^>]*>/g,"").trim();
}
function tag(src:string,name:string):string{
 const match=src.match(new RegExp("<(?:[a-zA-Z0-9_-]+:)?"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?"+name+"\\s*>","i"));
 return match?unescapeXml(match[1]):"";
}
function rawTags(src:string,name:string):string[]{
 const re=new RegExp("<(?:[a-zA-Z0-9_-]+:)?"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?"+name+"\\s*>","gi");
 return [...src.matchAll(re)].slice(0,30).map(m=>m[1]);
}
function attributes(src:string):Record<string,string>{
 const out:Record<string,string>={};
 for(const m of src.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)){
  out[m[1].toLowerCase()]=unescapeXml(m[2]??m[3]??"");
 }
 return out;
}
function gutenbergHttps(value:string):string|null{
 try{
  const u=new URL(value,"https://www.gutenberg.org");
  if(u.protocol!=="https:" || !["www.gutenberg.org","gutenberg.org","m.gutenberg.org"].includes(u.hostname)
     || u.username || u.password || u.port)return null;
  return u.toString();
 }catch{return null}
}
function personName(name:string):CatalogPerson{
 const match=name.match(/(?:^|,\s*)(\d{4})\s*[-–]\s*(\d{4})\s*$/);
 const year=match?Number(match[2]):null;
 return {name:name.slice(0,200),died:year!==null&&year>=1000&&year<=2100?year:null};
}
function idFromEntry(src:string):number|null{
 const direct=tag(src,"id");
 const matched=direct.match(/gutenberg\.org\/ebooks\/(\d{1,8})(?:\D|$)/i);
 if(matched)return Number(matched[1]);
 const alternate=[...src.matchAll(/<(?:(?:[a-zA-Z0-9_-]+):)?link\b([^>]*?)\/?>/gi)]
  .map(m=>attributes(m[1]).href??"").find(h=>/\/ebooks\/\d{1,8}(?:[/?#.]|$)/.test(h));
 const m=alternate?.match(/\/ebooks\/(\d{1,8})(?:[/?#.]|$)/);
 return m?Number(m[1]):null;
}
function filesForEntry(src:string,bookId:number):CatalogFile[]{
 const files:CatalogFile[]=[];
 for(const m of src.matchAll(/<(?:[a-zA-Z0-9_-]+:)?link\b([^>]*?)\/?>/gi)){
  const a=attributes(m[1]);
  const href=a.href?gutenbergHttps(a.href):null;
  if(!href || !a.rel?.toLowerCase().includes("acquisition"))continue;
  // The OPDS feed determines exact acquisition URLs. Never guess download URLs.
  const type=(a.type??"").toLowerCase();
  let file:CatalogFile["format"]|null=null;
  if(type.startsWith("text/plain") || /(?:\.txt(?:\.utf-8)?)(?:[?#]|$)/i.test(href))file="plain_text";
  else if(type.startsWith("text/html") || /\.html?(?:[?#]|$)/i.test(href))file="html";
  else if(type.startsWith("application/epub+zip") || /\.epub(?:3)?(?:[.?#]|$)/i.test(href))file="epub";
  if(!file)continue;
  const label=file==="plain_text"?"TXT":file==="html"?"HTML":"EPUB";
  if(!files.some(v=>v.url===href))files.push({url:href,label,format:file});
 }
 files.sort((a,b)=>({plain_text:0,html:1,epub:2}[a.format]-{plain_text:0,html:1,epub:2}[b.format]));
 return files.slice(0,10);
}
export function parseGutenbergOpds(xml:string):GutenbergBook[]{
 if(xml.length>600000 || !/<(?:\w+:)?feed\b/i.test(xml))throw new Error("invalid_opds");
 const entries=rawTags(xml,"entry").slice(0,25);
 const output:GutenbergBook[]=[];
 for(const entry of entries){
  const id=idFromEntry(entry);
  const title=tag(entry,"title").slice(0,300);
  if(!id || !title || output.some(b=>b.id===id))continue;
  const authors=rawTags(entry,"author").slice(0,8).map(s=>tag(s,"name")).filter(Boolean).map(personName);
  const languages=rawTags(entry,"language").slice(0,6).map(unescapeXml).filter(Boolean);
  const files=filesForEntry(entry,id);
  const html=files.find(f=>f.format==="html")?.url??null;
  output.push({
   id,title,authors,translators:[],languages,files,readUrl:html,
   catalogUrl:"https://www.gutenberg.org/ebooks/"+id,
   usCopyrightFlag:null,
  });
 }
 return output;
}
