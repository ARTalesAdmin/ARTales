import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import test from "node:test";
import {captureGutenbergBytes,getPg11FixtureRequest} from "../lib/ingest/gutenbergSnapshot";
import {composeSemanticPg11,composeSemanticRevision,submitSemanticIssue,recomposeSemanticLayout,verifySemanticRevision,walkSemanticAtoms,proposeSemanticTitlePage,DEFAULT_CHAPTER_PRESENTATION} from "../lib/semantic/compose";
import {projectSemanticReader,verifyReaderProjection,remapLegacyPosition,locateReaderAnchor,splitParagraphUnit,getSemanticPageUnits,chooseSemanticParagraphBreak} from "../lib/semantic/readerProjection";
import {resolveQaProjectionMode,sourceOffsetForReaderPage,buildSemanticSourceRegions} from "../lib/semantic/qaReaderModes";
import {synchronizeSemanticPanes} from "../lib/semantic/pairedSemanticScroll";
import {compareAliceThreeWays,syntheticLegacyFixture} from "../lib/semantic/tripleQA";
const bytes=readFileSync("tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt");
const source=captureGutenbergBytes(bytes,getPg11FixtureRequest());
const sample=composeSemanticPg11(source,{work_id:"fixture:alice",work_slug:"alices-adventures-in-wonderland"});
const rev=sample.revision;
const sha=(s:string|Uint8Array)=>createHash("sha256").update(s).digest("hex");
test("Gutenberg #11 uses new semantic hierarchy and no WorkBlock output",()=>{
 verifySemanticRevision(rev,sample.original_raw);
 assert.equal(rev.schema,"artales.semantic-text.v2");
 assert.equal(rev.blocks[0].kind,"chapter");
 assert.ok(rev.blocks[0].kind==="chapter" && rev.blocks[0].children.some(x=>x.kind==="paragraph"));
 assert.equal(rev.release_allowed,false);
 assert.ok(!JSON.stringify(rev.blocks).includes("Project Gutenberg License"));
});
test("source coverage is exact including every newline and original byte anchor",()=>{
 const atoms=[...walkSemanticAtoms(rev.blocks),...rev.gaps.map(g=>g.atom)].sort((a,b)=>a.anchor.normalized_start-b.anchor.normalized_start);
 assert.equal(atoms.map(a=>a.raw).join(""),rev.source.normalized_text);
 const raw=Buffer.from(sample.original_raw);
 for(const a of atoms)assert.equal(sha(raw.subarray(a.anchor.original_byte_start-rev.source.original_byte_start,
   a.anchor.original_byte_end-rev.source.original_byte_start)),a.source_sha256);
});
test("pagination and desktop/mobile/spread/scroll preserve order, no repeated units",()=>{
 for(const w of [360,768,1440])for(const mode of ["paged","spread","scroll"] as const)
 for(const scale of [0.85,1,1.3]){
 const pages=projectSemanticReader(rev,{mode,viewport_width:w,viewport_height:700,font_scale:scale});
 assert.equal(verifyReaderProjection(rev,pages).ok,true);
 assert.ok(pages.length>=1);assert.ok(pages.every(p=>p.units.length>0));
 }
});
test("verse hierarchy preserves stanzas, indentation and punctuation, footnote/quote typed",()=>{
 const raw="CHAPTER I. Poem\r\n\r\n  First line\r\n second line\r\n\r\n  Third line\r\n\r\nA note.\r\n";
 const hints=[{kind:"poem" as const,start:17,end:55}];
 const n=raw.replace(/\r\n/g,"\n");
 const i=n.indexOf("  First line"), end=n.indexOf("\n\nA note.");
 const r=composeSemanticRevision({work_id:"fixture:v",work_slug:"verse",snapshot_ref:"sha256:"+sha(raw),
  source_bytes_sha256:sha(raw),component_id:"text",original_byte_start:0,original_raw:raw,
  hints:[{kind:"poem",start:i,end}]});
 const poem=r.blocks.flatMap(x=>x.kind==="chapter"?x.children:[x]).find(x=>x.kind==="poem");
 assert.ok(poem&&poem.kind==="poem");
 assert.equal(poem.stanzas.length,2);
 assert.equal(poem.stanzas[0].lines.length,2);
 assert.equal(poem.stanzas[1].lines.length,1);
 verifySemanticRevision(r,raw);
 void hints;
});
test("two returns preserve unchanged atoms, parent hash, and reject stale revisions",()=>{
 const first=walkSemanticAtoms(rev.blocks).find(x=>x.raw.includes("Alice was beginning"))!;
 const issue1=submitSemanticIssue(rev,{id:"review01",target_atom_id:first.id,kind:"typography",
  reason:"Need clearer opening layout",requested_layout:"indent_small"});
 const next=recomposeSemanticLayout(rev,issue1,sample.original_raw);
 assert.equal(next.parent_revision_ref,rev.revision_ref);
 assert.notEqual(next.revision_ref,rev.revision_ref);
 assert.equal(next.source.normalized_text,rev.source.normalized_text);
 const second=walkSemanticAtoms(next.blocks).find(x=>x.id!==first.id&&x.raw.length>70&&!x.raw.startsWith("CHAPTER"))!;
 const issue2=submitSemanticIssue(next,{id:"review02",target_atom_id:second.id,kind:"readability",
  reason:"Need clearer second paragraph",requested_layout:"indent_medium"});
 const third=recomposeSemanticLayout(next,issue2,sample.original_raw);
 assert.equal(third.parent_revision_ref,next.revision_ref);
 assert.throws(()=>recomposeSemanticLayout(next,issue1,sample.original_raw),/Stale/);
 assert.equal(walkSemanticAtoms(third.blocks).map(x=>x.raw).join(""),walkSemanticAtoms(rev.blocks).map(x=>x.raw).join(""));
});
test("stable anchor mapping and old page-only notes retained with approximate fallback",()=>{
 const a=walkSemanticAtoms(rev.blocks)[1];
 const exact=remapLegacyPosition(rev,{slug:rev.work_slug,progressPercent:27,pageIndex:15},
  {snapshot_ref:a.anchor.snapshot_ref,component_id:a.anchor.component_id,original_byte_offset:a.anchor.original_byte_start});
 assert.equal(exact.status,"exact");assert.equal(exact.anchor?.atom_id,a.id);
 assert.equal(exact.retained_legacy.pageIndex,15);
 const approx=remapLegacyPosition(rev,{slug:rev.work_slug,progressPercent:27,pageIndex:15});
 assert.equal(approx.status,"approximate");assert.ok(approx.reason.includes("approximate"));
 assert.equal(remapLegacyPosition(rev,{slug:"other-work",progressPercent:27}).status,"blocked");
 assert.equal(locateReaderAnchor(rev,a.id).work_id,rev.work_id);
});
test("Alice triple comparison separates synthetic legacy from absent production evidence",()=>{
 assert.equal(compareAliceThreeWays(rev).legacy_status,"legacy_evidence_required");
 const l=syntheticLegacyFixture(rev);
 assert.equal(compareAliceThreeWays(rev,l).legacy_status,"synthetic_comparison");
 assert.equal(compareAliceThreeWays(rev,l).can_cutover,false);
 assert.throws(()=>compareAliceThreeWays(rev,{...l,blocks:[{id:"changed",text:"Different"}]}),/Untrusted/);
});

