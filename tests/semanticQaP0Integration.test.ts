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

test("QA panel keeps one prominent AI handoff and compact searchable findings",()=>{
 const panel=file("components/editor/SemanticQaPanel.tsx");
 const css=file("components/editor/semantic-reader.css");
 assert.match(panel,/Odeslat "\+open.length\+" nálezů k opravě/);
 assert.match(panel,/aria-describedby="artales-ai-queue-feedback"/);
 assert.match(panel,/id="artales-ai-queue-feedback"/);
 assert.match(panel,/Najít a spravovat nálezy/);
 assert.match(panel,/type="search"/);
 assert.match(panel,/findingStatus/);
 assert.match(panel,/Najít v textu/);
 assert.match(panel,/Upravit jednotlivý nález/);
 assert.doesNotMatch(panel,/Další možnosti sazby/);
 assert.match(lab,/GeneralQaDialog/);
 assert.match(lab,/Obecná oprava/);
 assert.match(lab,/Hledat v textu/);
 assert.match(panel,/Přidat nález/);
 assert.match(panel,/Zobrazit a posoudit jednotlivé opravy/);
 assert.match(css,/semantic-qa-panel__flags--compact/);
 assert.match(css,/max-height:min\(52dvh,430px\)/);
 assert.match(panel,/enqueueSemanticAiQaJob/);
 assert.match(panel,/finishSemanticQaReview/);
});

test("reader-first QA adds notes and returns editor to text",()=>{
 assert.match(panel,/p\.onFindingAdded\(\)/);
 assert.match(lab,/onFindingAdded=\{\(\)=>\{setQaPanelOpen\(false\);setSelectedAtomId\(null\);\}\}/);
 assert.match(panel,/Přidat další poznámku/);
 assert.doesNotMatch(panel,/Automaticky označené nejasnosti/);
 assert.match(lab,/data-review-signal=/);
 assert.match(lab,/aria-expanded=\{qaPanelOpen\}/);
 assert.match(panel,/Najít a spravovat nálezy/);
});

test("general QA uses the identity-bound durable queue and safely scoped model discovery",()=>{
 const actions=file("app/member/semantic/[candidateId]/ai-job-actions.ts");
 const engine=file("lib/semantic/aiQaProposalEngine.ts");
 const gateway=file("lib/semantic/artalesAiGateway.ts");
 const dialog=file("components/editor/GeneralQaDialog.tsx");
 assert.match(actions,/enqueueGeneralSemanticQaJob/);
 assert.match(actions,/artales_semantic_qa_flags/);
 assert.match(actions,/kind:"other",comment,created_by:actor.id/);
 assert.match(actions,/enqueueSemanticAiQaJob/);
 assert.match(engine,/generalCandidates/);
 assert.match(engine,/targetAtomIds/);
 assert.match(engine,/new Set\(suggestion.targetAtomIds\)/);
 assert.match(engine,/maxOutputTokens:isGeneral\?4800:2200/);
 assert.match(gateway,/max_output_tokens: input.maxOutputTokens\?\?2200/);
 assert.match(dialog,/exampleAtomId:includeExample\?p.exampleAtomId:null/);
 assert.match(dialog,/readSemanticAiQaJob/);
 assert.match(dialog,/role="dialog"/);
 assert.match(dialog,/max. 4 800 výstupních tokenů/);
 assert.doesNotMatch(dialog,/Nexus/);
});
