import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {captureGutenbergBytes,getPg11FixtureRequest} from "../lib/ingest/gutenbergSnapshot";
import {composeSemanticPg11,proposeSemanticTitlePage,submitSemanticIssue,recomposeSemanticLayout,walkSemanticAtoms} from "../lib/semantic/compose";
import {projectSemanticReader} from "../lib/semantic/readerProjection";
import {bridgeLegacyReaderState,rebindReaderAnchor,findReaderAnchorPage,resolveSemanticReaderPreferences,preservedLegacyReaderState,assertNoReaderStateMutation} from "../lib/semantic/readerCompatibility";
import {createSessionReaderNote,locateSessionReaderNote,noteAnchorForUnit,locateAndSortSessionNotes,selectActiveQaReadingUnit} from "../lib/semantic/qaNoteSession";
import type {ReaderNote,ReaderBookmark,ReaderProgress} from "../lib/reader/readerStorage";
const bytes=readFileSync("tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt");
const pilot=captureGutenbergBytes(bytes,getPg11FixtureRequest());
const {revision,original_raw}=composeSemanticPg11(pilot,{work_id:"fixture:alice",work_slug:"alices-adventures-in-wonderland"});
const legacyNote:ReaderNote={
 id:"note-1",slug:revision.work_slug,userId:"member-A",title:"A thought",body:"My original note",
 color:"violet",progressPercent:24,scrollY:4,pageIndex:4,pageCount:18,layoutMode:"spread",
 createdAt:"2026-10-01T12:00:00Z",updatedAt:"2026-10-02T12:00:00Z",source:"synced"
};
test("current legacy Reader note fields survive exactly and never become fake exact anchors",()=>{
 const original=structuredClone(legacyNote);
 const converted=bridgeLegacyReaderState(revision,"note",legacyNote,{expectedUserId:"member-A"});
 assert.equal(converted.confidence,"approximate");
 assert.equal(converted.reason,"page_percent_only_original_position_preserved");
 assert.strictEqual(preservedLegacyReaderState(converted),legacyNote);
 assertNoReaderStateMutation(original,legacyNote);
 assert.equal(converted.legacy.color,"violet");
 assert.equal(converted.legacy.body,"My original note");
 assert.equal(converted.legacy.pageIndex,4);
 assert.equal(bridgeLegacyReaderState(revision,"note",legacyNote,{expectedUserId:"member-B"}).confidence,"blocked");
});
test("progress and bookmark retain their legacy position during approximate mapping",()=>{
 const bookmark:ReaderBookmark={slug:revision.work_slug,mode:"full",progressPercent:63,
 scrollY:11,pageIndex:7,pageCount:18,layoutMode:"pagedFlow",createdAt:"2026-10-01T12:00:00Z"};
 const progress:ReaderProgress={slug:revision.work_slug,mode:"full",progressPercent:73,
 scrollY:13,pageIndex:8,pageCount:18,layoutMode:"spread",updatedAt:"2026-10-01T12:00:00Z"};
 for(const [kind,legacy] of [["bookmark",bookmark],["progress",progress]] as const){
  const result=bridgeLegacyReaderState(revision,kind,legacy);
  assert.equal(result.confidence,"approximate");
  assert.deepEqual(preservedLegacyReaderState(result),legacy);
 }
});
test("source proof is exact only at verified atom start, never guessed byte offset",()=>{
 const atom=walkSemanticAtoms(revision.blocks)[1];
 const evidence={snapshot_ref:atom.anchor.snapshot_ref,component_id:atom.anchor.component_id,
   original_byte_offset:atom.anchor.original_byte_start};
 const exact=bridgeLegacyReaderState(revision,"note",legacyNote,{evidence});
 assert.equal(exact.confidence,"exact");
 assert.equal(exact.anchor?.atom_id,atom.id);
 const interior=bridgeLegacyReaderState(revision,"note",legacyNote,
   {evidence:{...evidence,original_byte_offset:evidence.original_byte_offset+1}});
 assert.equal(interior.confidence,"approximate");
 assert.equal(bridgeLegacyReaderState(revision,"note",legacyNote,
   {evidence:{...evidence,snapshot_ref:"fake"}}).confidence,"blocked");
});
test("note anchor survives title page and typography revision and finds new layout page",()=>{
 const atom=walkSemanticAtoms(revision.blocks).find(x=>x.raw.includes("Alice was beginning"))!;
 const original=bridgeLegacyReaderState(revision,"note",legacyNote,{evidence:{
  snapshot_ref:atom.anchor.snapshot_ref,component_id:atom.anchor.component_id,
  original_byte_offset:atom.anchor.original_byte_start
 }});
 const titled=proposeSemanticTitlePage(revision,{title:"Alice's Adventures in Wonderland",authors:["Lewis Carroll"]});
 const moved=rebindReaderAnchor(original.anchor!,titled);
 assert.equal(moved.status,"exact");
 const issue=submitSemanticIssue(titled,{id:"layout-stable-1",target_atom_id:atom.id,kind:"typography",
  reason:"Adjust first paragraph",requested_layout:"indent_medium"});
 const revised=recomposeSemanticLayout(titled,issue,original_raw);
 assert.equal(rebindReaderAnchor(moved.anchor!,revised).status,"exact");
 for(const density of ["compact","comfortable"] as const){
  const pages=projectSemanticReader(revised,{mode:"paged",viewport_width:360,viewport_height:680,font_scale:1.2,density});
  assert.ok(findReaderAnchorPage(revised,pages,moved.anchor!));
 }
});
test("reader profile/device settings share canonical normalization and narrow-device fallback",()=>{
 const profile={reader_theme:"script",reader_width:"wide",reader_density:"compact",reader_font_scale:1.25};
 const a=resolveSemanticReaderPreferences({profileDefaults:profile,physicalViewportWidth:1100});
 assert.equal(a.authority,"profile");assert.equal(a.settings.fontScale,1.25);
 assert.equal(a.settings.theme,"script");assert.equal(a.settings.density,"compact");
 const device={...a.settings,layoutMode:"spread" as const,theme:"dark" as const};
 const desktop=resolveSemanticReaderPreferences({savedDeviceSettings:device,profileDefaults:profile,physicalViewportWidth:1100});
 const phone=resolveSemanticReaderPreferences({savedDeviceSettings:device,profileDefaults:profile,physicalViewportWidth:360});
 assert.equal(desktop.authority,"device");assert.equal(desktop.effectiveLayout,"spread");
 assert.equal(phone.effectiveLayout,"scroll");assert.equal(phone.settings.layoutMode,"spread");
 assert.throws(()=>resolveSemanticReaderPreferences({physicalViewportWidth:0}),/viewport/);
});

