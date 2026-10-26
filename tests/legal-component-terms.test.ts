import test from "node:test";
import assert from "node:assert/strict";
import {legalFacts} from "../lib/legal/automaticAssessment";
import type {GutenbergBook} from "../lib/legal/gutenbergCatalog";
const book=(died:number|null,translators:GutenbergBook["translators"]=[]):GutenbergBook=>({
 id:389,title:"The Great God Pan",authors:[{name:"Machen, Arthur",died}],translators,
 languages:["en"],files:[],readUrl:null,catalogUrl:"https://www.gutenberg.org/ebooks/389",usCopyrightFlag:null
});
test("Prescreen year supplements an identified creator missing death year",()=>{
 const result=legalFacts(book(null),2026,1947);
 assert.equal(result.author.status,"likely_public_domain");
 assert.equal(result.author.people[0].died,1947);
 assert.equal(result.translation.status,"not_identified");
});
test("A credited living translator must not be cleared by the original creator's term",()=>{
 const result=legalFacts(book(1947,[{name:"Modern translator",died:2000}]),2026);
 assert.equal(result.author.status,"likely_public_domain");
 assert.equal(result.translation.status,"protected");
 assert.equal(result.verdict,"escalate");
});
test("No translator credit plus English language is not proof of original edition",()=>{
 assert.equal(legalFacts(book(1947),2026).translation.status,"not_identified");
});
test("Illustrators are assessed separately, without blocking text eligibility",()=>{
 const result=legalFacts(book(1947),2026,null,{illustrators:[{name:"Illustrator",died:2000}],originalLanguageConfirmed:true,usStatus:"public_domain"});
 assert.equal(result.illustrations.status,"protected");
 assert.equal(result.verdict,"text_candidate");
 assert.equal(result.source.status,"us_public_domain");
});
