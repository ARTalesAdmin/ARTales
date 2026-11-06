import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {parseArtalesGatewayUsage,aggregateArtalesAiUsage} from "../lib/semantic/aiGatewayUsage";

test("gateway usage preserves null cost rather than recording false zero",()=>{
  const usage=parseArtalesGatewayUsage({
    id:"gen_123",status:"completed",
    usage:{input_tokens:126,output_tokens:44,total_tokens:170}
  },{candidateId:"work",requestedBy:"editor",model:"provider/model"});
  assert.ok(usage);
  assert.equal(usage.inputTokens,126);
  assert.equal(usage.outputTokens,44);
  assert.equal(usage.costUsd,null);
  assert.equal(usage.status,"pending_reconciliation");
  const summary=aggregateArtalesAiUsage([usage]);
  assert.equal(summary.generations,1);
  assert.equal(summary.knownCostUsd,0);
  assert.equal(summary.unpricedGenerations,1);
});

test("missing or invalid token usage is never invented",()=>{
  assert.equal(parseArtalesGatewayUsage({},{
    candidateId:"work",requestedBy:"editor",model:"provider/model"
  }),null);
  const usage=parseArtalesGatewayUsage({id:"gen_456",usage:{
    input_tokens:-1,output_tokens:"200"
  }},{candidateId:"work",requestedBy:"editor",model:"provider/model"});
  assert.ok(usage);
  assert.equal(usage.inputTokens,null);
  assert.equal(usage.outputTokens,null);
  assert.equal(aggregateArtalesAiUsage([usage]).unknownTokenGenerations,1);
});

test("ARTales calls Vercel Gateway through server-only OIDC, never a direct provider",()=>{
  const source=readFileSync(new URL("../lib/semantic/artalesAiGateway.ts",import.meta.url),"utf8");
  assert.match(source,/import "server-only"/);
  assert.match(source,/oidcToken/);
 assert.doesNotMatch(source,/process\.env\.VERCEL_OIDC_TOKEN/);
  assert.match(source,/ai-gateway\.vercel\.sh\/v1\/responses/);
  assert.doesNotMatch(source,/api\.openai\.com/);
  assert.match(source,/cache: "no-store"/);
  assert.match(source,/AbortSignal\.timeout/);
});

test("AI work-local protected terms do not need an administrator approval",()=>{
 const worker=readFileSync(new URL("../app/api/internal/editorial/ai-qa-jobs/route.ts",import.meta.url),"utf8");
 const job=readFileSync(new URL("../app/member/semantic/[candidateId]/ai-job-actions.ts",import.meta.url),"utf8");
 assert.match(worker,/action==="protect_term"/);
 assert.match(worker,/artales_work_typography_rules/);
 assert.match(worker,/ignoreDuplicates:true/);
 assert.match(job,/artales_enqueue_ai_qa_job/);
 assert.doesNotMatch(worker,/Nexus|requireAdmin/);
});

test("usage table is RLS protected and keeps retry receipts distinct",()=>{
 const sql=readFileSync(new URL("../ops/sql/20261106_artales_ai_gateway_usage.sql",import.meta.url),"utf8");
 const worker=readFileSync(new URL("../app/api/internal/editorial/ai-qa-jobs/route.ts",import.meta.url),"utf8");
 const page=readFileSync(new URL("../app/member/admin/ai-usage/page.tsx",import.meta.url),"utf8");
 assert.match(sql,/PRIMARY KEY/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/GRANT SELECT, INSERT ON public.artales_semantic_ai_usage TO service_role/);
 assert.match(sql,/p.role::text='admin'/);
 assert.match(worker,/onConflict:"generation_id"/);
 assert.match(page,/await requireAdmin\(\)/);
 assert.match(page,/missing_schema/);
 assert.match(page,/summary.unpricedGenerations/);
});

test("queue does not require runtime OIDC; worker reads the Vercel request header",()=>{
 const actions=readFileSync(new URL("../app/member/semantic/[candidateId]/ai-job-actions.ts",import.meta.url),"utf8");
 const worker=readFileSync(new URL("../app/api/internal/editorial/ai-qa-jobs/route.ts",import.meta.url),"utf8");
 const engine=readFileSync(new URL("../lib/semantic/aiQaProposalEngine.ts",import.meta.url),"utf8");
 assert.doesNotMatch(actions,/process\.env\.VERCEL_OIDC_TOKEN/);
 assert.match(worker,/request\.headers\.get\("x-vercel-oidc-token"\)/);
 assert.match(worker,/gateway_oidc_unavailable/);
 assert.match(worker,/oidcToken,expectedFlagIds/);
 assert.match(engine,/oidcToken:input\.oidcToken/);
 assert.match(actions,/artales_enqueue_ai_qa_job/);
});
