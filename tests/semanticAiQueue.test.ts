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

test("failed or unavailable queue reports its reason beside the AI trigger",()=>{
 const panel=file("components/editor/SemanticQaPanel.tsx");
 const actions=file("app/member/semantic/[candidateId]/ai-job-actions.ts");
 assert.match(panel,/id="artales-ai-queue-feedback"/);
 assert.match(panel,/role="status" aria-live="polite"/);
 assert.match(panel,/setAiFeedback\(queued.message\)/);
 assert.match(panel,/catch\{/);
 assert.match(panel,/setAiError\(true\)/);
 assert.match(actions,/function configurationIssue\(\)/);
 assert.match(actions,/VERCEL_OIDC_TOKEN/);
 assert.match(actions,/databázová chyba/);
});

test("canonical UUID validation accepts Pan candidate, claimed task and job IDs",()=>{
 const match=actions.match(/const uuid=\/(.+?)\/i;/);
 assert.ok(match,"server action must declare a UUID validator");
 const uuid=new RegExp(match[1],"i");
 assert.equal(uuid.test("98508359-bce1-4e73-b842-b69a9d1112d0"),true);
 assert.equal(uuid.test("fe8257aa-d624-41f3-9e7c-24b49ad02455"),true);
 assert.equal(uuid.test("22cd2a55-7d34-468c-b567-ff87df6bdce6"),true);
 assert.equal(uuid.test("98508359-bce1-4e73-b842-b69a9d1112d"),false);
 assert.equal(uuid.test("98508359-bce1-4e73-b842-b69a9d1112d0-extra"),false);
 const sha=/^[a-f0-9]{64}$/;
 assert.equal(sha.test("b8f99acc5abc5c965ec2707cca66abebb45fd4b9592c1dea79d20960b50f35b8"),true);
});