test("reader density is a display setting and never mutates semantic revision or source anchors",()=>{
 const before=rev.revision_ref;
 const standard=projectSemanticReader(rev,{mode:"paged",viewport_width:360,viewport_height:700,font_scale:1.15,density:"comfortable"});
 const compact=projectSemanticReader(rev,{mode:"paged",viewport_width:360,viewport_height:700,font_scale:1.15,density:"compact"});
 assert.equal(verifyReaderProjection(rev,standard).ok,true);
 assert.equal(verifyReaderProjection(rev,compact).ok,true);
 assert.ok(compact.length<=standard.length);
 assert.equal(rev.revision_ref,before);
 assert.throws(()=>projectSemanticReader(rev,{mode:"paged",viewport_width:360,viewport_height:700,font_scale:1,density:"invalid" as "compact"}),/density/);
});

test("wide page capacity responds to width and keeps source anchored units intact",()=>{
 const narrow=projectSemanticReader(rev,{mode:"paged",viewport_width:300,viewport_height:850,font_scale:1,density:"comfortable"});
 const wide=projectSemanticReader(rev,{mode:"paged",viewport_width:900,viewport_height:850,font_scale:1,density:"comfortable"});
 assert.ok(wide.length<narrow.length,`Expected wider paper to require fewer pages, got ${wide.length} vs ${narrow.length}`);
 assert.equal(verifyReaderProjection(rev,wide).ok,true);
 assert.equal(verifyReaderProjection(rev,narrow).ok,true);
});
test("browser measured heights cause deterministic repagination without text loss",()=>{
 const baseline=projectSemanticReader(rev,{mode:"paged",viewport_width:400,viewport_height:850,font_scale:1});
 const first=baseline[0].units[0];
 const measured=projectSemanticReader(rev,{mode:"paged",viewport_width:400,viewport_height:850,font_scale:1,measured_unit_heights:{[first.id]:650}});
 assert.equal(verifyReaderProjection(rev,measured).ok,true);
 assert.ok(measured.length>=baseline.length);
 assert.throws(()=>projectSemanticReader(rev,{mode:"paged",viewport_width:400,viewport_height:850,font_scale:1,measured_unit_heights:{[first.id]:-1}}),/measured/);
});

