import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {isExplicitWholeBlockExclusion,getExcludableAtomIds} from "../lib/semantic/qaExclusionPolicy";
import {planQaProposalReview} from "../lib/semantic/qaProposalReview";
import {composeSemanticRevision,recomposeSemanticBatch,verifySemanticRevision,walkSemanticAtoms} from "../lib/semantic/compose";
const source=(name:string)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const sha=(raw:string)=>createHash("sha256").update(raw).digest("hex");
test("unambiguous repeated editor removal request is a whole-block exclusion",()=>{
 for(const comment of ["Smazat,smazat,smazat.","Smazat, smazat, smazat.","Vyřadit celý blok","Delete whole paragraph"]){
  assert.equal(isExplicitWholeBlockExclusion(comment),true,comment);
 }
 for(const comment of ["Nemazat!","Smazat pouze první slovo.","Odstranit čárku, nikoliv blok.","Ponechat, smazat až později.","Obecné zadání pro dílo: smazat všechny předmluvy"]){
  assert.equal(isExplicitWholeBlockExclusion(comment),false,comment);
 }
});
test("removal requests never resolve as harmless manual review",()=>{
 const ids=["f3760efc-9bec-43e9-99d4-b246fda56c69","9ba839a4-6874-4414-9670-67128ea15959"];
 const flags=ids.map(id=>({id,kind:"typography",status:"open",comment:"Smazat, smazat, smazat."}));
 const choices=ids.map(flagId=>({flagId,choice:"approve" as const}));
 const ordinary=ids.map(flagId=>({flagId,action:"manual_review" as const,term:"",rationale:"No change",targetAtomIds:[],editorialIntent:"none" as const}));
 assert.throws(()=>planQaProposalReview(ordinary,flags,choices),/vyřazení|beze změny/);
 const valid=ordinary.map(s=>({...s,editorialIntent:"exclude_from_edition" as const}));
 const plan=planQaProposalReview(valid,flags,choices);
 assert.deepEqual(plan.exclusions,ids.map(flagId=>({flagId})));
 assert.equal(plan.confirmedNoChange.length,0);
 assert.equal(plan.layout.length,0);
 const rejected=planQaProposalReview(valid,flags,[{flagId:ids[0],choice:"approve"},{flagId:ids[1],choice:"reject"}]);
 assert.deepEqual(rejected.rejected,[ids[1]]);
 assert.deepEqual(rejected.exclusions,[{flagId:ids[0]}]);
});
test("source preserving exclusion keeps original text and protected structural headings",()=>{
 const raw="The Project Gutenberg eBook of Sample\n\n*** START OF THE PROJECT GUTENBERG EBOOK SAMPLE ***\n\n"+
  "TITLE PAGE\n\nBy J. W. Author\n\nTranslated by R. Translator\n\nBOOK I\n\nCHAPTER I\n\n"+
  "This is the first real chapter of the novel, and it must remain visible.\n\n"+
  "*** END OF THE PROJECT GUTENBERG EBOOK SAMPLE ***";
 const rev=composeSemanticRevision({work_id:"qa-illustration",work_slug:"qa-illustration",
  snapshot_ref:"sha256:"+sha("archive"),source_bytes_sha256:sha(raw),
  component_id:"text",original_byte_start:0,original_raw:raw});
 const allowed=getExcludableAtomIds(rev);
 const atoms=walkSemanticAtoms(rev.blocks);
 const selected=atoms.filter(a=>["TITLE PAGE","By J. W. Author","Translated by R. Translator","BOOK I"].some(k=>a.raw.trim()===k));
 assert.equal(selected.length,4);
 assert(selected.every(a=>allowed.has(a.id)));
 const changes=selected.map((a,i)=>({flagId:"flag-"+i,atomId:a.id,reason:"Smazat,smazat,smazat.",kind:"exclude_from_edition" as const}));
 const revised=recomposeSemanticBatch(rev,changes,raw);
 verifySemanticRevision(revised,raw);
 assert.equal(revised.editorial_exclusions?.length,4);
 assert.equal(revised.source.normalized_text,raw);
 assert.equal(revised.source.normalized_text_sha256,rev.source.normalized_text_sha256);
 assert(atoms.some(a=>a.raw.includes("first real chapter")));
 assert.deepEqual(walkSemanticAtoms(revised.blocks).map(a=>a.raw),atoms.map(a=>a.raw));
});
test("worker does not auto-apply an exclusion or unrelated layout ahead of editor review",()=>{
 const worker=source("app/api/internal/editorial/ai-qa-jobs/route.ts");
 const review=source("app/member/semantic/[candidateId]/qa-proposal-actions.ts");
 const ui=source("components/editor/SemanticAiProposalReview.tsx");
 const engine=source("lib/semantic/aiQaProposalEngine.ts");
 assert.match(worker,/requiresEditorialExclusion/);
 assert.match(worker,/!requiresEditorialExclusion/);
 assert.match(review,/plan\.exclusions\.map\(x=>\(\{flagId:x.flagId,action:"exclude_note" as const\}\)\)/);
 assert.match(review,/artales_commit_editorial_review_batch/);
 assert.match(ui,/Schválit vyřazení/);
 assert.match(ui,/previewSemanticQaBatch/);
 assert.match(engine,/getExcludableAtomIds/);
 assert.match(engine,/editorialIntent:"exclude_from_edition"/);
});
