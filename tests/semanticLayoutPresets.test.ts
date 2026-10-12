import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {captureGutenbergBytes,getPg11FixtureRequest} from "../lib/ingest/gutenbergSnapshot";
import {composeSemanticPg11} from "../lib/semantic/compose";
import {COMMON_LAYOUT_PROFILES,createLayoutPreset,verifyLayoutPreset} from "../lib/semantic/layoutPresets";
const bytes=readFileSync("tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt");
const source=captureGutenbergBytes(bytes,getPg11FixtureRequest());
const {revision}=composeSemanticPg11(source,{work_id:"fixture:alice",work_slug:"alices-adventures-in-wonderland",chapter_only:false});
test("full Alice produces stable layout manifests without source duplication",()=>{
 for(const profile of COMMON_LAYOUT_PROFILES){
  const a=createLayoutPreset(revision,profile);
  const b=createLayoutPreset(revision,profile);
  assert.deepEqual(a,b);
  assert.equal(a.page_count,verifyLayoutPreset(revision,a).length);
  assert.equal(JSON.stringify(a).includes("Alice was beginning"),false);
 }
});
test("modified page breaks, stale revision, unknown algorithm fail closed",()=>{
 const manifest=createLayoutPreset(revision,COMMON_LAYOUT_PROFILES[0]);
 assert.throws(()=>verifyLayoutPreset(revision,{...manifest,revision_ref:"sha256:"+("a".repeat(64))}),/Stale/);
 assert.throws(()=>verifyLayoutPreset(revision,{...manifest,pages:[]}),/Stale/);
 assert.throws(()=>verifyLayoutPreset(revision,{...manifest,layout_algorithm:"other" as typeof manifest.layout_algorithm}),/Stale/);
});
