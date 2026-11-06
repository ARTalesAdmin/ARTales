import {test} from "node:test";
import {strict as assert} from "node:assert";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {composeSemanticRevision,recomposeSemanticBatch,verifySemanticRevision,walkSemanticAtoms}
 from "../lib/semantic/compose";

test("layout-only revision of legacy round-zero work preserves absent optional metadata",()=>{
 const raw="CHAPTER I.\n\nDr. Raymond watched the long road beyond the hill.\n\nThe two men went on walking.\n";
 const hash=createHash("sha256").update(raw).digest("hex");
 const original=composeSemanticRevision({
  work_id:"fixture-pan",work_slug:"fixture-pan",
  snapshot_ref:"sha256:"+hash,source_bytes_sha256:hash,
  component_id:"fixture",original_byte_start:0,original_raw:raw
 });
 assert.equal(Object.prototype.hasOwnProperty.call(original,"editorial_exclusions"),false);
 const atom=walkSemanticAtoms(original.blocks).find(x=>x.raw.includes("Raymond"));
 assert.ok(atom);
 const revised=recomposeSemanticBatch(original,[{
  flagId:"b39525e5-c4fd-4b7f-9871-dbc2fcea6565",
  atomId:atom.id,reason:"Typografie bloku vyžaduje změnu sazby.",
  kind:"block_presentation",
  presentation:{align:"center",indent:"none",space_before:"normal",space_after:"normal"}
 }],raw);
 verifySemanticRevision(revised,raw);
 assert.equal(Object.prototype.hasOwnProperty.call(revised,"editorial_exclusions"),false,
  "a layout-only revision may not introduce a previously absent metadata key");
 const excluded=["revision_ref","revision_sha256","parent_revision_ref","round","blocks","review_issues"];
 const without=(value:Record<string,unknown>)=>Object.fromEntries(
  Object.entries(value).filter(([k])=>!excluded.includes(k)));
 assert.deepEqual(without(revised),without(original));
 assert.deepEqual(revised.source,original.source);
 assert.deepEqual(revised.gaps,original.gaps);
 assert.equal(revised.review_issues.length,original.review_issues.length+1);
 assert.equal(revised.parent_revision_ref,original.revision_ref);
 assert.equal(revised.round,original.round+1);
});

test("AI worker records paid proposals even when layout persistence fails",()=>{
 const route=readFileSync(new URL("../app/api/internal/editorial/ai-qa-jobs/route.ts",import.meta.url),"utf8");
 const engine=readFileSync(new URL("../lib/semantic/aiQaProposalEngine.ts",import.meta.url),"utf8");
 assert.match(route,/if\(repairs\.length&&!answer\.generalRequest\)/,
  "general discovery must not commit an unrelated layout revision");
 assert.match(route,/const validSuggestions=Array\.isArray\(suggestions\)/);
 assert.match(route,/const terminalError=validSuggestions\?null/);
 assert.match(route,/p_suggestions:validSuggestions\?suggestions:null/);
 assert.match(route,/layout_warning/);
 assert.match(engine,/generalRequest:isGeneral/);
});
