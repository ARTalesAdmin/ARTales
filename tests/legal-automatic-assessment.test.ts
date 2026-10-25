import test from "node:test";
import assert from "node:assert/strict";
import {legalFacts,matchBook} from "../lib/legal/automaticAssessment";
import type {GutenbergBook} from "../lib/legal/gutenbergCatalog";
const b:GutenbergBook={id:540,title:"The Red Fairy Book",authors:[{name:"Lang, Andrew",died:1912}],translators:[],languages:["en"],catalogUrl:"https://www.gutenberg.org/ebooks/540",files:[{url:"https://www.gutenberg.org/ebooks/540.txt.utf-8",label:"TXT",format:"plain_text"}],readUrl:null,usCopyrightFlag:null};
test("screen must not offer unrelated fairy books",()=>{
 assert.equal(matchBook(b,"The Red Fairy Book","Andrew Lang"),true);
 assert.equal(matchBook({...b,title:"The Blue Fairy Book"},"The Red Fairy Book","Andrew Lang"),false);
 assert.equal(matchBook({...b,title:"The Red Fairy Book",authors:[{name:"Someone Else",died:1900}]},"The Red Fairy Book","Andrew Lang"),false);
});
test("metadata can suggest but never legally clear unidentified translation or illustrations",()=>{
 const f=legalFacts(b);
 assert.equal(f.author.status,"likely_public_domain");
 assert.equal(f.translation.status,"not_identified");
 assert.equal(f.illustrations.status,"needs_evidence");
 assert.equal(f.verdict,"review_required");
});
test("living copyright is blocked, unknown biography is escalated",()=>{
 assert.equal(legalFacts({...b,authors:[{name:"Recent",died:2020}]}).author.status,"protected");
 assert.equal(legalFacts({...b,authors:[]}).author.status,"needs_evidence");
});
