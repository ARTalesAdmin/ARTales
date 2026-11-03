import {test} from "node:test";
import {strict as assert} from "node:assert";
import {createHash} from "node:crypto";
import {projectSemanticProseText} from "../lib/semantic/displayText";
import {composeSemanticRevision,submitSemanticIssue,recomposeSemanticLayout,verifySemanticRevision,walkSemanticAtoms} from "../lib/semantic/compose";
const sha=(v:string)=>createHash("sha256").update(v).digest("hex");
test("one-letter English words stay with following word without changing source",()=>{
 const raw="The text ended; I\nwas there, and a\nlong silence followed.";
 const rendered=projectSemanticProseText(raw);
 assert.match(rendered,/I\u00a0was/);
 assert.match(rendered,/a\u00a0long/);
 assert.equal(raw.includes("\u00a0"),false);
 assert.equal(raw.includes("\nwas"),true);
});
test("anchored QA layout repair produces a new immutable SHA and preserves exact source",()=>{
 const source="CHAPTER I. Test\n\nParagraph one is long enough to be a real paragraph in an editable literary edition.\n\nAnother paragraph for quality assurance.";
 const input={work_id:"sample-id",work_slug:"sample-book",snapshot_ref:"sha256:"+sha("epub"),
  source_bytes_sha256:sha(source),component_id:"epub:spine",original_byte_start:0,original_raw:source};
 const first=composeSemanticRevision(input);
 verifySemanticRevision(first,source);
 const a=walkSemanticAtoms(first.blocks).find(atom=>atom.raw.startsWith("Paragraph one"));
 assert(a);
 const issue=submitSemanticIssue(first,{id:"qa-test-1",target_atom_id:a!.id,
  kind:"typography",reason:"Too much whitespace in the selected paragraph",
  requested_layout:"block_presentation",
  requested_presentation:{align:"left",indent:"none",space_before:"none",space_after:"none"}});
 const second=recomposeSemanticLayout(first,issue,source);
 verifySemanticRevision(second,source);
 assert.equal(second.round,first.round+1);
 assert.equal(second.parent_revision_ref,first.revision_ref);
 assert.notEqual(second.revision_sha256,first.revision_sha256);
 assert.equal(second.source.normalized_text,first.source.normalized_text);
 assert.deepEqual(walkSemanticAtoms(second.blocks).map(x=>x.id),walkSemanticAtoms(first.blocks).map(x=>x.id));
 assert.equal(second.release_allowed,false);
 assert.equal(first.round,0);
 assert.throws(()=>recomposeSemanticLayout(first,{...issue,target_atom_id:"wrong"},source));
});
