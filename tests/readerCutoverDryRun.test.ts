import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {captureGutenbergBytes,getPg11FixtureRequest} from "../lib/ingest/gutenbergSnapshot";
import {composeSemanticPg11,walkSemanticAtoms} from "../lib/semantic/compose";
import {inspectReaderCutoverDryRun,type ReaderCutoverDryRunInput} from "../lib/publication/readerCutoverDryRun";

const original=readFileSync("tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt");
const captured=captureGutenbergBytes(original,getPg11FixtureRequest());
const {revision}=composeSemanticPg11(captured,{
 work_id:"11111111-1111-4111-8111-111111111111",
 work_slug:"alices-adventures-in-wonderland",
 chapter_only:false,
});
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
const legacySha=sha("synthetic observed legacy Alice — tests only");
const a=walkSemanticAtoms(revision.blocks).find(x=>x.raw.includes("Alice was beginning"))!;
assert.ok(a);
const inputs:ReaderCutoverDryRunInput={
 existing:{work_id:revision.work_id,slug:revision.work_slug,status:"published",work_version:7},
 revision,
 legacy_observed_sha256:legacySha,
 comparison:{legacyObservedSha256:legacySha,rawSourceSha256:revision.source.source_bytes_sha256,
  verdict:"explained_difference",reviewedExplanation:"Synthetic previous version differs; manual comparison assumed only for this fixture."},
 recorded_reader_state_count:3,reader_state_inventory_complete:true,preserve_original_positions:true,
 manual_reader_qa:{full:true,preview:true},
 reader_states:[
  {kind:"progress",id:"qa-progress",position:{slug:revision.work_slug,progressPercent:45,pageIndex:4,pageCount:10}},
  {kind:"bookmark",id:"qa-bookmark",position:{slug:revision.work_slug,progressPercent:15},
   verified_source_position:{snapshot_ref:a.anchor.snapshot_ref,component_id:a.anchor.component_id,
    original_byte_offset:a.anchor.original_byte_start}},
  {kind:"note",id:"qa-note",position:{slug:revision.work_slug,progressPercent:72,pageIndex:8,pageCount:12}},
 ],
};
test("full twelve-chapter Alice proves all semantic reader projections, identity and note fallback",()=>{
 assert.equal(revision.blocks.filter(x=>x.kind==="chapter").length,12);
 const before=JSON.stringify(inputs.reader_states);
 const r=inspectReaderCutoverDryRun(inputs);
 assert.equal(r.status,"shadow_ready",r.blockers.join(","));
 assert.equal(r.work_id,inputs.existing.work_id);
 assert.equal(r.slug,inputs.existing.slug);
 assert.equal(r.current_work_version,7);
 assert.equal(r.mapping.exact,1);
 assert.equal(r.mapping.approximate,2);
 assert.equal(r.mapping.blocked,0);
 assert.ok(r.projection_qa.paged.pages>1);
 assert.ok(r.projection_qa.spread.pages>1);
 assert.equal(r.projection_qa.scroll.pages,1);
 assert.ok(r.reader_states.every(x=>x.original.slug===revision.work_slug));
 assert.equal(r.publication_authorized,false);
 assert.equal(r.public_reader_changed,false);
 assert.equal(r.rollback_preserves_legacy,true);
 assert.equal(JSON.stringify(inputs.reader_states),before,"dry run must never change stored reader data");
});
test("missing QA, unarchived legacy comparison and changed work identity block cutover",()=>{
 const missing=inspectReaderCutoverDryRun({...inputs,manual_reader_qa:{full:true,preview:false}});
 assert.equal(missing.status,"blocked");
 assert.ok(missing.blockers.includes("browser_reader_qa_missing"));
 const absent=inspectReaderCutoverDryRun({...inputs,legacy_observed_sha256:null,comparison:null});
 assert.equal(absent.status,"blocked");
 assert.ok(absent.blockers.includes("legacy_snapshot_missing"));
 const cross=inspectReaderCutoverDryRun({...inputs,existing:{...inputs.existing,slug:"different-work"}});
 assert.equal(cross.status,"blocked");
 assert.ok(cross.blockers.includes("identity_changed"));
});
test("missing reader notes, unmatched slug and removed old positions refuse silent migration",()=>{
 const missing=inspectReaderCutoverDryRun({...inputs,recorded_reader_state_count:4});
 assert.equal(missing.status,"blocked");
 assert.ok(missing.blockers.includes("reader_state_inventory_incomplete"));
 const lost=inspectReaderCutoverDryRun({...inputs,reader_states:[
  {...inputs.reader_states[0],position:{slug:"foreign-work",progressPercent:50}},
  ...inputs.reader_states.slice(1),
 ]});
 assert.equal(lost.status,"blocked");
 assert.ok(lost.blockers.includes("unmapped_reader_positions"));
 const unsafe=inspectReaderCutoverDryRun({...inputs,preserve_original_positions:false});
 assert.equal(unsafe.status,"blocked");
 assert.ok(unsafe.blockers.includes("reader_position_fallback_missing"));
});
test("duplicate note IDs and unresolved difference remain blocked",()=>{
 const dupe=inspectReaderCutoverDryRun({...inputs,reader_states:[
  inputs.reader_states[0],inputs.reader_states[1],{...inputs.reader_states[1]},
 ]});
 assert.equal(dupe.status,"blocked");
 assert.ok(dupe.blockers.includes("invalid_or_duplicate_reader_state"));
 const unresolved=inspectReaderCutoverDryRun({...inputs,comparison:{
  legacyObservedSha256:legacySha,rawSourceSha256:revision.source.source_bytes_sha256,verdict:"unresolved",
 }});
 assert.equal(unresolved.status,"blocked");
 assert.ok(unresolved.blockers.includes("source_difference_unresolved"));
});
