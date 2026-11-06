import {planQaProposalReview,isSafeWorkTypographyTerm} from "../lib/semantic/qaProposalReview";
import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {composeSemanticRevision,recomposeSemanticBatch,verifySemanticRevision,walkSemanticAtoms} from "../lib/semantic/compose";
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
 assert.doesNotMatch(actions,/process\.env\.VERCEL_OIDC_TOKEN/);
 assert.match(worker,/request\.headers\.get\("x-vercel-oidc-token"\)/);
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

test("safe layout preparation uses the same complete UUID validator as enqueue",()=>{
 const prep=file("lib/semantic/qaBatchPreparation.ts");
 const match=prep.match(/const uuid=\/(.+?)\/i;/);
 assert.ok(match,"QA batch must validate exact canonical UUID");
 const uuid=new RegExp(match[1],"i");
 for(const id of [
  "98508359-bce1-4e73-b842-b69a9d1112d0",
  "b39525e5-c4fd-4b7f-9871-dbc2fcea6565",
  "d5441b6f-8996-4bc7-ae4a-1d955ca1c86a"
 ])assert.equal(uuid.test(id),true);
 assert.equal(uuid.test("98508359-bce1-4e73-b842-b69a9d1112d"),false);
 assert.match(prep,/verifySemanticRevision\(original,previous.source_text\)/);
});

test("legacy Pan-like revision can be safely recomposed without inserting absent JSONB metadata",()=>{
 const raw="CHAPTER I.\n\nDr. Raymond looked toward the hill.\n\nThe men went home.\n";
 const hash=createHash("sha256").update(raw).digest("hex");
 const initial=composeSemanticRevision({
  work_id:"qa-fixture",work_slug:"qa-fixture",snapshot_ref:"sha256:"+hash,
  source_bytes_sha256:hash,component_id:"text",original_byte_start:0,original_raw:raw
 });
 const atom=walkSemanticAtoms(initial.blocks).find(a=>a.raw.includes("Raymond"));
 assert.ok(atom);
 assert.equal(Object.hasOwn(initial,"editorial_exclusions"),false);
 const updated=recomposeSemanticBatch(initial,[{
  flagId:"b39525e5-c4fd-4b7f-9871-dbc2fcea6565",atomId:atom.id,
  reason:"Typografická úprava",kind:"block_presentation",
  presentation:{align:"center",indent:"none",space_before:"normal",space_after:"normal"}
 }],raw);
 verifySemanticRevision(updated,raw);
 assert.equal(Object.hasOwn(updated,"editorial_exclusions"),false);
 assert.deepEqual(updated.source,initial.source);
 assert.deepEqual(updated.gaps,initial.gaps);
 assert.equal(updated.review_issues.length,1);
 assert.equal(updated.round,1);
});

test("Pan's four actual AI proposals become one editor-approved, source-safe batch",()=>{
 const ids=["b39525e5-c4fd-4b7f-9871-dbc2fcea6565",
  "d5441b6f-8996-4bc7-ae4a-1d955ca1c86a",
  "a2996b3f-8d56-41e9-9ca4-121b1aa67dd2",
  "e5995127-de06-46d2-944a-e11334a045be"];
 const suggestions=[
  {flagId:ids[0],action:"protect_term" as const,term:"Raymond",
   rationale:"Jméno nemá být rozdělené.",targetAtomIds:[]},
  {flagId:ids[1],action:"compact" as const,term:"",rationale:"Sazba",targetAtomIds:[]},
  {flagId:ids[2],action:"protect_term" as const,term:"NOTE.—Helen Vaughan",
   rationale:"Autorská poznámka musí zůstat.",targetAtomIds:[]},
  {flagId:ids[3],action:"manual_review" as const,term:"",
   rationale:"Nutná redakční kontrola.",targetAtomIds:[]}
 ];
 const flags=ids.map((id,i)=>({id,status:"open",
  kind:i<2?"typography":"other"}));
 const approved=ids.map(flagId=>({flagId,choice:"approve" as const}));
 const plan=planQaProposalReview(suggestions,flags,approved);
 assert.deepEqual(plan.layout,[{flagId:ids[1],action:"compact"}]);
 assert.deepEqual(plan.protectedTerms,[{flagId:ids[0],term:"Raymond"}]);
 assert.deepEqual(plan.confirmedNoChange,[ids[2],ids[3]]);
 assert.equal(plan.rejected.length,0);
 assert.equal(isSafeWorkTypographyTerm("Raymond"),true);
 assert.equal(isSafeWorkTypographyTerm("NOTE.—Helen Vaughan"),false);
 const declined=planQaProposalReview(suggestions,flags,
  ids.map(flagId=>({flagId,choice:"reject" as const})));
 assert.equal(declined.layout.length,0);
 assert.equal(declined.rejected.length,4);
 assert.throws(()=>planQaProposalReview(suggestions,flags,approved.slice(0,3)));
 assert.throws(()=>planQaProposalReview(suggestions,flags.slice(1),approved));
});

test("AI proposal navigation records first manual target and offers remaining-block shortcut",()=>{
 const component=file("components/editor/SemanticAiProposalReview.tsx");
 assert.match(component,/if\(atom\)showTarget\(proposed,atom\)/);
 assert.match(component,/if\(proposal\.action==="manual_review"\)/);
 assert.match(component,/const firstUnvisitedIndex=requiresFullReview\?/);
 assert.match(component,/findTarget\(targets\[firstUnvisitedIndex\]\)/);
 assert.match(component,/Zobrazit neprohlédnutý blok/);
});

test("AI proposal review offers one-by-one navigation and only server-owned persistence",()=>{
 const component=file("components/editor/SemanticAiProposalReview.tsx");
 const apply=file("app/member/semantic/[candidateId]/qa-proposal-actions.ts");
 const reader=file("components/editor/SemanticReaderLab.tsx");
 const panel=file("components/editor/SemanticQaPanel.tsx");
 assert.match(component,/Přijmout/);
 assert.match(component,/Ponechat k opravě/);
 assert.match(component,/Zobrazit navrženou sazbu/);
 assert.match(component,/Uložit schválené změny společně/);
 assert.match(component,/applyReviewedQaProposals/);
 assert.match(reader,/SemanticAiProposalReview/);
 assert.match(panel,/onOpenProposalReview/);
 assert.match(apply,/planQaProposalReview/);
 assert.match(apply,/commitSemanticQaBatch/);
 assert.match(apply,/resolveSemanticQaFlag/);
 assert.match(apply,/saveWorkTypographyRule/);
 assert.match(apply,/job.created_by!==actor.id/);
 assert.match(apply,/revision.revision_sha256!==input.revisionSha/);
 assert.doesNotMatch(apply,/requestArtalesAiResponse|generateSemanticAiQaSuggestions/);
});