test("ephemeral QA note reflows from paged to scroll and spread without losing source position",()=>{
 const layouts=["paged","scroll","spread"] as const;
 const first=projectSemanticReader(revision,{mode:"paged",viewport_width:360,viewport_height:700,font_scale:1});
 const target=first.flatMap(p=>p.units).find(u=>u.kind==="paragraph")!;
 assert.ok(noteAnchorForUnit(revision,target));
 const saved=createSessionReaderNote(revision,target,{id:"fixture-note",title:"Checkpoint",
   body:"Never persisted",color:"blue",now:"2026-10-11T14:00:00Z",pageIndex:1,
   pageCount:Math.max(2,first.length),layoutMode:"pagedFlow"});
 for(const mode of layouts){
  for(const scale of [0.85,1,1.3]){
   const pages=projectSemanticReader(revision,{mode,viewport_width:mode==="spread"?450:360,
     viewport_height:700,font_scale:scale,density:"compact"});
   const location=locateSessionReaderNote(revision,pages,saved);
   assert.equal(location.status,"exact");
   assert.notEqual(location.unitId,null);
  }
 }
 assert.equal(saved.note.title,"Checkpoint");
 assert.equal(saved.note.body,"Never persisted");
 assert.equal(saved.anchor.atom_id,noteAnchorForUnit(revision,target)?.atom_id);
 assert.throws(()=>createSessionReaderNote(revision,first[0].units.find(u=>u.kind==="title_page")??{
   ...target,kind:"title_page",source_atom_ids:[]} as typeof target,{
   id:"x",title:"",body:"",color:"gold",now:"2026-10-11T14:00:00Z",pageIndex:0,
   pageCount:2,layoutMode:"spread"}),/anchor/);
});

test("QA notes follow semantic source order, markers reflow and read position anchors visible content",()=>{
 const wide=projectSemanticReader(revision,{mode:"paged",viewport_width:900,viewport_height:780,font_scale:1});
 const blocks=wide.flatMap(p=>p.units).filter(u=>u.kind==="paragraph");
 assert.ok(blocks.length>=2);
 const make=(unit:typeof blocks[number],id:string,pageIndex:number)=>createSessionReaderNote(revision,unit,{
   id,title:id,body:"",color:"rose",now:"2026-10-11T12:00:00Z",pageIndex,
   pageCount:Math.max(3,wide.length),layoutMode:"pagedFlow",
 });
 const later=make(blocks[1],"later",2),early=make(blocks[0],"early",1);
 const sorted=locateAndSortSessionNotes(revision,wide,[later,early]);
 assert.deepEqual(sorted.map(x=>x.saved.note.id),["early","later"]);
 assert.ok(sorted.every(x=>x.unitId!==null));
 const readable=selectActiveQaReadingUnit([
  {unitId:"title",pageIndex:0,top:50,bottom:300,anchorable:false},
  {unitId:"first",pageIndex:1,top:100,bottom:400,anchorable:true},
  {unitId:"second",pageIndex:2,top:450,bottom:650,anchorable:true},
 ],180,750);
 assert.equal(readable?.unitId,"first");
 assert.equal(selectActiveQaReadingUnit([
  {unitId:"cover",pageIndex:0,top:0,bottom:700,anchorable:false}
 ],150,800),null);
});
