import test from "node:test";
import assert from "node:assert/strict";
import {inspectEpubBytes} from "../lib/legal/epubInspection";
function zipOne(name:string,content:string){
 const n=Buffer.from(name),body=Buffer.from(content);
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt32LE(body.length,18);local.writeUInt32LE(body.length,22);local.writeUInt16LE(n.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt32LE(body.length,20);central.writeUInt32LE(body.length,24);central.writeUInt16LE(n.length,28);
 const offset=local.length+n.length+body.length;
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+n.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([local,n,body,central,n,end]);
}
test("EPUB inventory accepts a bounded local ZIP without extracting files",()=>{
 const result=inspectEpubBytes(zipOne("OEBPS/chapter.xhtml","<p>Original text without special notices.</p>"));
 assert.equal(result.checked,true);assert.equal(result.imageCount,0);assert.equal(result.textChecked,true);
});
test("Malformed EPUB is not silently cleared",()=>{
 assert.equal(inspectEpubBytes(Buffer.from("not a zip")).checked,false);
});
