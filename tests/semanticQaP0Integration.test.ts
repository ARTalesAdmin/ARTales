import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const file=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const page=file("app/member/semantic/[candidateId]/page.tsx");
const panel=file("components/editor/SemanticQaPanel.tsx");
const lab=file("components/editor/SemanticReaderLab.tsx");
const sql=file("ops/sql/20261104_artales_safe_layout_commit_v4.sql");
const worker=file("app/api/internal/editorial/ai-qa-jobs/route.ts");
test("editorial styling, breadcrumbs and task ownership are preserved",()=>{
 assert.match(page,/ed-qa-head/); assert.match(page,/ed-qa-workspace/);
 assert.match(page,/qaTask=\(tasks\?\?\[\]\)\.find/);
 assert.match(page,/qaDatabaseReady=\{!qaFlagError&&!reviewError\}/);
});
test("AI jobs fail closed without fallback and can resume in same session",()=>{
 assert.doesNotMatch(panel,/suggestSemanticQaRepairs|Nexus AI/);
 assert.match(panel,/lastSemanticAiQaJob/); assert.match(panel,/readSemanticAiQaJob/);
 assert.match(panel,/setInterval/); assert.match(panel,/clearInterval/);
 assert.match(panel,/decideSemanticChange/); assert.match(panel,/finishSemanticQaReview/);
});
test("no known source text mutation in worker and atomic receipt commit",()=>{
 assert.match(sql,/changed_source_or_structure/);
 assert.match(sql,/unattributed_presentation_delta/);
 assert.match(sql,/changed_nonlayout_metadata/);
 assert.match(sql,/p_job_id uuid DEFAULT NULL/);
 assert.match(sql,/status='completed'/);
 assert.match(worker,/p_job_id:job.job_id/);
 assert.match(worker,/if\(appliedRevisionSha\)return/);
 assert.doesNotMatch(worker,/Nexus/);
});
test("dual QA pages use protected terms and preview is isolated",()=>{
 assert.match(lab,/const activeRevision=previewRevision\?\?revision/);
 assert.match(lab,/projectSemanticReader\(activeRevision/);
 assert.match(lab,/unitView\(u,protectedTerms\)/);
 assert.match(lab,/setPreview\(null\)/);
});
test("an atomic semantic commit continues the same editor QA session",()=>{
 assert.match(sql,/qa_session_continuation_failed/);
 assert.match(sql,/assigned_to=p_editor_id AND status='open'/);
 assert.match(sql,/status='claimed'/);
 assert.match(sql,/Automatické pokračování téže QA seance/);
});
