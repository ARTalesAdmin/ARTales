import test from "node:test";import assert from "node:assert/strict";
import {inspectGutenbergText} from "../lib/legal/textRightsCheck";
import {legalFacts} from "../lib/legal/automaticAssessment";
import type {GutenbergBook} from "../lib/legal/gutenbergCatalog";
test("ignore generic Gutenberg wrapper, detect actual explicit rights notice",()=>{
 const plain="*** START OF THE PROJECT GUTENBERG EBOOK 540 ***\nA fairy tale.\n*** END OF THE PROJECT GUTENBERG EBOOK 540 ***\nProject Gutenberg trademark licence";
 assert.equal(inspectGutenbergText(plain).status,"no_explicit_notice");
 assert.equal(inspectGutenbergText("*** START OF THE PROJECT GUTENBERG EBOOK 540 ***\nCopyright 1998 Jane Doe. All rights reserved.\n*** END OF THE PROJECT GUTENBERG EBOOK 540 ***").status,"possible_restriction");
});
test("Prescreen death year is reused when OPDS omits authors",()=>{
 const b:GutenbergBook={id:540,title:"The Red Fairy Book",authors:[],translators:[],languages:["en"],catalogUrl:"https://www.gutenberg.org/ebooks/540",files:[],readUrl:null,usCopyrightFlag:null};
 assert.equal(legalFacts(b,2026,1912).author.status,"likely_public_domain");
 assert.equal(legalFacts(b,2026,null).author.status,"needs_evidence");
});
