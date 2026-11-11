import {test} from "node:test";
import {strict as assert} from "node:assert";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {composeSemanticRevision,walkSemanticAtoms,recomposeSemanticBatch,verifySemanticRevision} from "../lib/semantic/compose";
import {classifyGutenbergApparatus,selectEditorialEdition,poemInsideEditorialEdition} from "../lib/semantic/editionProjection";
import {getSemanticPageUnits} from "../lib/semantic/readerProjection";
import {getOmittedQaAtoms} from "../lib/semantic/qaFindingProjection";
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

test("QA can identify already-omitted apparatus and outside-range blocks without hiding literature",()=>{
 const rev=make(),atoms=walkSemanticAtoms(rev.blocks);
 const omitted=getOmittedQaAtoms(rev);
 const find=(part:string)=>atoms.find(a=>a.raw.includes(part))!;
 assert.equal(omitted[find("EARLY FILES").id]?.reason,"gutenberg_apparatus");
 assert.equal(omitted[find("original cover art").id]?.reason,"gutenberg_apparatus");
 assert.equal(omitted[find("Transcriber’s Notes").id]?.reason,"gutenberg_apparatus");
 assert.equal(omitted[find("Project Gutenberg eBook of a test title").id]?.reason,"outside_edition");
 assert.equal(omitted[find("Once upon a midnight").id],undefined);
});


test("poem stays fully visible in QA and public edition even when one verse looks like boilerplate",()=>{
 const intro="THIS EBOOK WAS ONE OF PROJECT GUTENBERG’S EARLY FILES.";
 const lines=[intro,"Once upon a midnight dreary,","The poem and its lines remain intact."].join("\n");
 const original=[
  "Project Gutenberg electronic edition",
  "*** START OF THE PROJECT GUTENBERG EBOOK SAMPLE ***",
  lines,
  "*** END OF THE PROJECT GUTENBERG EBOOK SAMPLE ***",
  "Project Gutenberg license"
 ].join("\n\n");
 const start=original.indexOf(intro);
 const revision=composeSemanticRevision({
  work_id:"poetry-candidate",work_slug:"poetry-candidate",
  snapshot_ref:"sha256:"+sha("poem-archive"),source_bytes_sha256:sha(original),
  component_id:"epub:spine",original_byte_start:0,original_raw:original,
  hints:[{kind:"poem",start,end:start+lines.length}]
 });
 verifySemanticRevision(revision,original);
 const poem=revision.blocks.find(x=>x.kind==="poem");
 assert(poem?.kind==="poem");
 const allAtoms=walkSemanticAtoms(revision.blocks);
 const introAtom=allAtoms.find(a=>a.raw.includes("EARLY FILES"));
 assert(introAtom);
 const automatic=classifyGutenbergApparatus(original,allAtoms).automaticAtomIds;
 assert(automatic.includes(introAtom.id));
 const edition=selectEditorialEdition(original).range;
 const units=getSemanticPageUnits(revision,edition);
 const projected=units.find(u=>u.kind==="poem");
 assert(projected?.node.kind==="poem");
 assert.deepEqual(projected.source_atom_ids,poem.stanzas.flatMap(s=>s.lines.map(l=>l.atom.id)));
 assert.equal(getOmittedQaAtoms(revision)[introAtom.id],undefined);
 assert.throws(()=>poemInsideEditorialEdition(poem,{start:start+8,end:edition.end}),
  /boundary intersects a poem/);
 // The published component uses this exact projection guard rather than
 // a different independent verse-specific exclusion rule.
 const publicReader=readFileSync(new URL("../components/reader/SemanticPublicReader.tsx",import.meta.url),"utf8");
 assert.match(publicReader,/poemInsideEditorialEdition\(n,range\)/);
});
