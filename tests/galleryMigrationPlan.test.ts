import test from "node:test";
import assert from "node:assert/strict";
import {planGalleryMigration,type GalleryMigrationCandidate} from "../lib/publication/galleryMigrationPlan";
const alice:GalleryMigrationCandidate={work_id:"alice-id",slug:"alice",published:true,
 rights:"eligible_for_editorial_draft",snapshot_pinned:true,editorial:"approved",reader_shadow:"ready"};
test("bulk planning never implies bulk release and preserves identity",()=>{
 const result=planGalleryMigration([alice,{...alice,work_id:"other-id",slug:"other",editorial:"in_review",reader_shadow:"missing"}]);
 assert.equal(result[0].action,"ready_for_release_review");
 assert.equal(result[1].action,"prepare_editorial");
 assert.equal(result[0].work_id,alice.work_id);
 assert.equal(result[0].slug,alice.slug);
});
test("unusable edition, unpinned source and unpublished work hold independently",()=>{
 const blocked=planGalleryMigration([{...alice,rights:"find_alternative_source"},
  {...alice,work_id:"b",slug:"b",snapshot_pinned:false},
  {...alice,work_id:"c",slug:"c",published:false}]);
 assert.ok(blocked.every(x=>x.action==="hold"));
});
test("duplicate work or slug cannot silently overwrite gallery listing",()=>{
 assert.throws(()=>planGalleryMigration([alice,{...alice,slug:"other"}]),/Duplicate/);
 assert.throws(()=>planGalleryMigration([alice,{...alice,work_id:"other"}]),/Duplicate/);
});
