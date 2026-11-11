import {test} from "node:test";
import {strict as assert} from "node:assert";
import {createHash} from "node:crypto";
import {composeSemanticRevision,walkSemanticAtoms,recomposeSemanticBatch,verifySemanticRevision} from "../lib/semantic/compose";
import {classifyGutenbergApparatus,selectEditorialEdition} from "../lib/semantic/editionProjection";
import {getSemanticPageUnits} from "../lib/semantic/readerProjection";
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
const source=[
 "Project Gutenberg eBook of a test title",
 "*** START OF THE PROJECT GUTENBERG EBOOK THE RAVEN ***",
 "THIS EBOOK WAS ONE OF PROJECT GUTENBERG’S EARLY FILES. THERE IS\nAN IMPROVED ILLUSTRATED EDITION OF THIS TITLE WHICH MAY VIEWED AT EBOOK\n[ #45484 ]",
 "The Raven","by Edgar Allan Poe",
 "Once upon a midnight dreary, while I pondered, weak and weary,",
 "Shall be lifted—nevermore!",
 "Transcriber’s Notes",
 "New original cover art included with this eBook is granted to the public domain.",
 "*** END OF THE PROJECT GUTENBERG EBOOK THE RAVEN ***",
 "Project Gutenberg License"].join("\n\n");
const make=()=>composeSemanticRevision({work_id:"test-id",work_slug:"test-work",
 snapshot_ref:"sha256:"+sha("archive"),source_bytes_sha256:sha(source),
 component_id:"epub:spine",original_byte_start:0,original_raw:source});
test("general Gutenberg classifier omits exact distribution apparatus but not the poem",()=>{
 const rev=make(),atoms=walkSemanticAtoms(rev.blocks);
 const result=classifyGutenbergApparatus(source,atoms);
 const omitted=atoms.filter(a=>result.automaticAtomIds.includes(a.id)).map(a=>a.raw);
 assert.equal(omitted.length,3);
 assert(omitted.some(x=>x.includes("EARLY FILES")));
 assert(omitted.some(x=>x.trim()==="Transcriber’s Notes"));
 assert(omitted.some(x=>x.includes("cover art")));
 assert(!omitted.some(x=>x.includes("Once upon a midnight")));
 const units=getSemanticPageUnits(rev,selectEditorialEdition(source).range);
 assert(!units.some(u=>u.source_atom_ids.some(id=>result.automaticAtomIds.includes(id))));
 assert(units.some(u=>u.source_atom_ids.some(id=>atoms.find(a=>a.raw.includes("Once upon a midnight"))?.id===id)));
});
test("ambiguous author notes remain in edition until human QA",()=>{
 const ambiguous=source.replace("New original cover art included with this eBook is granted to the public domain.",
  "NOTE.—She was born long before these events.");
 const rev=composeSemanticRevision({work_id:"test-id",work_slug:"test-work",
  snapshot_ref:"sha256:"+sha("archive"),source_bytes_sha256:sha(ambiguous),
  component_id:"epub:spine",original_byte_start:0,original_raw:ambiguous});
 const atoms=walkSemanticAtoms(rev.blocks);
 const result=classifyGutenbergApparatus(ambiguous,atoms);
 const note=atoms.find(a=>a.raw.startsWith("NOTE."))!;
 assert(!result.automaticAtomIds.includes(note.id));
});
test("manual revision exclusion never changes the source or literary atoms",()=>{
 const rev=make(),atoms=walkSemanticAtoms(rev.blocks),target=atoms.find(a=>a.raw.includes("cover art"))!;
 const revised=recomposeSemanticBatch(rev,[{
  flagId:"flag1",atomId:target.id,reason:"Editor confirms electronic-edition note only",
  kind:"exclude_from_edition"
 }],source);
 verifySemanticRevision(revised,source);
 assert(revised.editorial_exclusions?.includes(target.id));
 assert.equal(revised.source.normalized_text,rev.source.normalized_text);
 assert.deepEqual(walkSemanticAtoms(revised.blocks),atoms);
});
test("no Gutenberg markers means no speculative automatic omission",()=>{
 const source="Original historical author note.\n\nThis is a paragraph of the actual work.";
 const rev=composeSemanticRevision({work_id:"test-id",work_slug:"clean",
 snapshot_ref:"sha256:"+sha("archive"),source_bytes_sha256:sha(source),
 component_id:"epub:spine",original_byte_start:0,original_raw:source});
 const result=classifyGutenbergApparatus(source,walkSemanticAtoms(rev.blocks));
 assert.deepEqual(result.automaticAtomIds,[]);
});
