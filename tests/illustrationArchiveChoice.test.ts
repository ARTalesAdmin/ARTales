import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {captureIllustration} from "../lib/ingest/illustrationSnapshot";
import {PRIVATE_ILLUSTRATION_ARCHIVE_BUCKET,planPrivateIllustrationArchive,
 verifyPrivateIllustrationArchive,decideIllustrationDisplay} from "../lib/ingest/illustrationArchiveChoice";
const gif=Buffer.from("47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b","hex");
const digest=createHash("sha256").update(gif).digest("hex");
const timestamp="2026-10-12T08:00:00.000Z";
const x=captureIllustration({
 candidate_id:"alice",text_snapshot_ref:"sha256:"+"1".repeat(64),component_id:"alice:illustration:1",
 role:"interior_illustration",source:{
  asset_url:"https://www.gutenberg.org/files/114/114-h/images/alice02a.gif",
  catalog_url:"https://www.gutenberg.org/ebooks/114",archive_ref:"test:original",
  captured_at:timestamp,sha256:digest,bytes:gif},
 author:{name:"John Tenniel",living:false,death_year:1914,evidence_url:"https://www.gutenberg.org/ebooks/114"},
 provenance:"original_artist",us_catalog_status:"public_domain",express_no_reuse:false
},timestamp);
const path=planPrivateIllustrationArchive(x,gif).path;
const archived={component_id:x.component_id,source_sha256:digest,source_archive_path:path,
 source_bucket:PRIVATE_ILLUSTRATION_ARCHIVE_BUCKET,source_byte_length:gif.length,
 captured_at:timestamp,storage_verified:true};
const base={component_id:x.component_id,mode:"original" as const,custom_storage_path:null,
 note:"Use original Tenniel",editor_id:"editor:ivana",chosen_at:timestamp};
test("original source stays in immutable private archive independent of editor selection",()=>{
 const upload=planPrivateIllustrationArchive(x,gif);
 assert.equal(upload.bucket,PRIVATE_ILLUSTRATION_ARCHIVE_BUCKET);
 assert.equal(upload.upsert,false);
 assert.equal(upload.contentType,"image/gif");
 assert.equal(verifyPrivateIllustrationArchive(x,archived,gif),true);
 assert.throws(()=>planPrivateIllustrationArchive(x,Buffer.from("bad")),/match/);
});
test("Ivana can omit, choose original derivative or replace with custom work without destroying archive",()=>{
 const omit=decideIllustrationDisplay(x,archived,{...base,mode:"omit"},null);
 assert.equal(omit.display_path,null);
 assert.equal(omit.source_archive_path,path);
 const pending=decideIllustrationDisplay(x,archived,base,null);
 assert.equal(pending.pending_reason,"approved_image_derivative_missing");
 const original=decideIllustrationDisplay(x,archived,base,
  {path:"works/alice/inline/tenniel-1.webp",sha256:"a".repeat(64)});
 assert.equal(original.pending_reason,null);
 const custom=decideIllustrationDisplay(x,archived,
  {...base,mode:"custom",custom_storage_path:"works/alice/inline/own-1.webp"},null);
 assert.equal(custom.mode,"custom");
 assert.equal(custom.source_archive_path,path);
 const blocked=decideIllustrationDisplay({...x,decision:"exclude_protected_asset"},archived,base,null);
 assert.equal(blocked.pending_reason,"original_illustration_not_cleared");
});
test("unverified archive and incomplete visual decision never pass",()=>{
 assert.throws(()=>decideIllustrationDisplay(x,{...archived,storage_verified:false},base,null),/Unverified/);
 assert.throws(()=>decideIllustrationDisplay(x,archived,{...base,editor_id:""},null),/Unverified/);
});
