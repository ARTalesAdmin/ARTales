import {createHash} from "node:crypto";
import {inflateRawSync} from "node:zlib";
import {posix} from "node:path";
const MAX_FILE=16*1024*1024,MAX_FILES=400,MAX_TOTAL=48*1024*1024;
const digest=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex");
type Entry={name:string;bytes:Buffer;sha256:string};
export type EpubExtract={schema:"artales.epub-extract.v1";epub_sha256:string;text:string;text_sha256:string;
 component_id:string;documents:{path:string;sha256:string;length:number}[];
 assets:{path:string;sha256:string;size:number;mime:string;publication_clearance:"excluded"}[]};
export function readEpubEntries(input:Uint8Array):Entry[]{
 const b=Buffer.from(input);
 if(b.length<66||b.length>MAX_FILE||b.readUInt32LE(0)!==0x04034b50)throw Error("invalid_epub");
 let end=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){
  if(b.readUInt32LE(i)===0x06054b50&&i+22+b.readUInt16LE(i+20)===b.length){end=i;break;}
 }
 if(end<0)throw Error("epub_zip_directory_missing");
 const count=b.readUInt16LE(end+10),dirSize=b.readUInt32LE(end+12),start=b.readUInt32LE(end+16);
 if(!count||count>MAX_FILES||start+dirSize!==end||b.readUInt16LE(end+8)!==count)throw Error("epub_zip_directory_invalid");
 let p=start,total=0;const out:Entry[]=[],seen=new Set<string>();
 for(let i=0;i<count;i++){
  if(p+46>end||b.readUInt32LE(p)!==0x02014b50)throw Error("epub_central_invalid");
  const flags=b.readUInt16LE(p+8),method=b.readUInt16LE(p+10),crc=b.readUInt32LE(p+16),
   packed=b.readUInt32LE(p+20),expanded=b.readUInt32LE(p+24),nl=b.readUInt16LE(p+28),
   extra=b.readUInt16LE(p+30),comment=b.readUInt16LE(p+32),offset=b.readUInt32LE(p+42);
  const name=b.subarray(p+46,p+46+nl).toString("utf8");p+=46+nl+extra+comment;
  const normalized=posix.normalize(name);
  if(!name||name.startsWith("/")||name.includes("\\")||normalized!==name||
     normalized.startsWith("../")||normalized===".."||seen.has(name)||flags&1||
     ![0,8].includes(method)||packed>MAX_FILE||expanded>MAX_FILE||total+expanded>MAX_TOTAL)
   throw Error("unsafe_epub_member");
  seen.add(name);total+=expanded;
  if(name.endsWith("/"))continue;
  if(offset+30>b.length||b.readUInt32LE(offset)!==0x04034b50)throw Error("epub_local_header_invalid");
  const localName=b.readUInt16LE(offset+26),localExtra=b.readUInt16LE(offset+28),from=offset+30+localName+localExtra;
  if(from+packed>start)throw Error("epub_member_overlap");
  const compressed=b.subarray(from,from+packed);
  const bytes=method===0?Buffer.from(compressed):inflateRawSync(compressed,{maxOutputLength:MAX_FILE});
  if(bytes.length!==expanded)throw Error("epub_member_size_mismatch");
  // ZIP central CRC-32 is not cryptographic; SHA-256 and immutable archive
  // still bind bytes. Check CRC to identify corrupted EPUB before composition.
  let c=0xffffffff;for(const v of bytes){c^=v;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}
  if(((c^0xffffffff)>>>0)!==crc)throw Error("epub_crc_mismatch");
  out.push({name,bytes,sha256:digest(bytes)});
 }
 if(p!==end)throw Error("epub_directory_trailing_data");
 return out;
}
function unescapeEntities(s:string){
 const named:Record<string,string>={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" ",mdash:"—",ndash:"–",hellip:"…",lsquo:"‘",rsquo:"’",ldquo:"“",rdquo:"”"};
 return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi,(whole,key:string)=>{
  if(key.startsWith("#")){
   const number=key[1].toLowerCase()==="x"?parseInt(key.slice(2),16):parseInt(key.slice(1),10);
   return number>0&&number<=0x10ffff&&!(number>=0xd800&&number<=0xdfff)?String.fromCodePoint(number):whole;
  }
  return named[key.toLowerCase()]??whole;
 });
}
export function xhtmlToSourceText(source:string):string{
 if(/<!DOCTYPE|<!ENTITY|<script\b|<iframe\b|<object\b/i.test(source))throw Error("epub_active_content_refused");
 const body=/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i.exec(source)?.[1];
 if(!body)throw Error("epub_document_body_missing");
 const clean=body.replace(/<(style|svg|nav)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,"")
 .replace(/<br\s*\/?\s*>/gi,"\n")
 .replace(/<\/(?:p|div|h[1-6]|li|blockquote|section|article|pre|tr)>/gi,"\n\n")
 .replace(/<[^>]+>/g,"");
 return unescapeEntities(clean).replace(/\r\n?/g,"\n").replace(/[\t ]+\n/g,"\n").replace(/\n{4,}/g,"\n\n\n").trim();
}
export function extractEpub(input:Uint8Array):EpubExtract{
 const entries=readEpubEntries(input),byName=new Map(entries.map(e=>[e.name,e]));
 const container=byName.get("META-INF/container.xml")?.bytes.toString("utf8");
 const root=container?.match(/full-path\s*=\s*["']([^"']+\.opf)["']/i)?.[1];
 if(!root||!byName.has(root))throw Error("epub_opf_missing");
 const opf=byName.get(root)!.bytes.toString("utf8"),folder=posix.dirname(root);
 if(/<!DOCTYPE|<!ENTITY/i.test(opf))throw Error("epub_opf_unsafe");
 const manifest=new Map<string,{href:string;type:string}>();
 for(const match of opf.matchAll(/<item\s+([^>]*?)\/?\s*>/gi)){
  const attrs=Object.fromEntries([...match[1].matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(x=>[x[1],x[2]]));
  if(attrs.id&&attrs.href&&attrs["media-type"])manifest.set(attrs.id,{href:attrs.href,type:attrs["media-type"]});
 }
 const ids=[...opf.matchAll(/<itemref\s+([^>]*?)\/?\s*>/gi)].map(x=>/idref\s*=\s*["']([^"']+)["']/i.exec(x[1])?.[1]).filter((v):v is string=>!!v);
 if(!ids.length)throw Error("epub_spine_empty");
 const documents:{path:string;sha256:string;length:number}[]=[],segments:string[]=[];
 for(const id of ids){
  const item=manifest.get(id);if(!item||item.type!=="application/xhtml+xml")throw Error("epub_spine_item_invalid");
  const path=posix.normalize(posix.join(folder,item.href.split("#")[0]));
  if(path.startsWith("../"))throw Error("epub_href_escape");
  const entry=byName.get(path);if(!entry)throw Error("epub_spine_file_missing");
  const txt=xhtmlToSourceText(new TextDecoder("utf-8",{fatal:true}).decode(entry.bytes));
  if(txt){segments.push(txt);documents.push({path,sha256:entry.sha256,length:entry.bytes.length});}
 }
 const text=segments.join("\n\n");
 if(text.length<100)throw Error("epub_literary_body_too_short");
 const assets=entries.filter(x=>/\.(?:png|jpe?g|gif|webp)$/i.test(x.name)).map(x=>({
  path:x.name,sha256:x.sha256,size:x.bytes.length,
  mime:/\.png$/i.test(x.name)?"image/png":/\.gif$/i.test(x.name)?"image/gif":/\.webp$/i.test(x.name)?"image/webp":"image/jpeg",
  publication_clearance:"excluded" as const
 }));
 return {schema:"artales.epub-extract.v1",epub_sha256:digest(input),text,text_sha256:digest(Buffer.from(text)),component_id:"epub:spine",documents,assets};
}
