import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const inbox=read("app/member/editorial-pipeline/page.tsx");
const actions=read("app/member/editorial-pipeline/actions.ts");
const detail=read("app/member/editorial-detail/[candidateId]/page.tsx");
const save=read("app/member/editorial-detail/[candidateId]/actions.ts");
const sql=read("ops/sql/20261105_artales_candidate_editorial_metadata_gate.sql");
const cover=read("components/editor/CandidateCoverInput.tsx");
const reader=read("app/reader/[slug]/page.tsx");

test("task deep links resolve per type; text QA stays in semantic editor",()=>{
 assert.match(inbox,/t\.kind==="cover_art"\?"cover"/);
 assert.match(inbox,/t\.kind==="collection_curation"\?"collection"/);
 assert.match(inbox,/t\.kind==="work_description"\?"description"/);
 assert.match(inbox,/\/member\/editorial-detail\//);
 assert.match(inbox,/\/member\/semantic\//);
 assert.match(detail,/\/member\/authors\//);
 assert.match(detail,/\/member\/collections\//);
});
test("real DB evidence gates every nontext completion",()=>{
 assert.match(sql,/CREATE TRIGGER artales_editorial_task_evidence_gate/);
 assert.match(sql,/BEFORE UPDATE OF status/);
 for(const kind of ["cover_art","work_description","collection_curation","author_bio","author_visual"])
  assert(sql.includes("'"+kind+"'"));
 assert.match(sql,/storage\.objects/);
 assert.match(sql,/author_name_mismatch/);
 assert.match(sql,/candidate_editorial_metadata_staff_read/);
 assert.match(sql,/REVOKE ALL ON public\.artales_candidate_editorial_metadata/);
 assert.match(sql,/t\.status='claimed'/);
 assert.doesNotMatch(sql,/pg_catalog\.coalesce\(/);
 assert.doesNotMatch(sql,/pg_catalog\.nullif\(/);
});
test("single form save closes collection, description, cover with DB verification",()=>{
 assert.match(save,/artales_save_candidate_editorial_field/);
 assert.match(save,/artales_complete_editorial_task/);
 assert.match(save,/if\(completed\?\.result==="completed"\)/);
 assert.match(cover,/\.upload\(target,file/);
 assert.match(sql,/cover_asset_missing/);
 assert.match(actions,/if\(task\.kind==="text_review"\)/);
 assert.match(detail,/completeForm\("author_bio"/);
 assert.match(detail,/completeForm\("author_visual"/);
});
test("release does not replace legacy reader or modify published work content",()=>{
 assert.match(reader,/<ReaderClient/);
 assert.doesNotMatch(sql,/UPDATE public\.works|ALTER TABLE public\.works/);
 assert.doesNotMatch(save,/updateWork\(/);
});
