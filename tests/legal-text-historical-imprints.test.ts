import test from "node:test";
import assert from "node:assert/strict";
import {inspectGutenbergText} from "../lib/legal/textRightsCheck";
const context={approvedOriginalPublicationYear:1871,currentYear:2026};
const scan=(body:string,ctx:{approvedOriginalPublicationYear:number|null;currentYear:number}=context)=>inspectGutenbergText(`*** START OF THE PROJECT GUTENBERG EBOOK TEST ***\n${body}\n*** END OF THE PROJECT GUTENBERG EBOOK TEST ***`,true,ctx);
test("historical copyright on original title page is retained as evidence and does not block",()=>{
 const check=scan("Carmilla\nBy J. Sheridan Le Fanu\nCopyright 1872\n\nChapter I\nAn old literary narrative.");
 assert.equal(check.status,"no_explicit_notice");
 assert.deepEqual(check.historicalImprints,["Copyright 1872"]);
 assert.equal(check.translationCredit,false);
});
test("without approved original edition year the identical line is held",()=>{
 const check=scan("Copyright 1872\nThe text",{
  approvedOriginalPublicationYear:null,currentYear:2026
 });
 assert.equal(check.status,"possible_restriction");
 assert.equal(check.notice,"Copyright 1872");
});
test("recent copyright and reproduction prohibition remain blocking",()=>{
 for(const sample of [
  "Copyright 2024",
  "Copyright 1872. All rights reserved",
  "Copyright 1872 by a modern editor",
  "Copyright 1872\nReprinted by permission",
  "Copyright 1872\nReproduction prohibited",
  "Copyright 1990"
 ]){
  const check=scan(sample);
  assert.equal(check.status,"possible_restriction",sample);
 }
});
test("only early standalone imprint with compatible year can be treated as historical",()=>{
 const late="A".repeat(12010)+"\nCopyright 1872";
 assert.equal(scan(late).status,"possible_restriction");
 assert.equal(scan("Copyright 1910").status,"possible_restriction");
 assert.equal(scan("Copyright 1872",{approvedOriginalPublicationYear:1900,currentYear:2026}).status,"possible_restriction");
});
test("translation credit remains a hold even when historical imprint is cleared",()=>{
 const checked=scan("Copyright 1872\nTranslated by a modern translator");
 assert.equal(checked.status,"no_explicit_notice");
 assert.equal(checked.translationCredit,true);
});
test("any subsequent modern notice defeats a historical imprint",()=>{
 const checked=scan("Copyright 1872\n\nChapter\nNew edition copyright 2018");
 assert.equal(checked.status,"possible_restriction");
 assert.equal(checked.notice,"copyright 2018");
 assert.deepEqual(checked.historicalImprints,["Copyright 1872"]);
});
