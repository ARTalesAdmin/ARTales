import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const file=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=file("ops/sql/20261104_artales_ai_qa_durable_jobs.sql");
const worker=file("app/api/internal/editorial/ai-qa-jobs/route.ts");
const actions=file("app/member/semantic/[candidateId]/ai-job-actions.ts");
const engine=file("lib/semantic/aiQaProposalEngine.ts");
const safe=file("ops/sql/20261104_artales_safe_layout_commit_v4.sql");
const cron=JSON.parse(file("vercel.json"));
test("owner-bound queue, RLS, rate-limits and concurrency claim",()=>{
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/created_by=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/FOR UPDATE SKIP LOCKED/);
 assert.match(sql,/hourly_limit/);
 assert.match(sql,/attempt_count<2/);
});
test("worker cannot run without configured secret/service role",()=>{
 assert.match(worker,/timingSafeEqual/);
 assert.match(worker,/CRON_SECRET/);
 assert.match(worker,/ARTALES_AI_DURABLE_JOBS_ENABLED/);
 assert.match(worker,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(sql,/service_worker_only/);
 assert.match(cron.crons[0].path,/artales|ai-qa-jobs/);
});
test("source-verified structured AI patches with atomic job receipt",()=>{
 assert.match(engine,/verifySemanticRevision/);
 assert.match(engine,/requestArtalesAiResponse/);
 assert.doesNotMatch(engine,/api\\.openai\\.com/);
 assert.match(worker,/artales_semantic_ai_usage/);
 assert.match(worker,/ignoreDuplicates:true/);
 assert.match(safe,/changed_source_or_structure/);
 assert.match(safe,/unattributed_presentation_delta/);
 assert.match(safe,/p_job_suggestions/);
 assert.match(worker,/if\(appliedRevisionSha\)return/);
 assert.doesNotMatch(worker,/\.insert\(|\.update\(/);
 assert.match(actions,/readSemanticAiQaJob/);
 assert.match(actions,/lastSemanticAiQaJob/);
});
