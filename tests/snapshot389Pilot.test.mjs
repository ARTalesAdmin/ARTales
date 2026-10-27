import test from "node:test";
import assert from "node:assert/strict";
import * as pilotModule from "../lib/ingest/snapshot389Pilot.ts";
const {runSnapshot389Pilot,SNAPSHOT_389_CANDIDATE,SNAPSHOT_389_CATALOG}=pilotModule.default??pilotModule;
const actor="96c2425e-2b4e-4177-a2da-de7fa1d27256";
const url=SNAPSHOT_389_CATALOG+".epub.noimages";
const plan={
 schema:"artales.legal-snapshot-handoff.v1",
 selection:{schema:"artales.snapshot-selection.v1",candidate_id:SNAPSHOT_389_CANDIDATE,
 source_id:"2fbd2f26-89e6-464e-b048-001a8e533cc0",decision_no:9,
 catalog_url:SNAPSHOT_389_CATALOG,original_locked_url:url,chosen_url:url,
 format:"epub",selection:"locked",correspondence:"locked_file",
 source_archive_status:"not_captured",semantic_ready:false,publication_authorized:false},
 actor_id:actor,legal_territory:"CZ/EU",legal_decision_ref:`legal:${SNAPSHOT_389_CANDIDATE}:9`,
 locked_at:"2026-10-26T14:51:59.422Z",approval_recorded_at:"2026-10-26T14:51:36.162Z",
 review_status:"legal_lock_verified",binary_status:"awaiting_verified_acquisition",
 text_correspondence:"pending_binary_inspection",archive_status:"not_persisted",
 semantic_ready:false,publication_authorized:false
};
const bytes=new Uint8Array(64);
const noStorage={storage:{from(){throw Error("must not open Storage")}}};
const date="2026-10-27T08:00:00.000Z";
test("rejects another title, decision, format and unapproved source without Storage call",async()=>{
 for(const altered of [
 {...plan,selection:{...plan.selection,candidate_id:"00000000-0000-4000-8000-000000000002"}},
 {...plan,selection:{...plan.selection,decision_no:8}},
 {...plan,selection:{...plan.selection,format:"plain_text"}},
 {...plan,selection:{...plan.selection,correspondence:"pending_content_comparison"}},
 {...plan,selection:{...plan.selection,chosen_url:SNAPSHOT_389_CATALOG+".txt.utf-8"}},
 {...plan,publication_authorized:true},
 {...plan,archive_status:"sha256_verified"},
 ])await assert.rejects(()=>runSnapshot389Pilot(altered,bytes,actor,date,noStorage),/scope_refused/);
});
test("rejects different operator before archive action",async()=>{await assert.rejects(()=>runSnapshot389Pilot(plan,bytes,"00000000-0000-4000-8000-000000000002",date,noStorage),/untrusted_snapshot_intake_plan/);});
test("rejects malformed EPUB before archive action",async()=>{await assert.rejects(()=>runSnapshot389Pilot(plan,bytes,actor,date,noStorage),/not_epub_zip/);});
