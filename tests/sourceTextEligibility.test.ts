import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {screenCapturedTextRights,parseGutenbergHeader,type TextRightsInput} from "../lib/rights/sourceTextEligibility";
import {inspectTextRightsDraftHandoff,type CaptureEnvelope} from "../lib/candidateDraftHandoffGate";
const sha=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex");
const body="Title: Fiction\nAuthor: Old Writer\nTranslator: Modern Translator\nLanguage: English\n*** START OF THE PROJECT GUTENBERG EBOOK FICTION ***\nCHAPTER I\nExample text\n*** END OF THE PROJECT GUTENBERG EBOOK FICTION ***\n";
const bytes=Buffer.from(body,"utf8");
const author={name:"Old Writer",death_year:1850,living:false,evidence_url:"https://example.org/author"};
const translator={name:"Modern Translator",death_year:null,living:true,evidence_url:"https://example.org/translator"};
const start=body.indexOf("CHAPTER I"),end=body.indexOf("*** END");
const base:TextRightsInput={candidate_id:"qa:test",original_authors:[author],original_language:"de",
 selected_language:"en",version:"translation",translators:[translator],edition_contribution:"none",
 source:{provider:"gutenberg",uri:"https://www.gutenberg.org/ebooks/100",archive_ref:"test:sha",
  captured_at:"2026-10-11T18:00:00.000Z",sha256:sha(bytes),bytes,
  us_rights:{status:"public_domain",basis:"gutenberg_catalog",evidence_url:"https://www.gutenberg.org/ebooks/100",selected_version_publication_year:1910,first_published_in_us:true},
  rights_notices:[]},
 components:[{id:"wrapper",kind:"SOURCE_WRAPPER",byte_start:0,byte_end:start},
 {id:"translation",kind:"TRANSLATION",byte_start:start,byte_end:end},
 {id:"tail",kind:"SOURCE_WRAPPER",byte_start:end,byte_end:bytes.length},
 {id:"illustration",kind:"ASSET",byte_start:null,byte_end:null}]};
test("living translator blocks selected edition despite expired original",()=>{
 const q=screenCapturedTextRights(base,"2026-10-11T19:00:00.000Z");
 assert.equal(q.eu_original_status,"term_expired");
 assert.equal(q.decision,"find_alternative_source");
 assert.equal(q.included.length,0);
 assert.equal(q.publication_authorized,false);
});
test("expired translator enables selected translation while excluding images",()=>{
 const q=screenCapturedTextRights({...base,translators:[{...translator,living:false,death_year:1901}]},
  "2026-10-11T19:00:00.000Z");
 assert.equal(q.decision,"eligible_for_editorial_draft",JSON.stringify(q.reason_codes));
 assert.deepEqual(q.included,["translation"]);
 assert.ok(q.excluded.includes("illustration"));
 assert.equal(q.components.find(c=>c.id==="translation")?.sha256,sha(bytes.subarray(start,end)));
});
test("missing translator facts and newer inseparable edition fail closed",()=>{
 assert.equal(screenCapturedTextRights({...base,translators:[]},"2026-10-11T19:00:00.000Z").decision,"needs_facts");
 assert.equal(screenCapturedTextRights({...base,edition_contribution:"inseparable"},"2026-10-11T19:00:00.000Z").decision,"find_alternative_source");
});
test("tampering and incomplete or overlapped ranges are refused",()=>{
 assert.throws(()=>screenCapturedTextRights({...base,source:{...base.source,bytes:Buffer.from("wrong")}},"2026-10-11T19:00:00.000Z"),/source snapshot/);
 assert.throws(()=>screenCapturedTextRights({...base,components:base.components.slice(1)},"2026-10-11T19:00:00.000Z"),/coverage/);
 assert.throws(()=>screenCapturedTextRights({...base,components:[...base.components,{...base.components[0]}]},"2026-10-11T19:00:00.000Z"),/duplicate/);
});
test("USA rights uncertainty, express prohibition and modern US first publication stop eligibility",()=>{
 const cleared={...base,translators:[{...translator,living:false,death_year:1901}]};
 const unknown=screenCapturedTextRights({...cleared,source:{...base.source,us_rights:{...base.source.us_rights,status:"unknown"}}},"2026-10-11T19:00:00.000Z");
 assert.equal(unknown.decision,"needs_facts");
 const forbidden=screenCapturedTextRights({...cleared,source:{...base.source,rights_notices:[{scope:"translation",kind:"no_reuse",excerpt:"No reuse allowed",evidence_url:"https://example.org/notice"}]}},"2026-10-11T19:00:00.000Z");
 assert.equal(forbidden.decision,"find_alternative_source");
 const recent=screenCapturedTextRights({...cleared,source:{...base.source,us_rights:{status:"public_domain",basis:"first_us_publication",evidence_url:"https://example.org/pub",selected_version_publication_year:2001,first_published_in_us:true}}},"2026-10-11T19:00:00.000Z");
 assert.equal(recent.decision,"needs_facts");
});
test("header extractor reads machine credits but does not invent legal clearance",()=>{
 const h=parseGutenbergHeader(bytes);
 assert.equal(h.author,"Old Writer");
 assert.equal(h.translator,"Modern Translator");
 assert.equal(h.language,"en");
});

test("canonical captured handoff requires exact legal snapshot, identity and text inclusion",()=>{
 const checkedAt="2026-10-11T19:00:00.000Z";
 const q=screenCapturedTextRights({...base,translators:[{...translator,living:false,death_year:1901}]},checkedAt);
 const capture:CaptureEnvelope={
  candidateId:base.candidate_id,candidateSourceId:"qa:source",snapshotSetRef:"sha256:"+q.source_sha256,
  capturedAt:q.captured_at,sourceSha256:q.source_sha256,inventoryComplete:true,
  attestationVerified:true,provenanceReviewedAt:checkedAt,sourceUpdatedAt:q.captured_at,
  components:q.components.filter(x=>x.sha256!==null).map(x=>({
   componentId:x.id,kind:x.kind==="TRANSLATION"?"TRANSLATION":x.kind==="SOURCE_WRAPPER"?"SOURCE_WRAPPER":"ASSET",
   sha256:x.sha256!,archiveRef:"qa:source#"+x.id,included:q.included.includes(x.id),
   decision:q.included.includes(x.id)?"usable" as const:"exclude" as const,
   evidenceSha256:q.included.includes(x.id)?x.sha256!:undefined,
   rightsReviewedAt:q.included.includes(x.id)?checkedAt:undefined,
  }))
 };
 assert.equal(inspectTextRightsDraftHandoff(capture,q).eligibleForDraftHandoff,false,
  "Existing handoff requires WORK_CONTENT: translation adapter must explicitly account for it");
 assert.equal(inspectTextRightsDraftHandoff({...capture,components:capture.components.map(x=>
  x.componentId==="translation"?{...x,kind:"WORK_CONTENT" as const}:x)},q).eligibleForDraftHandoff,true);
 assert.equal(inspectTextRightsDraftHandoff({...capture,sourceSha256:"f".repeat(64)},q).eligibleForDraftHandoff,false);
 assert.equal(inspectTextRightsDraftHandoff({...capture,components:capture.components.map(x=>
  x.componentId==="wrapper"?{...x,included:true}:x)},q).eligibleForDraftHandoff,false);
});
