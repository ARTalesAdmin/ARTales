import test from "node:test";
import assert from "node:assert/strict";
import {getGutenbergRights} from "../lib/legal/gutenbergRights";
import {getGutenbergBook,searchGutenberg} from "../lib/legal/gutenbergCatalog";

test("live Gutenberg title and exact files: The Great God Pan", {timeout:45000},async()=>{
 const books=await searchGutenberg("The Great God Pan","Arthur Machen");
 const found=books.find(b=>b.id===389);
 assert.ok(found,"Search must return Gutenberg #389");
 const detail=await getGutenbergBook(389);
 assert.ok(detail,"Gutenberg #389 details must be resolvable");
 assert.ok(detail.files.length>0,"Gutenberg #389 must have at least one exact machine-readable file URL");
});

test("live Gutenberg RDF: Arthur Machen death 1947", {timeout:45000},async()=>{
 const book=await getGutenbergBook(389);
 assert.ok(book);
 const rights=await getGutenbergRights(book);
 assert.equal(rights.checked,true,"Gutenberg RDF must be reachable");
 assert.ok([...rights.people,...rights.contributors].some(p=>p.name.toLowerCase().includes("machen")&&p.died===1947),"Machen death date must be read from authoritative record");
});
