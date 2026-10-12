import {readFileSync} from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {assessAliceTextOnlyDraft} from "../lib/pilots/aliceTextOnlyRightsGate";
import {captureGutenbergBytes,getPg11FixtureRequest} from "../lib/ingest/gutenbergSnapshot";
import {composeSemanticPg11,verifySemanticRevision} from "../lib/semantic/compose";
import {projectSemanticReader,verifyReaderProjection} from "../lib/semantic/readerProjection";
import {planGalleryMigration} from "../lib/publication/galleryMigrationPlan";

test("real pinned Alice runs common eligibility, semantic composition and shadow gallery route",()=>{
 const checked="2026-10-12T08:00:00.000Z";
 const raw=readFileSync("tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt");
 const rights=assessAliceTextOnlyDraft(raw,checked);
 assert.equal(rights.general_rights_snapshot.decision,"eligible_for_editorial_draft");
 assert.deepEqual(rights.general_rights_snapshot.included,["pg11:work-text"]);
 assert.equal(rights.publication_authorized,false);
 const snapshot=captureGutenbergBytes(raw,getPg11FixtureRequest(checked));
 assert.equal(snapshot.bytes_sha256,rights.source_sha256);
 const {revision}=composeSemanticPg11(snapshot,{
  work_id:"11111111-1111-4111-8111-111111111111",
  work_slug:"alices-adventures-in-wonderland",chapter_only:false
 });
 verifySemanticRevision(revision);
 assert.equal(revision.blocks.filter(b=>b.kind==="chapter").length,12);
 const projection=verifyReaderProjection(revision,projectSemanticReader(revision,{
  mode:"paged",viewport_width:420,viewport_height:760,font_scale:1
 }));
 assert.ok(projection.pages>1);
 const [planned]=planGalleryMigration([{
  work_id:revision.work_id,slug:revision.work_slug,published:true,
  rights:rights.general_rights_snapshot.decision,snapshot_pinned:true,
  editorial:"in_review",reader_shadow:"ready"
 }]);
 assert.equal(planned.action,"prepare_editorial");
 assert.equal(planned.work_id,revision.work_id);
 assert.equal(planned.slug,revision.work_slug);
 assert.equal(revision.release_allowed,false);
});
test("gallery refuses automatically activating work without editorial approval",()=>{
 const [planned]=planGalleryMigration([{
  work_id:"11111111-1111-4111-8111-111111111111",
  slug:"alices-adventures-in-wonderland",published:true,
  rights:"eligible_for_editorial_draft",snapshot_pinned:true,
  editorial:"not_started",reader_shadow:"missing"
 }]);
 assert.equal(planned.action,"prepare_editorial");
});