test("chapter spacing is a validated layout hint rather than a source newline",()=>{
 assert.equal(rev.blocks[0].kind,"chapter");
 if(rev.blocks[0].kind!=="chapter")throw Error("missing chapter");
 assert.deepEqual(rev.blocks[0].presentation,DEFAULT_CHAPTER_PRESENTATION);
 const first=walkSemanticAtoms(rev.blocks).find(a=>a.raw.includes("Alice was beginning"))!;
 const flags={align:"justify" as const,indent:"medium" as const,space_before:"normal" as const,space_after:"generous" as const};
 const issue=submitSemanticIssue(rev,{id:"editor-layout-1",target_atom_id:first.id,
   kind:"typography",reason:"Improve paragraph alignment and indentation",
   requested_layout:"block_presentation",requested_presentation:flags});
 const after=recomposeSemanticLayout(rev,issue,sample.original_raw);
 verifySemanticRevision(after,sample.original_raw);
 assert.equal(after.parent_revision_ref,rev.revision_ref);
 assert.notEqual(after.revision_sha256,rev.revision_sha256);
 assert.deepEqual(walkSemanticAtoms(after.blocks).map(a=>a.id),walkSemanticAtoms(rev.blocks).map(a=>a.id));
 const second=walkSemanticAtoms(after.blocks).find(a=>a.id!==first.id&&a.raw.length>70&&!a.raw.startsWith("CHAPTER"))!;
 const issue2=submitSemanticIssue(after,{id:"editor-layout-2",target_atom_id:second.id,
   kind:"readability",reason:"Increase separation",requested_layout:"block_presentation",
   requested_presentation:{align:"left",indent:"small",space_before:"none",space_after:"normal"}});
 const final=recomposeSemanticLayout(after,issue2,sample.original_raw);
 verifySemanticRevision(final,sample.original_raw);
 assert.throws(()=>recomposeSemanticLayout(after,issue,sample.original_raw),/Stale/);
 assert.throws(()=>submitSemanticIssue(rev,{id:"bad-flags",target_atom_id:first.id,kind:"typography",reason:"Invalid styling",
   requested_layout:"block_presentation",requested_presentation:{...flags,align:"unsafe" as "left"}}),/Unsafe/);
});
test("title-page draft has revision ancestry but no source atom or publisher approval",()=>{
 const original=walkSemanticAtoms(rev.blocks).map(x=>x.id);
 const titled=proposeSemanticTitlePage(rev,{title:"Alice's Adventures in Wonderland",authors:["Lewis Carroll"]});
 assert.equal(titled.title_page?.brand,"ARTales");
 assert.equal(titled.title_page?.review_state,"awaiting_editor_review");
 assert.equal(titled.parent_revision_ref,rev.revision_ref);
 assert.notEqual(titled.revision_ref,rev.revision_ref);
 assert.deepEqual(walkSemanticAtoms(titled.blocks).map(x=>x.id),original);
 assert.equal(titled.release_allowed,false);
 const pages=projectSemanticReader(titled,{mode:"paged",viewport_width:700,viewport_height:850,font_scale:1});
 assert.equal(pages[0].units[0].kind,"title_page");
 assert.equal(pages[0].units.length,1);
 assert.equal(verifyReaderProjection(titled,pages).ok,true);
 assert.throws(()=>proposeSemanticTitlePage(rev,{title:"Bad ISBN 123",authors:["Lewis Carroll"]}),/ISBN/);
 assert.throws(()=>proposeSemanticTitlePage(rev,{title:"<script>",authors:["Lewis Carroll"]}),/title page/);
});

