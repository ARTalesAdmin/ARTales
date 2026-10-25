import test from "node:test";
import assert from "node:assert/strict";
import { recommendEdition, type EditionEvidence } from "../lib/legal/editionRecommendation";

const base:EditionEvidence = {
 editionId:"g-older",sourceKind:"gutenberg",sourceUrl:"https://www.gutenberg.org/ebooks/1",
 downloadUrl:"https://www.gutenberg.org/ebooks/1.txt.utf-8",editionYear:1890,
 identityMatch:"confirmed",languageMatch:"matches",translationStatus:"original",translator:"",
 originalRights:"public_domain",translationRights:"not_applicable",sourceTerms:"cleared",
 evidenceUrl:"https://example.org/evidence",notes:"Reviewed original text and verified the permissions",
 textFormat:"plain_text",completeness:"complete",textQuality:"verified",images:"reference_only"
};
test("protected translation is skipped for a valid original",()=>{
 const translation={...base,editionId:"t-new",editionYear:2020,translationStatus:"translated" as const,
 translator:"Translator",translationRights:"restricted" as const};
 const chosen=recommendEdition([translation,base]);
 assert.equal(chosen.outcome,"suggested");
 assert.equal(chosen.editionId,"g-older");
 assert.deepEqual(chosen.excludedEditionIds,["t-new"]);
});
test("all protected versions produce no usable source",()=>{
 const a={...base,translationStatus:"translated" as const,translator:"T",translationRights:"restricted" as const};
 assert.equal(recommendEdition([a]).outcome,"no_usable_source");
});
test("unknown translation rights escalates rather than rejects",()=>{
 const a={...base,translationStatus:"translated" as const,translator:"T",translationRights:"unknown" as const};
 assert.equal(recommendEdition([a]).outcome,"manual_review");
});
test("usable illustrated and text-only versions are both eligible",()=>{
 const art={...base,editionId:"g-art",images:"publishable" as const};
 const res=recommendEdition([base,art]);
 assert.equal(res.outcome,"suggested");
 assert.equal(res.editionId,"g-art");
});
test("newer edition wins only where usability is equal",()=>{
 const older={...base,editionId:"old",editionYear:1880};
 const newer={...base,editionId:"new",editionYear:1905};
 assert.equal(recommendEdition([older,newer]).editionId,"new");
});
test("no download file means no automated recommendation",()=>{
 assert.equal(recommendEdition([{...base,downloadUrl:null}]).outcome,"manual_review");
});
