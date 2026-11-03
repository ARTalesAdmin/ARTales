import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../ops/sql/20261103_artales_editorial_assignments_v2.sql",import.meta.url),"utf8");
const qa=readFileSync(new URL("../components/editor/SemanticQaPanel.tsx",import.meta.url),"utf8");
const preview=readFileSync(new URL("../app/member/semantic/[candidateId]/page.tsx",import.meta.url),"utf8");
test("only one new text QA per revision; metadata responsibilities are once per work",()=>{
 assert.match(sql,/VALUES\(NEW.candidate_id,NEW.revision_sha256,'text_review'/);
 assert.match(sql,/prior.candidate_id=NEW.candidate_id AND prior.kind=v.kind/);
 for(const kind of ["cover_art","work_description","author_visual","author_bio","collection_curation"])
   assert(sql.includes("'"+kind+"'"));
 assert.match(sql,/NOT v_has_author/);
 assert.doesNotMatch(sql,/\('visual_review','Kontrola/);
});
test("real editors and optional independent reviewer are identity-bound",()=>{
 for(const name of ["Luboš Žížlavský","Ivana Svobodová","Pavla Kratochvílová"])
   assert(sql.includes(name));
 assert.match(sql,/p_reviewer_id<>v_actor|p_reviewer_id=v_actor/);
 assert.match(sql,/p_reviewer_id uuid/);
 assert.match(sql,/v_task.assigned_to<>v_actor/);
});
test("editor logs one issue, does not select arbitrary technical fixes or create tasks",()=>{
 assert.match(qa,/p.onSaved\(\)/);
 assert.doesNotMatch(qa,/applySemanticQaLayoutFix/);
 assert.doesNotMatch(preview,/publishSemanticCandidate|enqueueSemanticReview/);
});
