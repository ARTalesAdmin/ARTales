import test from "node:test";
import assert from "node:assert/strict";
import {getGutenbergBook} from "../lib/legal/gutenbergCatalog";

/** Only synthetic responses; no network or provider credentials. */
test("one transient Gutendex 503 is retried after official OPDS is unavailable",async()=>{
 const previous=globalThis.fetch;
 let gutendexCalls=0;
 let officialCalls=0;
 globalThis.fetch=async(input)=>{
  const url=String(input);
  if(url==="https://www.gutenberg.org/ebooks/389.opds"){
   officialCalls++;
   return new Response("Unavailable",{status:503});
  }
  if(url==="https://gutendex.com/books/389/"){
   gutendexCalls++;
   if(gutendexCalls===1)return new Response("Transient",{status:503});
   return Response.json({id:389,title:"The Great God Pan",
    authors:[{name:"Machen, Arthur",death_year:1947}],translators:[],
    languages:["en"],formats:{
     "application/epub+zip":"https://www.gutenberg.org/ebooks/389.epub.noimages"
    }});
  }
  throw Error("unexpected outbound catalog URL: "+url);
 };
 try{
  const book=await getGutenbergBook(389);
  assert.equal(book?.id,389);
  assert.equal(book?.files[0]?.format,"epub");
  assert.equal(officialCalls,1);
  assert.equal(gutendexCalls,2);
 }finally{globalThis.fetch=previous;}
});
test("nontransient 404 does not cause extra provider requests",async()=>{
 const previous=globalThis.fetch;
 let gutendexCalls=0;
 globalThis.fetch=async(input)=>{
  const url=String(input);
  if(url==="https://www.gutenberg.org/ebooks/390.opds")
   return new Response("Not Found",{status:404});
  if(url==="https://gutendex.com/books/390/"){
   gutendexCalls++;
   return new Response("Not Found",{status:404});
  }
  throw Error("unapproved outbound URL");
 };
 try{
  assert.equal(await getGutenbergBook(390),null);
  assert.equal(gutendexCalls,1);
 }finally{globalThis.fetch=previous;}
});
