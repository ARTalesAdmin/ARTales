import test from "node:test";
import assert from "node:assert/strict";
import {getGutenbergBook,searchGutenberg} from "../lib/legal/gutenbergCatalog";

test("live Gutenberg title and exact files: The Great God Pan", {timeout:45000},async()=>{
 const books=await searchGutenberg("The Great God Pan","Arthur Machen");
 const found=books.find(b=>b.id===389);
 assert.ok(found,"Search must return Gutenberg #389");
 const detail=await getGutenbergBook(389);
 assert.ok(detail,"Gutenberg #389 details must be resolvable");
 assert.ok(detail.files.length>0,"Gutenberg #389 must have at least one exact machine-readable file URL");
});
