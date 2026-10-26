import test from "node:test";
import assert from "node:assert/strict";
import {assessPublicDomain} from "../lib/legal/publicDomainCheck";
import type {GutenbergBook} from "../lib/legal/gutenbergCatalog";
const book=(death:number|null):GutenbergBook=>({id:389,title:"The Great God Pan",authors:[{name:"Machen, Arthur",died:death}],translators:[],languages:["en"],catalogUrl:"https://www.gutenberg.org/ebooks/389",files:[],readUrl:null,usCopyrightFlag:false});
const rights=(died:number|null)=>({people:[{name:"Machen, Arthur",died}],contributors:[{role:"dcterms:creator",name:"Machen, Arthur",died}],usStatus:"public_domain" as const,url:"https://www.gutenberg.org/ebooks/389.rdf",checked:true});
const text={status:"no_explicit_notice" as const,scope:"complete" as const,notice:null,translationCredit:false,sourceUrl:null,explanation:"OK"};
const epub={checked:false,imageCount:null,textChecked:false,notice:null,translationCredit:false,sourceUrl:null,reason:"Unavailable"};
const run=(death:number|null)=>assessPublicDomain({book:book(death),rights:rights(death),prescreenDeath:null,candidateAuthor:"Arthur Machen",originalPublicationYear:1894,textCheck:text,epub,year:2026});
test("historical author is green text-only when illustrations unverified",()=>{const a=run(1947);assert.equal(a.outcome,"yes_without_illustrations");assert.equal(a.text.status,"public_domain")});
test("copyright term of a living author stops work",()=>assert.equal(run(2000).outcome,"no"));
test("unknown author death is not silently passed",()=>assert.equal(run(null).outcome,"no"));
test("credited protected translator prevents text clearance",()=>{
 const r=rights(1947);r.contributors.push({role:"marcrel:trl",name:"Modern Translator",died:2000});
 assert.equal(assessPublicDomain({book:book(1947),rights:r,prescreenDeath:null,candidateAuthor:"Arthur Machen",originalPublicationYear:1894,textCheck:text,epub,year:2026}).outcome,"no");
});
test("illustrator of a newer image edition never authorizes pictures without inventory",()=>{
 const r=rights(1947);r.contributors.push({role:"marcrel:ill",name:"New Illustrator",died:2000});
 const a=assessPublicDomain({book:book(1947),rights:r,prescreenDeath:null,candidateAuthor:"Arthur Machen",originalPublicationYear:1894,textCheck:text,epub,year:2026});
 assert.equal(a.outcome,"yes_without_illustrations");
});

test("historical edited collection Lang #540 is text-only eligible without image clearance",()=>{
 const b={...book(null),id:540,title:"The Red Fairy Book",authors:[],catalogUrl:"https://www.gutenberg.org/ebooks/540"};
 const rights540={...rights(null),people:[],contributors:[{role:"marcrel:edt",name:"Lang, Andrew",died:1912}],url:"https://www.gutenberg.org/ebooks/540.rdf"};
 const a=assessPublicDomain({book:b,rights:rights540,prescreenDeath:1912,candidateAuthor:"Andrew Lang",originalPublicationYear:1890,textCheck:text,epub,year:2026});
 assert.equal(a.outcome,"yes_without_illustrations");
});
test("documented expired illustrator with image inventory permits images",()=>{
 const r=rights(1947);r.contributors.push({role:"marcrel:ill",name:"Historical Illustrator",died:1920});
 const a=assessPublicDomain({book:book(1947),rights:r,prescreenDeath:null,candidateAuthor:"Arthur Machen",originalPublicationYear:1894,textCheck:text,epub:{...epub,checked:true,imageCount:2},year:2026});
 assert.equal(a.outcome,"yes_with_illustrations");
});
test("express rights notice overrides expired author term",()=>{
 const a=assessPublicDomain({book:book(1947),rights:rights(1947),prescreenDeath:null,candidateAuthor:"Arthur Machen",originalPublicationYear:1894,textCheck:{...text,status:"possible_restriction",notice:"used by permission"},epub,year:2026});
 assert.equal(a.outcome,"no");
});
