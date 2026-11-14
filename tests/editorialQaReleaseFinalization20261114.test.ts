import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("supabase/migrations/20261114190000_artales_qa_publication_finalization.sql");
const qa=read("app/member/semantic/[candidateId]/qa-actions.ts");
const prep=read("lib/semantic/qaBatchPreparation.ts");
const panel=read("components/editor/SemanticQaPanel.tsx");
const action=read("app/member/editorial-pipeline/actions.ts");
const page=read("app/member/editorial-detail/[candidateId]/page.tsx");
const reader=read("app/reader/[slug]/page.tsx");
const publicReader=read("components/reader/SemanticPublicReader.tsx");

test("publication trigger dispatches by actual table before reading task-only fields",()=>{
 const body=sql.split("CREATE OR REPLACE FUNCTION public.artales_block_unresolved_semantic_qa()")[1]
   .split("CREATE OR REPLACE FUNCTION public.artales_commit_editorial_exclusions")[0];
 assert.match(body,/IF TG_TABLE_NAME='artales_editorial_tasks' THEN\s+IF NEW.kind='text_review'/);
 assert.match(body,/ELSIF TG_TABLE_NAME='artales_semantic_publications' THEN/);
 assert.doesNotMatch(body,/IF TG_TABLE_NAME='artales_editorial_tasks'\s+AND NEW.kind/);
 assert.match(body,/release_unresolved_qa_flags/);
 assert.match(body,/release_editorial_work_incomplete/);
});
test("three-character QA comments are validated in UI, server and SQL",()=>{
 assert.match(panel,/minLength=\{3\}/);
 assert.match(panel,/comment.trim\(\).length<3/);
 assert.match(qa,/input.comment.trim\(\).length<3/);
 assert.match(sql,/CHECK \(length\(btrim\(comment\)\) BETWEEN 3 AND 4000\)/);
});
test("publication note is optional but durable audit evidence is retained",()=>{
 assert.match(page,/Poznámka k vydání \(volitelná\)/);
 assert.doesNotMatch(page,/<textarea name="reason"[^>]*required/);
 assert.match(action,/const auditReason=reason\|\|/);
 assert.match(action,/p_summary:summary,p_reason:auditReason/);
 assert.doesNotMatch(action,/reason.trim\(\).length<30/);
});
test("editor-approved exclusions preserve original source and create a signed one-time review",()=>{
 assert.match(prep,/\["text","typography","structure","other"\]/);
 assert.match(sql,/f.kind IN \('text','typography','structure','other'\)/);
 assert.match(panel,/Vyřadit celý blok z edice ARTales/);
 assert.match(sql,/INSERT INTO public.artales_semantic_change_reviews/);
 assert.match(sql,/exclusion_review_receipt_missing/);
 assert.match(sql,/v_old.source_text/);
 assert.doesNotMatch(sql,/UPDATE public.candidate_semantic_revisions SET source_text/);
});
test("publication stores current revision and Reader renders edition exclusions",()=>{
 const fn=read("supabase/migrations/20261107094500_artales_candidate_release_canonical.sql");
 assert.match(fn,/artales_semantic_publications/);
 assert.match(reader,/artales_semantic_publications/);
 assert.match(reader,/semanticRelease.semantic_revision/);
 assert.match(publicReader,/revision.editorial_exclusions/);
 assert.match(publicReader,/excluded.has\(n.atom.id\)/);
});
