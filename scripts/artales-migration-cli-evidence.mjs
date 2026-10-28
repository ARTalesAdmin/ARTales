// Offline evidence checker. Inputs are operator-attested CLI text, never
// authenticated provider proof. There is intentionally NO execution path.
import {createHash} from "node:crypto";
import {PROJECT,REPO} from "./artales-migration-plan-core.mjs";
const fail=s=>{throw Error("artales_cli_evidence_blocked:"+s);};
const VERSION="2.119.0"; // Reviewed precedent; update only in a new pinned-CLI review.
const namePattern=/^[0-9]{14}_[a-z0-9][a-z0-9_]*\.sql$/;
const sha256=s=>createHash("sha256").update(s,"utf8").digest("hex");
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function bounded(s,label){
 if(typeof s!=="string"||!s.trim()||s.length>65536||s.includes("\0")||
    /(?:SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD|postgres(?:ql)?:\/\/|Bearer\s+[a-z0-9._-]+)/i.test(s))
  fail(label+"_invalid_or_sensitive");
 return s.replace(/\r\n/g,"\n").trim();
}
function textLines(raw,label){
 return bounded(raw,label).split("\n").map(v=>v.trim()).filter(Boolean);
}
export function parseMigrationListTranscript(raw){
 const lines=textLines(raw,"migration_list");
 const rows=[];let header=false,separator=false;
 for(const line of lines){
  if(line==="Connecting to remote database...")continue;
  if(/^LOCAL\s*[│|]\s*REMOTE\s*[│|]\s*TIME \(UTC\)$/i.test(line)){
   if(header)fail("repeated_list_header");
   header=true;continue;
  }
  if(/^[─-]+\s*[┼+]\s*[─-]+\s*[┼+]\s*[─-]+$/.test(line)){
   if(!header||separator)fail("list_separator_invalid");
   separator=true;continue;
  }
  if(!separator)fail("unexpected_list_prefix");
  const parts=line.split(/[│|]/).map(v=>v.trim());
  if(parts.length!==3)fail("unexpected_list_line");
  const [local,remote,time]=parts;
  if((!local&&!remote)||(local&&!/^\d{14}$/.test(local))||
    (remote&&!/^\d{14}$/.test(remote))||
    (local&&remote&&local!==remote))fail("invalid_list_version");
  if(time&&!/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(time))
   fail("invalid_list_time");
  const version=local||remote;
  if(rows.some(r=>(r.local||r.remote)===version))fail("duplicate_list_version");
  rows.push({local,remote});
 }
 if(!header||!separator||rows.length<5||rows.length>200)fail("list_shape_invalid");
 const versions=rows.map(r=>r.local||r.remote);
 if(!same(versions,[...versions].sort()))fail("unsorted_migration_list");
 return rows;
}
export function parsePushDryRunTranscript(raw){
 const lines=textLines(raw,"dry_run").filter(s=>s!=="Connecting to remote database...");
 if(same(lines,["Remote database is up to date."])||
    same(lines,["Remote database is up to date.","Finished supabase db push."]))
  return [];
 const header=lines.shift();
 if(header!=="Would push these migrations:")fail("dry_run_header_unrecognized");
 if(lines.at(-1)==="Finished supabase db push.")lines.pop();
 if(lines.length===0||lines.length>1)fail("dry_run_unexpected_pending_count");
 if(lines.some(s=>!namePattern.test(s)))fail("dry_run_unknown_line");
 return lines;
}
export function verifyCliEvidence({plan,inventory,readback,evidence,nowISO}){
 if(!plan||plan.schema!=="artales-migration-plan/v0"||
    plan.projectRef!==PROJECT||plan.repository!==REPO||
    plan.ref!=="refs/heads/main"||plan.mayApply!==false||
    plan.productionApplyAuthorized!==false||plan.liveCliDryRunVerified!==false||
    !Array.isArray(plan.pending)||plan.pending.length>1||
    !/^[a-f0-9]{40}$/.test(plan.headSha)||
    !/^[a-f0-9]{64}$/.test(plan.planDigest))fail("invalid_source_plan");
 if(!Array.isArray(inventory)||!readback||!Array.isArray(readback.migrations))
  fail("missing_source_inventory");
 const source={schema:plan.schema,projectRef:plan.projectRef,repository:plan.repository,
  ref:plan.ref,headSha:plan.headSha,providerReadbackObservedAt:plan.providerReadbackObservedAt,
  appliedCount:plan.appliedCount,pending:plan.pending};
 if(sha256(JSON.stringify(source))!==plan.planDigest)fail("source_plan_digest_mismatch");
 if(!evidence||evidence.schema!=="artales-migration-cli-evidence/v0"||
    evidence.source!=="operator-attested-cli-transcript"||
    evidence.projectRef!==PROJECT||evidence.repository!==REPO||
    evidence.ref!=="refs/heads/main"||evidence.headSha!==plan.headSha||
    evidence.cliVersion!==VERSION||
    !same(evidence.migrationListArgs,["migration","list","--linked"])||
    !same(evidence.dryRunArgs,["db","push","--linked","--dry-run"])||
    evidence.migrationListExitCode!==0||evidence.dryRunExitCode!==0)
  fail("cli_identity_or_command_invalid");
 const now=Date.parse(nowISO),completed=Date.parse(evidence.completedAt),
  observed=Date.parse(readback.observedAt);
 if(!Number.isFinite(now)||!Number.isFinite(completed)||!Number.isFinite(observed)||
    completed<observed||completed>now+30000||now-completed>900000)
  fail("cli_evidence_stale_or_future");
 const rows=parseMigrationListTranscript(evidence.migrationListOutput);
 const locally=rows.filter(r=>r.local).map(r=>r.local);
 const remotely=rows.filter(r=>r.remote).map(r=>r.remote);
 const expectedLocal=inventory.map(x=>x.version);
 const expectedRemote=readback.migrations.map(x=>x.version);
 if(!same(locally,expectedLocal)||!same(remotely,expectedRemote))
  fail("cli_list_disagrees_with_source_or_ledger");
 if(plan.appliedCount!==expectedRemote.length||
    !same(plan.pending.map(x=>x.version),locally.filter(x=>!remotely.includes(x))))
  fail("source_plan_pending_drift");
 const pushed=parsePushDryRunTranscript(evidence.dryRunOutput);
 if(!same(pushed,plan.pending.map(x=>x.filename)))
  fail("cli_dry_run_differs_from_exact_pending_set");
 const recorded={schema:"artales-migration-cli-proof/v0",projectRef:PROJECT,
  headSha:plan.headSha,planDigest:plan.planDigest,cliVersion:VERSION,
  observedAt:evidence.completedAt,pending:plan.pending.map(x=>x.filename),
  migrationListSha256:sha256(evidence.migrationListOutput),
  dryRunSha256:sha256(evidence.dryRunOutput)};
 return {...recorded,evidenceDigest:sha256(JSON.stringify(recorded)),
  evidenceClass:"operator-attested-cli-transcript-not-provider-authenticated",
  matchesSourcePlan:true,providerIdentityIndependentlyVerified:false,
  productionApplyAuthorized:false,mayApply:false};
}
