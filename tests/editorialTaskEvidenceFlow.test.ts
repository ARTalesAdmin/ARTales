import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const inbox=read("app/member/editorial-pipeline/page.tsx");
const actions=read("app/member/editorial-pipeline/actions.ts");
const detail=read("app/member/editorial-detail/[candidateId]/page.tsx");
const save=read("app/member/editorial-detail/[candidateId]/actions.ts");
const cover=read("components/editor/CandidateCoverInput.tsx");
const sql=read("ops/sql/20261105_artales_candidate_editorial_metadata_gate.sql");

test("tasks open their own work area rather than sending every assignment to QA",()=>{
 assert.match(inbox,/t\.kind==="cover_art"\?"cover"/);
 assert.match(inbox,/t\.kind==="collection_curation"\?"collection"/);
 assert.match(inbox,/t\.kind==="work_description"\?"description"/);
 assert.match(inbox,/"\/member\/editorial-detail\/"\+t\.candidate_id/);
 assert.match(inbox,/"\/member\/semantic\/"\+t\.candidate_id/);
 assert.match(detail,/\/member\/authors\/.*\/edit/);
 assert.match(detail,/\/member\/collections\/.*\/edit/);
});
test("persisted candidate links never mutate public legacy WorkBlock content",()=>{
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.artales_candidate_editorial_metadata/);
 assert.match(sql,/candidate_id uuid PRIMARY KEY/);
 assert.match(sql,/author_id uuid REFERENCES public\.authors/);
 assert.match(sql,/collection_id uuid REFERENCES public\.collections/);
 assert.doesNotMatch(sql,/UPDATE public\.works|ALTER TABLE public\.works/);
 assert.doesNotMatch(save,/updateWork\(/);
});
test("task completion is rejected in database without actual result, not merely note",()=>{
 assert.match(sql,/CREATE TRIGGER artales_editorial_task_evidence_gate/);
 assert.match(sql,/BEFORE UPDATE OF status/);
 assert.match(sql,/NEW\.status<>'completed'/);
 assert.match(sql,/WHEN 'collection_curation' THEN m\.collection_id IS NOT NULL/);
 assert.match(sql,/WHEN 'cover_art' THEN m\.cover_image_path IS NOT NULL/);
 assert.match(sql,/storage\.objects/);
 assert.match(sql,/WHEN 'work_description' THEN length/);
 assert.match(sql,/WHEN 'author_bio' THEN m\.author_id IS NOT NULL/);
 assert.match(sql,/WHEN 'author_visual' THEN m\.author_id IS NOT NULL/);
 assert.match(sql,/RAISE EXCEPTION 'editorial_evidence_missing/);
});
test("client cannot forge stored metadata or claim unowned task",()=>{
 assert.match(sql,/REVOKE ALL ON public\.artales_candidate_editorial_metadata FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/CREATE POLICY candidate_editorial_metadata_staff_read/);
 assert.match(sql,/v_role<>'admin' AND NOT EXISTS/);
 assert.match(sql,/t\.status='claimed'/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.artales_save_candidate_editorial_field/);
 assert.match(save,/artales_save_candidate_editorial_field/);
 assert.match(save,/artales_complete_editorial_task/);
 assert.match(actions,/if\(task\.kind==="text_review"\)/);
});
test("cover is actually uploaded before save and is supported by storage-backed evidence",()=>{
 assert.match(cover,/\.storage\.from\(ARTALES_IMAGES_BUCKET\)\.upload/);
 assert.match(cover,/works\/\$\{candidateId\}\/cover/);
 assert.match(cover,/ARTALES_IMAGE_MAX_UPLOAD_BYTES/);
 assert.match(sql,/cover_asset_missing/);
 assert.match(sql,/s\.bucket_id='artales-images' AND s\.name=v_path/);
});
test("successful save automatically completes simple metadata tasks and keeps QA separate",()=>{
 assert.match(save,/field==="collection"\?"collection_curation"/);
 assert.match(save,/field==="description"\?/);
 assert.match(save,/field==="cover"\?/);
 assert.match(save,/if\(completed\?\.result==="completed"\)/);
 assert.match(detail,/id="author"/);
 assert.match(detail,/id="collection"/);
 assert.match(detail,/id="description"/);
 assert.match(detail,/id="cover"/);
 assert.match(detail,/completeForm\("author_bio"/);
 assert.match(detail,/completeForm\("author_visual"/);
});
