import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../ops/sql/20261104_artales_ai_qa_durable_jobs.sql",import.meta.url),"utf8");
const worker=readFileSync(new URL("../app/api/internal/editorial/ai-qa-jobs/route.ts",import.meta.url),"utf8");
const actions=readFileSync(new URL("../app/member/semantic/[candidateId]/ai-job-actions.ts",import.meta.url),"utf8");
const engine=readFileSync(new URL("../lib/semantic/aiQaProposalEngine.ts",import.meta.url),"utf8");
const panel=readFileSync(new URL("../components/editor/SemanticQaPanel.tsx",import.meta.url),"utf8");
const cron=readFileSync(new URL("../vercel.json",import.meta.url),"utf8");

test("only eligible editors can enqueue and only job owner/admin can inspect",()=>{
 assert.match(sql,/artales_enqueue_ai_qa_job/);
 assert.match(sql,/t\.assigned_to=v_actor AND t\.status='claimed'/);
 assert.match(sql,/created_by=\(SELECT auth.uid\(\)\)/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/hourly_limit/);
 assert.match(sql,/pg_catalog\.cardinality\(v_flags\) NOT BETWEEN 1 AND 25/);
});
test("background worker requires protected authorization and service-role identity",()=>{
 assert.match(worker,/timingSafeEqual/);
 assert.match(worker,/process.env.CRON_SECRET/);
 assert.match(worker,/process.env.ARTALES_AI_DURABLE_JOBS_ENABLED/);
 assert.match(worker,/process.env.SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(sql,/current_setting\('request.jwt.claim.role',true\)<>'service_role'/);
 assert.match(sql,/FOR UPDATE SKIP LOCKED/);
 assert.match(sql,/attempt_count<2/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public.artales_claim_ai_qa_job\(\) TO service_role/);
 assert.deepEqual(JSON.parse(cron).crons[0],{
  path:"/api/internal/editorial/ai-qa-jobs",schedule:"* * * * *"
 });
});
test("worker stores proposals and only commits independently verified layout revisions",()=>{
 assert.match(worker,/generateSemanticAiQaSuggestions/);
 assert.match(worker,/prepareQaPresentationBatch/);
 assert.match(worker,/artales_commit_safe_layout_revision/);
 assert.match(worker,/p_editor_id:job.created_by/);
 assert.match(worker,/p_applied_revision_sha:appliedRevisionSha/);
 assert.match(engine,/expectedFlagIds/);
 assert.match(engine,/verifySemanticRevision\(revision,record.source_text\)/);
 assert.doesNotMatch(worker,/\.insert\(|\.update\(|candidate_semantic_revisions.*\.insert/);
 assert.match(sql,/suggestions jsonb/);
 assert.match(sql,/status IN \('queued','running','completed','failed'\)/);
 assert.doesNotMatch(sql,/UPDATE public\.candidate_semantic_revisions|UPDATE public\.artales_semantic_qa_flags/);
});
test("the session can resume an existing job and poll the saved result",()=>{
 assert.match(actions,/lastSemanticAiQaJob/);
 assert.match(actions,/readSemanticAiQaJob/);
 assert.match(panel,/setInterval/);
 assert.match(panel,/clearInterval/);
 assert.match(panel,/lastSemanticAiQaJob/);
 assert.match(panel,/if\(result.appliedRevisionSha\)router.refresh\(\)/);
 assert.match(panel,/acceptAiSuggestions\(result.suggestions\)/);
});