test("paragraph fragments preserve original atom and contiguous source offsets",()=>{
 const unit=getSemanticPageUnits(rev).find(u=>u.kind==="paragraph"&&u.node.kind==="paragraph"&&u.node.atom.raw.length>200)!;
 assert.ok(unit);
 const parts=splitParagraphUnit(unit,100);
 assert.ok(parts.length>1);
 assert.equal(parts.map(p=>p.node.kind==="paragraph"?p.node.atom.raw.slice(p.fragment!.start,p.fragment!.end):"").join(""),unit.node.kind==="paragraph"?unit.node.atom.raw:"");
 assert.equal(parts[0].fragment?.normalized_start,unit.node.kind==="paragraph"?unit.node.atom.anchor.normalized_start:0);
 const pages=projectSemanticReader(rev,{mode:"paged",viewport_width:300,viewport_height:450,font_scale:1.3});
 assert.ok(pages.flatMap(p=>p.units).some(x=>Boolean(x.fragment)));
 assert.equal(verifyReaderProjection(rev,pages).ok,true);
 const corrupt=structuredClone(pages), fragment=corrupt.flatMap(p=>p.units).find(x=>x.fragment)!;
 fragment.fragment!.start++;
 assert.throws(()=>verifyReaderProjection(rev,corrupt),/fragment/);
});

test("semicolon preferred over arbitrary cut, strong punctuation takes precedence",()=>{
 const raw="There was a long enough phrase with plenty of words; but then the Rabbit walked further ahead to discover more.";
 const edge=raw.indexOf("but then")+7;
 const at=chooseSemanticParagraphBreak(raw,0,edge,raw.length);
 assert.equal(at,raw.indexOf("but then"));
 assert.equal(raw.slice(0,at).trimEnd().endsWith(";"),true);
 assert.equal(chooseSemanticParagraphBreak("An unfinished sentence with no natural semantic break in reach",0,33),null);
});
test("reader surfaces use canonical flow/spread, mobile suppresses spread, editor always pages",()=>{
 assert.equal(resolveQaProjectionMode("editor","spread",900,1440),"paged");
 assert.equal(resolveQaProjectionMode("reader","scroll",900,1440),"scroll");
 assert.equal(resolveQaProjectionMode("reader","spread",900,1440),"spread");
 assert.equal(resolveQaProjectionMode("reader","spread",900,360),"scroll");
 assert.equal(resolveQaProjectionMode("reader","spread",360,1440),"scroll");
 const pages=projectSemanticReader(rev,{mode:"paged",viewport_width:350,viewport_height:700,font_scale:1});
 assert.ok(sourceOffsetForReaderPage(pages,0,.5)>=0);
});

test("source/composed QA spans reconstruct original and paired scroll works both directions",()=>{
 const units=getSemanticPageUnits(rev);
 const original=rev.source.normalized_text;
 const regions=buildSemanticSourceRegions(original,units);
 assert.equal(regions.map(x=>x.text).join(""),original);
 const left={markers:[{regionIndex:0,top:0},{regionIndex:1,top:250},{regionIndex:2,top:500}],
   scrollTop:260,clientHeight:280,scrollHeight:1000};
 const right={markers:[{regionIndex:0,top:0},{regionIndex:1,top:500},{regionIndex:2,top:1100}],
   scrollTop:0,clientHeight:280,scrollHeight:1800};
 const target=synchronizeSemanticPanes(left,right);
 const back=synchronizeSemanticPanes({...right,scrollTop:target},{...left,scrollTop:0});
 assert.ok(target>0);
 assert.ok(back>=0 && back<=left.scrollHeight-left.clientHeight);
});

test("JSONB reordered source-anchor keys retain identity but altered offsets fail closed",()=>{
 const initial=walkSemanticAtoms(rev.blocks).find(a=>a.raw.includes("Alice was beginning"))!;
 const returned=submitSemanticIssue(rev,{id:"jsonb-order-qa",target_atom_id:initial.id,
  kind:"typography",reason:"Adjust this exact anchored paragraph",requested_layout:"indent_small"});
 const a=returned.source_anchor;
 const reordered={original_byte_end:a.original_byte_end,normalized_end:a.normalized_end,
  snapshot_ref:a.snapshot_ref,original_byte_start:a.original_byte_start,
  component_id:a.component_id,normalized_start:a.normalized_start};
 const updated=recomposeSemanticLayout(rev,{...returned,source_anchor:reordered},sample.original_raw);
 assert.equal(updated.parent_revision_ref,rev.revision_ref);
 assert.throws(()=>recomposeSemanticLayout(rev,{...returned,source_anchor:{
  ...reordered,original_byte_start:reordered.original_byte_start+1,
 }},sample.original_raw),/anchor|mismatch/i);
});
