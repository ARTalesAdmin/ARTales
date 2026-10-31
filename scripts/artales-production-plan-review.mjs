// Reviewable PLAN receipt. Pure transformation: never connects to Supabase.
// Production auth, provider provenance and apply approvals live outside this module.
import {verifyPlanV01} from "./artales-migration-plan-v01-core.mjs";
import {validateMigrationEnvelope,BOOTSTRAP} from "./artales-production-runner-contract.mjs";
const fail=reason=>{throw new Error("artales_runner_plan_blocked:"+reason);};
const exactKeys=(o,keys)=>o&&typeof o==="object"&&!Array.isArray(o)&&
 Object.keys(o).sort().join("|")===keys.slice().sort().join("|");
const hex=(s,n)=>typeof s==="string"&&new RegExp("^[0-9a-f]{"+n+"}$").test(s);

export function verifyPlanForHumanReview(args){
 const {inventory,readback,request,checkoutSha,observation,envelope,nowISO}=args||{};
 // Reject invented "approved" fields. An envelope is an identity assertion only.
 if(!exactKeys(envelope,["schema","projectRef","repository","sourceRef","sourceSha","migrations"])||
    !Array.isArray(envelope.migrations)||envelope.migrations.length!==1||
    !exactKeys(envelope.migrations[0],["filename","sha256"]))
   fail("envelope_unexpected_or_missing_field");
 const requested=validateMigrationEnvelope(envelope);
 if(!request||request.headSha!==envelope.sourceSha||checkoutSha!==envelope.sourceSha||
    request.projectRef!==BOOTSTRAP.projectRef||request.repository!==BOOTSTRAP.repository||
    !Array.isArray(request.expectedPending)||request.expectedPending.length!==1||
    request.expectedPending[0].filename!==requested.filename||
    request.expectedPending[0].sha256!==requested.sha256)
   fail("request_envelope_identity_mismatch");
 const proof=verifyPlanV01({inventory,readback,request,checkoutSha,observation,nowISO});
 if(proof.mainSha!==envelope.sourceSha||proof.projectRef!==BOOTSTRAP.projectRef||
    proof.repository!==BOOTSTRAP.repository||proof.pending.length!==1||
    proof.pending[0]!==requested.filename||proof.productionApplyAuthorized!==false||
    proof.mayApply!==false||proof.linkedIdentityIndependentlyVerified!==false)
   fail("proof_not_read_only_single_migration");
 const match=inventory.filter(row=>row.filename===requested.filename);
 if(match.length!==1||match[0].sha256!==requested.sha256)
   fail("sql_fingerprint_mismatch");
 // The CLI observation is operator-attested, NOT independently authenticated
 // by the existing offline verifier. Never promote this into APPLY authority.
 return Object.freeze({
  schema:"artales-production-plan-review/v0",
  projectRef:BOOTSTRAP.projectRef,repository:BOOTSTRAP.repository,
  ref:"refs/heads/main",sourceSha:checkoutSha,
  migration:{filename:requested.filename,sha256:requested.sha256},
  planProofDigest:proof.proofDigest,sourcePlanDigest:proof.sourcePlanDigest,
  completedAt:proof.completedAt,
  evidenceClass:proof.evidenceClass,
  cliTransport:proof.transport||"linked",
  status:"requires-independent-operator-review",
  requiresSeparateProductionApproval:true,
  productionApplyAuthorized:false,mayApply:false
 });
}
export function describeApplyBoundary(review){
 if(!review||review.schema!=="artales-production-plan-review/v0"||
    review.projectRef!==BOOTSTRAP.projectRef||
    review.repository!==BOOTSTRAP.repository||
    !hex(review.sourceSha,40)||!hex(review.planProofDigest,64)||
    !review.migration||!hex(review.migration.sha256,64)||
    review.status!=="requires-independent-operator-review"||
    review.productionApplyAuthorized!==false||review.mayApply!==false)
   fail("invalid_review_for_apply_design");
 return Object.freeze({
  schema:"artales-apply-boundary-proposal/v0",
  state:"NOT_IMPLEMENTED",operatorIdentity:"NOT_SELECTED",
  requiredChecks:["approved-execution-surface","scoped-provider-identity",
    "exact-main-sha","fresh-readback","one-approved-migration",
    "revalidated-cli-plan","protected-human-approval","post-apply-readback"],
  sourceSha:review.sourceSha,filename:review.migration.filename,
  planProofDigest:review.planProofDigest,
  productionApplyAuthorized:false,mayApply:false
 });
}
