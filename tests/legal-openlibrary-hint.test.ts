import test from "node:test";
import assert from "node:assert/strict";
import {extractOpenLibraryHint} from "../lib/legal/openLibraryHint";
test("matching title and author returns bibliographic evidence, not a guessed death date",()=>{
 const hint=extractOpenLibraryHint({docs:[{title:"The Great God Pan",author_name:["Arthur Machen"],first_publish_year:1894,key:"/works/OL123W"}]},"The Great God Pan","Arthur Machen");
 assert.equal(hint.matched,true);
 assert.equal(hint.firstPublishYear,1894);
 assert.equal(hint.authorDeathYear,null);
 assert.equal(hint.sourceUrl,"https://openlibrary.org/works/OL123W");
});
test("another author or title cannot supply fallback facts",()=>{
 const hint=extractOpenLibraryHint({docs:[{title:"The Great God Pan",author_name:["Someone Else"],first_publish_year:1894,key:"/works/OL123W"}]},"The Great God Pan","Arthur Machen");
 assert.equal(hint.matched,false);
});
