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
  assert.match(source,/VERCEL_OIDC_TOKEN/);
  assert.match(source,/ai-gateway\.vercel\.sh\/v1\/responses/);
  assert.doesNotMatch(source,/api\.openai\.com/);
  assert.match(source,/cache: "no-store"/);
  assert.match(source,/AbortSignal\.timeout/);
});
