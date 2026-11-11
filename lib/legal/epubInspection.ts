import {inflateRawSync} from "node:zlib";
import {extractEpub} from "../ingest/epubSemanticExtractor";
import type {GutenbergBook} from "./gutenbergCatalog";
import {inspectGutenbergText,type HistoricalImprintContext,type TextRightsCheck} from "./textRightsCheck";
export type CompleteEpubTextEvidence={
 method:"epub_spine_complete";epubSha256:string;textSha256:string;
 spineDocuments:number;textCharacters:number;sourceUrl:string;
};
export type EpubInspection={
 checked:boolean;imageCount:number|null;textChecked:boolean;notice:string|null;
 translationCredit:boolean;sourceUrl:string|null;reason:string;
 fullTextCheck?:TextRightsCheck;fullTextEvidence?:CompleteEpubTextEvidence;
};
const empty=(url:string|null,reason:string):EpubInspection=>({checked:false,imageCount:null,textChecked:false,notice:null,translationCredit:false,sourceUrl:url,reason});
/** Bounded ZIP central directory walk. No extraction to filesystem, no remote redirects. */
export function inspectEpubBytes(bytes:Uint8Array):Omit<EpubInspection,"sourceUrl">{
 const fail=(reason:string)=>({...empty(null,reason),sourceUrl:undefined});
 const b=Buffer.from(bytes);
 if(b.length>5_000_000||b.length<22)return fail("EPUB překročil limit nebo není platným ZIP.");
 let end=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50){end=i;break}
 if(end<0)return fail("Chybí adresář EPUB.");
 const count=b.readUInt16LE(end+10),offset=b.readUInt32LE(end+16);
 if(count>180||offset>b.length)return fail("Příliš mnoho položek EPUB.");
 let pos=offset,images=0,total=0;
 const parts:string[]=[];
 for(let i=0;i<count;i++){
  if(pos+46>b.length||b.readUInt32LE(pos)!==0x02014b50)return fail("Neplatný adresář EPUB.");
  const method=b.readUInt16LE(pos+10),compressed=b.readUInt32LE(pos+20),plain=b.readUInt32LE(pos+24);
  const nameLength=b.readUInt16LE(pos+28),extra=b.readUInt16LE(pos+30),comment=b.readUInt16LE(pos+32);
  const local=b.readUInt32LE(pos+42);
  const next=pos+46+nameLength+extra+comment;
  if(next>b.length)return fail("Neplatná položka EPUB.");
  const name=b.subarray(pos+46,pos+46+nameLength).toString("utf8").toLowerCase();
  if(/\.(png|jpe?g|gif|svg|webp)$/i.test(name) && !/(^|\/)cover\./i.test(name))images++;
  if(/\.(xhtml|html|htm|opf|ncx)$/i.test(name)&&plain<=500_000&&total+plain<=2_000_000&&compressed<=1_000_000){
   if(local+30>b.length||b.readUInt32LE(local)!==0x04034b50)return fail("Neplatná hlavička souboru EPUB.");
   const start=local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28);
   if(start+compressed>b.length)return fail("Neúplná data EPUB.");
   try{
    const raw=b.subarray(start,start+compressed);
    const out=method===0?raw:method===8?inflateRawSync(raw,{maxOutputLength:500_001}):null;
    if(out&&out.length<=500_000){parts.push(out.toString("utf8"));total+=out.length}
   }catch{return fail("Některá textová položka EPUB nešla bezpečně přečíst.")}
  }
  pos=next;
 }
 const text=parts.join("\n");
 const checked=text.length>0?inspectGutenbergText(text,false):null;
 return {checked:true,imageCount:images,textChecked:!!checked,notice:checked?.notice??null,translationCredit:checked?.translationCredit??false,reason:"Kontrolovány dostupné textové soubory a obrazové položky v EPUB; nikoli úplnost či práva obrázků."};
}
/** Uses the SAME bounded, CRC-verified EPUB/spine extractor as composition.
 * A scan is complete only if every item in the publication spine is readable.
 * This is read-only: no archive and no editorial content mutation.
 */
export function inspectCompleteEpubText(
 bytes:Uint8Array,sourceUrl:string,context?:HistoricalImprintContext
):EpubInspection{
 try{
  const extract=extractEpub(bytes);
  const scanned=inspectGutenbergText(extract.text,true,context);
  return {
   checked:true,imageCount:extract.assets.length,textChecked:true,
   notice:scanned.notice,translationCredit:scanned.translationCredit,sourceUrl,
   reason:"Celý textový obsah EPUB (čtecí pořadí kapitol) byl prověřen.",
   fullTextCheck:{...scanned,sourceUrl},
   fullTextEvidence:{
    method:"epub_spine_complete",epubSha256:extract.epub_sha256,
    textSha256:extract.text_sha256,spineDocuments:extract.documents.length,
    textCharacters:extract.text.length,sourceUrl
   }
  };
 }catch{
  // Some Gutenberg editions cannot yet be read by the strict production
  // extractor. Never claim a complete check in that case. Keep any positive
  // notice found in the older bounded preview and offer an alternative scan.
  const partial=inspectEpubBytes(bytes);
  return {...partial,sourceUrl,reason:"Úplné čtení EPUB nebylo možné. "+
   partial.reason};
 }
}
export async function inspectGutenbergEpub(
 book:GutenbergBook,context?:HistoricalImprintContext
):Promise<EpubInspection>{
 const file=book.files.find(f=>f.format==="epub");
 if(!file)return empty(null,"EPUB není u této edice dostupný.");
 let u:URL;
 try{
  u=new URL(file.url);
  if(u.protocol!=="https:"||
     !["gutenberg.org","www.gutenberg.org","m.gutenberg.org"].includes(u.hostname)||
     u.port||u.username||u.password)
   return empty(null,"Nepovolená URL EPUB.");
 }catch{return empty(null,"Neplatná URL EPUB.")}
 try{
  // The production extractor allows up to 16 MiB compressed. Limit transfer
  // as well as decompression; do not follow redirects to arbitrary hosts.
  const maxBytes=16*1024*1024;
  const response=await fetch(u.toString(),{
   redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000)
  });
  if(!response.ok||!response.body||
     Number(response.headers.get("content-length")??0)>maxBytes)
   return empty(u.toString(),"EPUB není dostupný v povoleném limitu.");
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];
  let size=0;
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>maxBytes){
    await reader.cancel();
    return empty(u.toString(),"EPUB je příliš velký.");
   }
   chunks.push(value);
  }
  return inspectCompleteEpubText(Buffer.concat(chunks),u.toString(),context);
 }catch{
  return empty(u.toString(),"EPUB nelze bezpečně načíst nebo analyzovat.");
 }
}
