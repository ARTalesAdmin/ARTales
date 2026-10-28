import test from "node:test";
import assert from "node:assert/strict";
import * as mod from "../lib/ingest/gutenbergSnapshotAcquisition.ts";
const {proposeGutenbergSnapshotAcquisition:p}=mod.default??mod;
const id="98508359-bce1-4e73-b842-b69a9d1112d0";
const source="2fbd2f26-89e6-464e-b048-001a8e533cc0";
const url="https://www.gutenberg.org/ebooks/389";
const file=url+".epub.noimages";
const plan={schema:"artales.legal-snapshot-handoff.v1",actor_id:"96c2425e-2b4e-4177-a2da-de7fa1d27256",legal_territory:"CZ/EU",legal_decision_ref:`legal:${id}:9`,review_status:"legal_lock_verified",archive_status:"not_persisted",binary_status:"awaiting_verified_acquisition",semantic_ready:false,publication_authorized:false,selection:{candidate_id:id,source_id:source,decision_no:9,catalog_url:url,original_locked_url:file,chosen_url:file,format:"epub",selection:"locked"}};
const book={id:389,catalogUrl:url,files:[{url:file,format:"epub"}]};
test("produces a fixed-host per-title acquisition proposal without rights escalation",()=>{const x=p(plan,book);assert.equal(x.acquisitionUrl,"https://gutenberg.pglaf.org/cache/epub/389/pg389.epub");assert.equal(x.editionCorrespondence,"pending");assert.equal(x.semanticReady,false);assert.equal(x.publicationAuthorized,false)});
test("refuses changed legal decision, catalog and unsupported format",()=>{
for(const [x,b] of [[{...plan,legal_decision_ref:"legal:other:9"},book],[plan,{...book,id:390}],[{...plan,selection:{...plan.selection,format:"plain_text"}},book],[{...plan,selection:{...plan.selection,selection:"same_record_alternative",chosen_url:url+".html"}},book]])assert.throws(()=>p(x,b));
});
test("resolves another verified Gutenberg number without a hardcoded #389",()=>{
 const newUrl="https://www.gutenberg.org/ebooks/11";
 const newPlan={...plan,selection:{...plan.selection,catalog_url:newUrl,original_locked_url:newUrl+".epub.noimages",chosen_url:newUrl+".epub.noimages"}};
 const x=p(newPlan,{id:11,catalogUrl:newUrl,files:[{url:newUrl+".epub.noimages",format:"epub"}]});
 assert.equal(x.gutenbergId,11);
 assert.equal(x.acquisitionUrl,"https://gutenberg.pglaf.org/cache/epub/11/pg11.epub");
});
