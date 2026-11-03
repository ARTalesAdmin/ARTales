import {test} from "node:test";
import {strict as assert} from "node:assert";
import {createHash} from "node:crypto";
import {composeSemanticRevision,recomposeSemanticBatch,verifySemanticRevision,walkSemanticAtoms} from "../lib/semantic/compose";
import {selectEditorialEdition,detectEditionReviewSignals} from "../lib/semantic/editionProjection";
const sha=(v:string)=>createHash("sha256").update(v).digest("hex");
const sample=[
 "The Project Gutenberg eBook of Sample",
 "*** START OF THE PROJECT GUTENBERG EBOOK SAMPLE ***",
 "I",
 "THE EXPERIMENT",
 "A man named Raymond went through the door, then stood in silence.",
 "The ending is here.",
 "THE END.",
 "NOTE.—This note is not part of the literary edition.",
 "*** END OF THE PROJECT GUTENBERG EBOOK SAMPLE ***",
 "Project Gutenberg license"
].join("\n\n");
const input={work_id:"test-qa",work_slug:"test-qa",snapshot_ref:"sha256:"+sha("epub"),
 source_bytes_sha256:sha(sample),component_id:"epub:spine",original_byte_start:0,
 original_raw:sample};
test("ambiguous note is flagged and can be excluded in a complete single batch",()=>{
 const first=composeSemanticRevision(input);
 const atom=walkSemanticAtoms(first.blocks).find(a=>a.raw.startsWith("NOTE."));
 assert(atom);
 const signals=detectEditionReviewSignals(sample,walkSemanticAtoms(first.blocks));
 assert(signals.some(s=>s.atomId===atom!.id));
 const text=walkSemanticAtoms(first.blocks).find(a=>a.raw.includes("Raymond"));
 assert(text);
 const after=recomposeSemanticBatch(first,[
  {flagId:"flag1",atomId:atom!.id,reason:"Exclude electronic edition note",kind:"exclude_from_edition"},
  {flagId:"flag2",atomId:text!.id,reason:"Compact this block",
   kind:"block_presentation",presentation:{align:"left",indent:"none",
   space_before:"none",space_after:"none"}}
 ],sample);
 verifySemanticRevision(after,sample);
 assert.equal(after.round,1);
 assert.notEqual(first.revision_sha256,after.revision_sha256);
 assert.equal(after.review_issues.filter(i=>i.round===1).length,2);
 assert.deepEqual(after.editorial_exclusions,[atom!.id]);
 assert.equal(after.source.normalized_text,first.source.normalized_text);
 assert.deepEqual(walkSemanticAtoms(after.blocks).map(a=>a.id),
  walkSemanticAtoms(first.blocks).map(a=>a.id));
 assert.equal(detectEditionReviewSignals(sample,walkSemanticAtoms(after.blocks),
  after.editorial_exclusions).length,0);
});
test("duplicate corrections, nonexistent atoms and repeat exclusion are rejected",()=>{
 const first=composeSemanticRevision(input);
 const atom=walkSemanticAtoms(first.blocks).find(a=>a.raw.startsWith("NOTE."))!;
 const change={flagId:"flag1",atomId:atom.id,reason:"Editorial exclusion",kind:"exclude_from_edition" as const};
 assert.throws(()=>recomposeSemanticBatch(first,[change,change],sample));
 assert.throws(()=>recomposeSemanticBatch(first,[{...change,atomId:"nonexistent"}],sample));
 const updated=recomposeSemanticBatch(first,[change],sample);
 assert.throws(()=>recomposeSemanticBatch(updated,[{...change,flagId:"flag2"}],sample));
 assert.throws(()=>recomposeSemanticBatch(updated,[],sample));
});
test("source integrity never changes when a note is hidden",()=>{
 const original=composeSemanticRevision(input);
 const note=walkSemanticAtoms(original.blocks).find(a=>a.raw.startsWith("NOTE."))!;
 const updated=recomposeSemanticBatch(original,[{flagId:"note",atomId:note.id,
  kind:"exclude_from_edition",reason:"Not part of the new edition"}],sample);
 assert.equal(updated.source.normalized_text_sha256,original.source.normalized_text_sha256);
 assert.equal(updated.source.source_snapshot_ref,original.source.source_snapshot_ref);
 assert.equal(updated.source.normalized_text,original.source.normalized_text);
 assert.equal(selectEditorialEdition(sample).range.end<sample.length,true);
});