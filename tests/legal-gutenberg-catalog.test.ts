import test from "node:test";
import assert from "node:assert/strict";
import {parseGutenbergBook} from "../lib/legal/gutenbergCatalog";
test("exact approved-host text files are retained, other hosts rejected",()=>{
 const book=parseGutenbergBook({id:11,title:"A",authors:[{name:"A",death_year:1881}],
  translators:[],formats:{"text/plain; charset=utf-8":"https://www.gutenberg.org/ebooks/11.txt.utf-8",
  "text/html":"https://evil.invalid/test.html","application/epub+zip":"https://www.gutenberg.org/ebooks/11.epub"}});
 assert.ok(book);assert.equal(book.files.length,2);assert.equal(book.authors[0].died,1881);
 assert.equal(book.usCopyrightFlag,null);
});
test("metadata is not legal permission",()=>{
 const book=parseGutenbergBook({id:12,title:"Another",copyright:false,authors:[],translators:[],formats:{}});
 assert.ok(book);assert.equal(book.usCopyrightFlag,false);assert.equal(book.files.length,0);
});
test("reject unexpected Gutenberg id and protocol",()=>{
 assert.equal(parseGutenbergBook({id:"1",title:"Bad"}),null);
 const book=parseGutenbergBook({id:1,title:"OK",formats:{"text/plain":"http://www.gutenberg.org/1.txt"}});
 assert.ok(book);assert.equal(book.files.length,0);
});
