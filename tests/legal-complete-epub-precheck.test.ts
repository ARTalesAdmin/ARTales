import test from "node:test";
import assert from "node:assert/strict";
import {inspectCompleteEpubText} from "../lib/legal/epubInspection";
import {inspectGutenbergText} from "../lib/legal/textRightsCheck";
import {createHash} from "node:crypto";

function crc32(bytes:Buffer):number{
 let c=0xffffffff;
 for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}
 return (c^0xffffffff)>>>0;
}
function zip(entries:Array<[string,string]>):Buffer{
 const files:Buffer[]=[],central:Buffer[]=[];let offset=0;
 for(const [name,value] of entries){
  const n=Buffer.from(name),data=Buffer.from(value),crc=crc32(data);
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
  local.writeUInt16LE(0,8);local.writeUInt32LE(crc,14);
  local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);
  local.writeUInt16LE(n.length,26);
  files.push(local,n,data);
  const c=Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);
  c.writeUInt16LE(20,6);c.writeUInt16LE(0,10);
  c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);
  c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);
  c.writeUInt32LE(offset,42);
  central.push(c,n);
  offset+=local.length+n.length+data.length;
 }
 const c=Buffer.concat(central),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);
 end.writeUInt16LE(entries.length,10);end.writeUInt32LE(c.length,12);
 end.writeUInt32LE(offset,16);
 return Buffer.concat([...files,c,end]);
}
function epub(lastChapter:string){
 const first="<html><body><p>*** START OF THE PROJECT GUTENBERG EBOOK SAMPLE ***</p><p>CHAPTER I — "+
  "A historical novel page of ordinary prose. ".repeat(15)+"</p></body></html>";
 const files:[string,string][]=[
  ["mimetype","application/epub+zip"],
  ["META-INF/container.xml",'<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>'],
  ["OEBPS/content.opf",'<package><manifest><item id="a" href="first.xhtml" media-type="application/xhtml+xml"/><item id="b" href="second.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>'],
  ["OEBPS/first.xhtml",first],
  ["OEBPS/second.xhtml","<html><body><p>"+lastChapter+"</p><p>*** END OF THE PROJECT GUTENBERG EBOOK SAMPLE ***</p></body></html>"]
 ];
 return zip(files);
}
const url="https://www.gutenberg.org/ebooks/1065.epub.noimages";
test("complete EPUB scan visits all spine chapters and persists both hashes",()=>{
 const bytes=epub("A long, ordinary final chapter, with no extra copyright restrictions.");
 const checked=inspectCompleteEpubText(bytes,url);
 assert.equal(checked.checked,true);
 assert.equal(checked.fullTextCheck?.status,"no_explicit_notice");
 assert.equal(checked.fullTextCheck?.scope,"complete");
 assert.equal(checked.fullTextEvidence?.method,"epub_spine_complete");
 assert.equal(checked.fullTextEvidence?.spineDocuments,2);
 assert.equal(checked.fullTextEvidence?.epubSha256,createHash("sha256").update(bytes).digest("hex"));
 assert.match(checked.fullTextEvidence?.textSha256??"",/^[0-9a-f]{64}$/);
});
test("restriction in the last chapter is detected by complete scan",()=>{
 const checked=inspectCompleteEpubText(epub("Reprinted by permission of the publisher."),url);
 assert.equal(checked.fullTextCheck?.status,"possible_restriction");
 assert.match(checked.notice??"",/Reprinted by permission/);
});
test("a translator credited in the last chapter is detected",()=>{
 const checked=inspectCompleteEpubText(epub("Translated by Somebody in 1920."),url);
 assert.equal(checked.translationCredit,true);
 assert.equal(checked.fullTextCheck?.scope,"complete");
});
test("malformed EPUB never receives full coverage or a text hash",()=>{
 const checked=inspectCompleteEpubText(Buffer.from("not an epub"),url);
 assert.equal(checked.fullTextCheck,undefined);
 assert.equal(checked.fullTextEvidence,undefined);
 assert.equal(checked.textChecked,false);
});
test("partial scan is not a completed legal check",()=>{
 const t=inspectGutenbergText("A historic text.",false);
 assert.equal(t.status,"not_checked");
 assert.equal(t.scope,"partial");
});
