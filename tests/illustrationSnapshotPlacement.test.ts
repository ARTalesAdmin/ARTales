import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {captureIllustration} from "../lib/ingest/illustrationSnapshot";
import {projectIllustratedPages} from "../lib/ingest/illustrationPlacement";
import {captureGutenbergBytes,getPg11FixtureRequest} from "../lib/ingest/gutenbergSnapshot";
import {composeSemanticPg11,walkSemanticAtoms} from "../lib/semantic/compose";
import {projectSemanticReader} from "../lib/semantic/readerProjection";
const sha=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex");
const gif=Buffer.from("47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b","hex");
const raw=readFileSync("tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt");
const source=captureGutenbergBytes(raw,getPg11FixtureRequest());
const rev=composeSemanticPg11(source,{work_id:"fixture:alice",work_slug:"alice",chapter_only:false}).revision;
const input={
 candidate_id:"fixture:alice",text_snapshot_ref:source.snapshot_ref,component_id:"alice:image:1",
 role:"interior_illustration" as const,
 source:{asset_url:"https://www.gutenberg.org/files/114/114-h/images/alice02a.gif",
  catalog_url:"https://www.gutenberg.org/ebooks/114",archive_ref:"fixture://tiny-gif",
  captured_at:"2026-10-11T12:00:00.000Z",sha256:sha(gif),bytes:gif},
 author:{name:"John Tenniel",living:false,death_year:1914,evidence_url:"https://www.gutenberg.org/ebooks/114"},
 provenance:"original_artist" as const,us_catalog_status:"public_domain" as const,express_no_reuse:false,
};
const at="2026-10-12T08:00:00.000Z";
test("captured illustration is separate from original text; own cover is mandatory",()=>{
 const asset=captureIllustration(input,at);
 assert.equal(asset.decision,"eligible_for_editorial_draft");
 assert.equal(asset.media_type,"image/gif");
 assert.equal(asset.intrinsic_width,1);
 assert.equal(asset.publication_authorized,false);
 assert.equal(asset.derived_image_verified,false);
 assert.throws(()=>captureIllustration({...input,role:"cover"},at),/cover/);
});
test("protected artist, tampered image and unknown catalog fail closed",()=>{
 assert.equal(captureIllustration({...input,author:{...input.author,living:true,death_year:null}},at).decision,"exclude_protected_asset");
 assert.equal(captureIllustration({...input,us_catalog_status:"unknown"},at).decision,"needs_rights_review");
 assert.equal(captureIllustration({...input,express_no_reuse:true},at).decision,"exclude_protected_asset");
 assert.throws(()=>captureIllustration({...input,source:{...input.source,bytes:Buffer.from("fake")}},at),/snapshot digest/);
});
test("Tenniel fixture illustration becomes independent page; source content unchanged",()=>{
 const asset=captureIllustration(input,at),atom=walkSemanticAtoms(rev.blocks).find(a=>a.raw.includes("Alice was beginning"))!;
 assert.ok(atom);
 const pages=projectSemanticReader(rev,{mode:"paged",viewport_width:420,viewport_height:760,font_scale:1});
 const original=JSON.stringify(rev);
 const decorated=projectIllustratedPages(rev,pages,[{asset,after_atom_id:atom.id,alt:"A figure in Wonderland",caption:"John Tenniel"}]);
 assert.equal(decorated.filter(p=>p.kind==="illustration").length,1);
 assert.equal(decorated.filter(p=>p.kind==="text").flatMap(p=>p.units).length,pages.flatMap(p=>p.units).length);
 assert.equal(JSON.stringify(rev),original);
 assert.throws(()=>projectIllustratedPages(rev,pages,[{asset:{...asset,decision:"needs_rights_review"},after_atom_id:atom.id,alt:"Alt",caption:""}]),/Unsafe/);
});
