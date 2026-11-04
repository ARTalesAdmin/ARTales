import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../ops/sql/20261104_artales_editorial_pool_ownership_v3.sql",import.meta.url),"utf8");
const queue=readFileSync(new URL("../app/member/editorial-pipeline/page.tsx",import.meta.url),"utf8");
const actions=readFileSync(new URL("../app/member/editorial-pipeline/actions.ts",import.meta.url),"utf8");
const ai=readFileSync(new URL("../app/member/semantic/[candidateId]/ai-qa-actions.ts",import.meta.url),"utf8");
const qa=readFileSync(new URL("../components/editor/SemanticQaPanel.tsx",import.meta.url),"utf8");

test("capabilities protect fixed visual work and enable two text editors",()=>{
 assert.match(sql,/artales_editorial_capabilities/);
 assert.match(sql,/Pavla Kratochvílová/);
 assert.match(sql,/Ivana Svobodová/);
 assert.match(sql,/\('cover_art'\),\('author_visual'\),\('collection_curation'\)/);
 assert.match(sql,/task_staff_read/);
 assert.match(sql,/assigned_to=\(SELECT auth.uid\(\)\)/);
 assert.match(sql,/artales_legacy_transfers/);
});
test("claim is serialized and refuses theft or stale revision",()=>{
 assert.match(sql,/FROM public.profiles p[\s\S]+FOR UPDATE/);
 assert.match(sql,/FROM public.artales_editorial_tasks WHERE id=p_task_id FOR UPDATE/);
 assert.match(sql,/v_task.assigned_to<>v_actor/);
 assert.match(sql,/stale_revision/);
 assert.match(sql,/qa_capacity_full/);
 assert.match(sql,/not_eligible/);
});
test("release and reassign produce durable before-after actor events",()=>{
 assert.match(sql,/FUNCTION public.artales_release_editorial_task/);
 assert.match(sql,/FUNCTION public.artales_reassign_editorial_task/);
 assert.match(sql,/from_assignee,to_assignee/);
 assert.match(sql,/v_task.assigned_to,p_new_assignee/);
 assert.match(actions,/requireAdmin\(\)/);
 assert.match(actions,/artales_reassign_editorial_task/);
 assert.match(actions,/artales_release_editorial_task/);
});
test("available-work list and overview are role scoped",()=>{
 assert.match(queue,/eligible\.has\(t.kind\)/);
 assert.match(queue,/t.assigned_to===null/);
 assert.match(queue,/isAdmin\?active\.filter/);
 assert.match(queue,/Chci zpracovat další titul/);
 assert.match(queue,/Dokončená práce podle editora a druhu/);
});
test("AI has strict proposal-only boundary and current-revision ownership",()=>{
 assert.match(ai,/verifySemanticRevision\(revision,record.source_text\)/);
 assert.match(ai,/\.eq\("assigned_to",actor.id\)\.eq\("status","claimed"\)/);
 assert.match(ai,/max_output_tokens:2200/);
 assert.match(ai,/store:false/);
 assert.match(ai,/json_schema/);
 assert.match(ai,/action:"compact"\|"airy"\|"center"\|"protect_term"\|"manual_review"/);
 assert.doesNotMatch(ai,/action:"compact"\|"airy"\|"center"\|"exclude_note"/);
 assert.doesNotMatch(ai,/\.insert\(|\.update\(|artales_commit_semantic_qa_batch/);
 assert.match(qa,/Navrhnout opravy pomocí AI/);
 assert.match(qa,/AI suggestions are NEVER committed automatically/);
});

test("layout preview and commit share one immutable source proof",()=>{
 const action=readFileSync(new URL("../app/member/semantic/[candidateId]/qa-actions.ts",import.meta.url),"utf8");
 const reader=readFileSync(new URL("../components/editor/SemanticReaderLab.tsx",import.meta.url),"utf8");
 assert.match(action,/previewSemanticQaBatch/);
 assert.match(action,/prepareQaPresentationBatch/);
 assert.match(action,/sourceAtoms.some/);
 assert.match(action,/a.raw!==afterAtoms\[i\].raw/);
 assert.match(reader,/previewRevision\?\?revision/);
 assert.match(reader,/Zobrazen/);
 assert.match(reader,/setPreviewRevision\(null\)/);
});
