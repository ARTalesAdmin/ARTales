import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {composeSemanticRevision} from "../lib/semantic/compose";
import {getSemanticPageUnits,projectSemanticUnits} from "../lib/semantic/readerProjection";
import {selectEditorialEdition} from "../lib/semantic/editionProjection";
import {filterSemanticReaderNotes,makeSemanticReaderNote,pageForSemanticNote,semanticNotesKey} from "../lib/semantic/readerNotes";
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
const source="CHAPTER I.\n\nA source-verified paragraph with the same words on every display.\n\nA closing paragraph.";
const revision=composeSemanticRevision({work_id:"notes-fixture",work_slug:"notes-fixture",
 snapshot_ref:"sha256:"+sha("source"),source_bytes_sha256:sha(source),
 component_id:"epub:body",original_byte_start:0,original_raw:source});
const units=getSemanticPageUnits(revision,selectEditorialEdition(source).range);
const pages=projectSemanticUnits(units,{mode:"paged",viewport_width:360,viewport_height:620,font_scale:1});
test("semantic notes remain separate from legacy keys and stay source anchored",()=>{
 assert.equal(semanticNotesKey(revision.work_slug),"artales.semantic.notes:"+revision.work_slug);
 const first=pages.find(p=>p.units.some(u=>u.source_atom_ids.length));
 assert(first);
 const note=makeSemanticReaderNote({slug:revision.work_slug,page:first,units,
  id:"n-1",now:"2026-11-04T00:00:00Z",title:"Reader's note",body:"Test",color:"gold"});
 assert(note);
 assert.equal(note.slug,revision.work_slug);
 assert.match(note.atomSourceSha,/^[a-f0-9]{64}$/);
 assert.equal(pageForSemanticNote(pages,note,units),first.index);
 assert.deepEqual(filterSemanticReaderNotes([note],revision.work_slug),[note]);
 assert.deepEqual(filterSemanticReaderNotes([note],"another-book"),[]);
});
test("an unverifiable note survives storage but never navigates to the wrong atom",()=>{
 const original=makeSemanticReaderNote({slug:revision.work_slug,
  page:pages.find(p=>p.units.some(u=>u.source_atom_ids.length)),units,
  id:"n-2",now:"2026-11-04T00:00:00Z",title:"Legacy proof",
  body:"Never delete merely because a changed revision no longer matches",color:"blue"});
 assert(original);
 const unmatched={...original,atomSourceSha:sha("different literary text")};
 assert.deepEqual(filterSemanticReaderNotes([unmatched],revision.work_slug),[unmatched]);
 assert.equal(pageForSemanticNote(pages,unmatched,units),null);
});
test("invalid or cross-book note records cannot be bound or displayed",()=>{
 assert.deepEqual(filterSemanticReaderNotes([null,{},42,{"slug":"other"}],revision.work_slug),[]);
 const malformed={schema:"artales.semantic.note.v1",id:"id",slug:revision.work_slug,
  atomId:"fake",atomSourceSha:"xyz",offset:-1,title:"",body:"",color:"gold",
  createdAt:"date",updatedAt:"date"};
 assert.deepEqual(filterSemanticReaderNotes([malformed],revision.work_slug),[]);
});
