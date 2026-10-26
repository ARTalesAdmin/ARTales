import test from 'node:test';
import assert from 'node:assert/strict';
import * as handoffModule from '../lib/ingest/verifiedLegalSnapshotHandoff.ts';
// The .mjs test runs in native ESM while tsx may expose a TypeScript CJS module as default.
const {planLockedSnapshot,inspectOperatorProvidedSource}=handoffModule.default ?? handoffModule;
const catalog='https://www.gutenberg.org/ebooks/389';
const url=catalog+'.epub.noimages';
const other=catalog+'.txt.utf-8';
const cid='98508359-bce1-4e73-b842-b69a9d1112d0';
const sid='2fbd2f26-89e6-464e-b048-001a8e533cc0';
const admin='96c2425e-2b4e-4177-a2da-de7fa1d27256';
const book={id:389,title:'The Great God Pan',authors:[{name:'Machen, Arthur',died:1947}],translators:[],catalogUrl:catalog,languages:['en'],files:[{url,label:'EPUB',format:'epub'},{url:other,label:'TXT',format:'plain_text'}],readUrl:null,usCopyrightFlag:null};
const packet={actor:{id:admin,role:'admin',is_active:true},candidate:{id:cid,proposed_title:'The Great God Pan',proposed_author_name:'Arthur Machen'},source:{id:sid,candidate_id:cid,source_kind:'gutenberg',edition_title:'The Great God Pan',source_url:catalog,download_url:url,identity_match:'confirmed',language_match:'matches',text_format:'epub',language_code:'en'},approved:{decision_no:9,candidate_id:cid,source_id:sid,verdict:'approved',territory:'CZ/EU',recorded_at:'2026-10-26 14:51:36.162047+00',reviewed_by:admin},lock:{candidate_id:cid,source_id:sid,decision_no:9,source_url:catalog,download_url:url,source_facts:{kind:'gutenberg',edition:'The Great God Pan',language:'en',identityMatch:'confirmed',languageMatch:'matches',originalRights:'public_domain',sourceTerms:'cleared',translationRights:'not_applicable',translationStatus:'original',textFormat:'epub'},illustrations:[],locked_at:'2026-10-26 14:51:59.422665+00',locked_by:admin}};
const plan=()=>planLockedSnapshot(packet,book);
const txt=Buffer.from('*** START OF THE PROJECT GUTENBERG EBOOK THE GREAT GOD PAN ***\nThe original work is preserved.\n*** END OF THE PROJECT GUTENBERG EBOOK ***\n');
test('live #389 approved lock connects identity, source and admin without persistence',()=>{
 const p=plan();assert.equal(p.legal_decision_ref,`legal:${cid}:9`);assert.equal(p.legal_territory,'CZ/EU');
 assert.equal(p.review_status,'legal_lock_verified');assert.equal(p.binary_status,'awaiting_verified_acquisition');
 assert.equal(p.archive_status,'not_persisted');assert.equal(p.semantic_ready,false);assert.equal(p.publication_authorized,false);
});
test('same Gutenberg work alternative remains pending comparison, not legal re-check',()=>{
 const p=planLockedSnapshot(packet,book,other);assert.equal(p.selection.format,'plain_text');assert.equal(p.selection.correspondence,'pending_content_comparison');
 assert.equal(p.legal_decision_ref,`legal:${cid}:9`);
});
test('admin role, identity and verdict are hard gates',()=>{
 for(const change of [{actor:{...packet.actor,role:'editor'}},{actor:{...packet.actor,is_active:false}},{approved:{...packet.approved,verdict:'needs_evidence'}},{approved:{...packet.approved,territory:'US'}},{approved:{...packet.approved,candidate_id:'00000000-0000-4000-8000-000000000001'}}])
 assert.throws(()=>planLockedSnapshot({...packet,...change},book));
});
test('cannot borrow another edition, translator or author or mismatched source',()=>{
 assert.throws(()=>planLockedSnapshot(packet,{...book,title:'Other Book'}));
 assert.throws(()=>planLockedSnapshot(packet,{...book,authors:[{name:'John Doe',died:null}]}));
 assert.throws(()=>planLockedSnapshot(packet,{...book,translators:[{name:'Protected Translator',died:null}]}));
 assert.throws(()=>planLockedSnapshot({...packet,source:{...packet.source,download_url:catalog+'.txt'}},book));
 assert.throws(()=>planLockedSnapshot({...packet,source:{...packet.source,source_kind:'other'}},book));
});
test('decision must precede immutable legal lock',()=>{
 assert.throws(()=>planLockedSnapshot({...packet,approved:{...packet.approved,recorded_at:'2026-10-26T14:52:00.000Z'}},book));
 assert.throws(()=>planLockedSnapshot({...packet,approved:{...packet.approved,decision_no:8}},book));
});
test('operator file is captured as raw unverified evidence, not auto approved',()=>{
 const p=planLockedSnapshot(packet,book,other),c=inspectOperatorProvidedSource(p,txt,admin,'2026-10-26T19:50:00.000Z');
 assert.equal(c.captured.manifest.selection.decision_no,9);assert.equal(c.captured.manifest.archive_ready,true);
 assert.equal(c.acquisition_verified,false);assert.equal(c.edition_text_comparison,'pending');
 assert.equal(c.archive_status,'not_persisted');assert.equal(c.semantic_ready,false);assert.equal(c.publication_authorized,false);
});
test('a different caller cannot launder uploaded file as approved',()=>{
 const p=planLockedSnapshot(packet,book,other);
 assert.throws(()=>inspectOperatorProvidedSource(p,txt,'00000000-0000-4000-8000-000000000001','2026-10-26T19:50:00.000Z'));
 assert.throws(()=>inspectOperatorProvidedSource({...p,archive_status:'sha256_verified'},txt,admin,'2026-10-26T19:50:00.000Z'));
});