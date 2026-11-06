import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const inbox=read("app/member/editorial-pipeline/page.tsx");
const candidate=read("app/member/editorial-detail/[candidateId]/page.tsx");
const qa=read("app/member/semantic/[candidateId]/page.tsx");
const cover=read("components/editor/CandidateCoverInput.tsx");
const css=read("components/editor/editorial-workspace.css");
const actions=read("app/member/editorial-pipeline/actions.ts");
const save=read("app/member/editorial-detail/[candidateId]/actions.ts");

test("ARTales editorial work surfaces share branded responsive design, not inline technical cards",()=>{
 for(const page of [inbox,candidate,qa]){
  assert.match(page,/editorial-workspace\.css/);
  assert.match(page,/ed-hero/);
  assert.match(page,/ed-breadcrumb/);
 }
 assert.match(css,/\.ed-page/);
 assert.match(css,/\.ed-detail-grid/);
 assert.match(css,/\.ed-task/);
 assert.match(css,/@media \(max-width: 690px\)/);
 assert.match(css,/:focus-visible/);
 assert.match(css, /prefers-reduced-motion/);
 assert.doesNotMatch(css,/\.artales-reader|\.artales-member-sidebar/);
});

test("task inbox has prominent actions, accurate ownership and still supports all existing workflows",()=>{
 assert.match(inbox,/id="moje-prace"/);
 assert.match(inbox,/id="dalsi-titul"/);
 assert.match(inbox,/id="prehled-garanta"/);
 assert.match(inbox,/ed-status/);
 assert.match(inbox,/const canClaim=/);
 assert.match(inbox,/claimSemanticTask/);
 assert.match(inbox,/releaseEditorialTask/);
 assert.match(inbox,/reassignEditorialTask/);
 assert.match(inbox,/requestSemanticSecondReview/);
 assert.match(inbox,/resolveEditorialHelp/);
 assert.match(inbox,/completeSemanticTask/);
 assert.match(inbox,/t\.kind==="cover_art"\?"cover"/);
 assert.match(inbox,/t\.kind==="collection_curation"\?"collection"/);
 assert.match(inbox,/t\.kind==="work_description"\?"description"/);
 assert.match(inbox,/t\.kind==="text_review"/);
 assert.match(actions,/artales_complete_editorial_task/);
});

test("candidate detail has four distinct persistent forms and accessible progress",()=>{
 for(const id of ["author","collection","description","cover"])
  assert.match(candidate,new RegExp('id="'+id+'"'));
 assert.match(candidate,/name="field" value="author"/);
 assert.match(candidate,/name="field" value="collection"/);
 assert.match(candidate,/name="field" value="description"/);
 assert.match(candidate,/name="field" value="cover"/);
 assert.match(candidate,/name="candidate_id"/);
 assert.match(candidate,/<progress value=\{completedCount\} max=\{4\}/);
 assert.match(candidate,/completeForm\("author_bio"/);
 assert.match(candidate,/completeForm\("author_visual"/);
 assert.match(candidate,/saveCandidateEditorialField/);
 assert.match(save,/artales_save_candidate_editorial_field/);
 assert.match(save,/artales_complete_editorial_task/);
});

test("QA layout is linked to editorial work without changing the source or QA controls",()=>{
 assert.match(qa,/<SemanticReaderLab/);
 assert.match(qa,/verifySemanticRevision/);
 assert.match(qa,/openFindings/);
 assert.match(qa,/\/member\/editorial-detail\//);
 assert.match(qa,/\/member\/editorial-pipeline/);
 assert.match(qa,/canCommitBatch=\\{Boolean\\(qaTask\\)\\}/);
 assert.match(qa,/qaTask=\\(tasks\\?\\?\\[\\]\\)\\.find/);
 assert.match(qa,/currentTaskId=\\{qaTask\\?\\.id\\?\\?null\\}/);
 assert.match(qa,/flags=\{qaFlags\?\?\[\]\}/);
 assert.doesNotMatch(qa,/update.*source_text/);
});

test("cover upload remains storage-backed with a clear save and no edits to legacy works",()=>{
 assert.match(cover,/\.storage\.from\(ARTALES_IMAGES_BUCKET\)\.upload/);
 assert.match(cover,/ARTALES_IMAGE_MAX_UPLOAD_BYTES/);
 assert.match(cover,/ed-filebox/);
 assert.match(cover,/type="submit" disabled=\{busy\|\|!path/);
 assert.doesNotMatch([candidate,inbox,qa,cover,css].join("\n"),/paginateReaderBlocks/);
});
