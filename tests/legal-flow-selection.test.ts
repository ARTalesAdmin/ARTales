import test from "node:test";
import assert from "node:assert/strict";
import {selectLegalReviewRun,type LegalReviewRun} from "../lib/legal/reviewHistory";
const example=(decisionNo:number):LegalReviewRun=>({
 decisionNo,sourceId:"source-"+decisionNo,recordedAt:"2026-11-09T09:51:56Z",
 edition:"Synthetic Gutenberg title "+decisionNo,summary:"",
 downloadUrl:"https://www.gutenberg.org/cache/epub/10007/pg10007.epub",
 sourceUrl:"https://www.gutenberg.org/ebooks/10007",
 outcome:"yes_without_illustrations",approvalBlockers:[]
});
test("a just-created automatic legal check is selected after server refresh",()=>{
 const before:LegalReviewRun[]=[];
 const after=[example(17)];
 assert.equal(selectLegalReviewRun(before,""),undefined);
 assert.equal(selectLegalReviewRun(after,"")?.decisionNo,17);
});
test("newest legal audit becomes default and explicit older audit stays explicit",()=>{
 const checks=[example(21),example(17),example(14)];
 assert.equal(selectLegalReviewRun(checks,"")?.decisionNo,21);
 assert.equal(selectLegalReviewRun(checks,"17")?.decisionNo,17);
 assert.equal(selectLegalReviewRun(checks,"19"),undefined);
});
test("the legal selection rule is independent of title, author and Gutenberg ID",()=>{
 for(const n of [389,540,10007,99999]){
  const check={...example(n),edition:"Edition "+n,
   sourceUrl:"https://www.gutenberg.org/ebooks/"+n};
  assert.equal(selectLegalReviewRun([check],"")?.sourceUrl,check.sourceUrl);
 }
});
