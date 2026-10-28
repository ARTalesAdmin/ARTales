import test from "node:test";
import assert from "node:assert/strict";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {admission,inventoryFromDirectory,PROJECT,REPO}
 from "../scripts/artales-migration-plan-core.mjs";
import {verifyCliEvidence,parseMigrationListTranscript,parsePushDryRunTranscript}
 from "../scripts/artales-migration-cli-evidence.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const local=inventoryFromDirectory(join(root,"supabase","migrations"));
const NOW="2026-10-28T12:30:00.000Z",HEAD="a".repeat(40);
const NEXT={version:"20261028091029",name:"artales_identity_role_authority_v1",
 filename:"20261028091029_artales_identity_role_authority_v1.sql",
 sha256:"a".repeat(64),md5:"b".repeat(32)};
function fixture(withPending=false){
 const inventory=withPending?[...local,NEXT]:local;
 const readback={schema:"artales-migration-readback/v0",
  source:"operator-attested-provider-readback",
  projectRef:PROJECT,observedAt:"2026-10-28T12:28:00.000Z",
  migrations:local.map(x=>({version:x.version,name:x.name,
   ...(x.version==="20260926142755"?{}:{statementMd5:x.md5})}))};
 const request={schema:"artales-migration-request/v0",projectRef:PROJECT,
  repository:REPO,ref:"refs/heads/main",headSha:HEAD,
  expectedPending:withPending?[{filename:NEXT.filename,sha256:NEXT.sha256}]:[]};
 const plan=admission({inventory,readback,request,checkoutSha:HEAD,nowISO:NOW});
 const rows=inventory.map(i=>{
  const applied=readback.migrations.some(x=>x.version===i.version);
  return "  "+i.version+" │ "+(applied?i.version:"              ")+" │ 2026-10-28 12:00:00";
 });
 const migrationListOutput="LOCAL │ REMOTE │ TIME (UTC)\n"+
   "────────────────┼────────────────┼──────────────────────\n"+rows.join("\n");
 const dryRunOutput=withPending?
  "Connecting to remote database...\nWould push these migrations:\n  "+
   NEXT.filename+"\nFinished supabase db push.":
  "Connecting to remote database...\nRemote database is up to date.";
 const evidence={schema:"artales-migration-cli-evidence/v0",
  source:"operator-attested-cli-transcript",projectRef:PROJECT,
  repository:REPO,ref:"refs/heads/main",headSha:HEAD,cliVersion:"2.119.0",
  migrationListArgs:["migration","list","--linked"],
  dryRunArgs:["db","push","--linked","--dry-run"],
  migrationListExitCode:0,dryRunExitCode:0,
  migrationListOutput,dryRunOutput,completedAt:"2026-10-28T12:29:00.000Z"};
 return {plan,inventory,readback,evidence,nowISO:NOW};
}
function blocked(f){assert.throws(()=>verifyCliEvidence(f),/artales_cli_evidence_blocked/);}
test("historical ledger and no-pending CLI transcript agree, but never allow APPLY",()=>{
 const v=verifyCliEvidence(fixture());
 assert.deepEqual(v.pending,[]);
 assert.equal(v.matchesSourcePlan,true);
 assert.equal(v.providerIdentityIndependentlyVerified,false);
 assert.equal(v.mayApply,false);
 assert.match(v.evidenceDigest,/^[a-f0-9]{64}$/);
});
test("one exact pending version matches BOTH CLI outputs and source checksum",()=>{
 const v=verifyCliEvidence(fixture(true));
 assert.deepEqual(v.pending,[NEXT.filename]);
 assert.equal(v.mayApply,false);
});
test("altered provider project, SHA, CLI version, commands or exit status blocked",()=>{
 for(const [k,value] of [["projectRef","wrong"],["headSha","b".repeat(40)],
 ["cliVersion","2.1.0"],["migrationListArgs",["migration","repair"]],
 ["dryRunArgs",["db","push","--linked"]],["dryRunExitCode",1]]){
  const f=fixture(true);f.evidence[k]=value;blocked(f);
 }
});
test("extra or wrong dry-run migration is never admitted",()=>{
 const e=fixture(true);
 e.evidence.dryRunOutput+="\n  20261028091030_other.sql";blocked(e);
 const wrong=fixture(true);
 wrong.evidence.dryRunOutput=wrong.evidence.dryRunOutput.replace(
 NEXT.filename,"20261028091031_wrong.sql");blocked(wrong);
 const evenWithCorrect=fixture(true);
 evenWithCorrect.evidence.dryRunOutput="WARNING: provider mismatch\n"+
  evenWithCorrect.evidence.dryRunOutput;blocked(evenWithCorrect);
});
test("tampered/missing/duplicated CLI list version is denied",()=>{
 const f=fixture(true);f.evidence.migrationListOutput=
  f.evidence.migrationListOutput.replace("20261025095658","20261025095659");blocked(f);
 const g=fixture(true);g.evidence.migrationListOutput=
  g.evidence.migrationListOutput.replace("20261027081945","20261025095658");blocked(g);
 const h=fixture(true);h.evidence.migrationListOutput=h.evidence.migrationListOutput
  .split("\n").slice(0,-1).join("\n");blocked(h);
});
test("unknown text, credential-looking output and ambiguous empty sets blocked",()=>{
 assert.throws(()=>parsePushDryRunTranscript("Dry run completed."),/artales_cli_evidence_blocked/);
 assert.throws(()=>parseMigrationListTranscript("unknown table"),/artales_cli_evidence_blocked/);
 const f=fixture();f.evidence.dryRunOutput="Bearer abc123.abc.xyz";blocked(f);
 const g=fixture();g.evidence.migrationListOutput="postgresql://user:password@host";blocked(g);
});
test("stale CLI evidence and source plan mutation are blocked",()=>{
 const f=fixture(true);f.evidence.completedAt="2026-10-28T12:00:00.000Z";blocked(f);
 const g=fixture(true);g.plan.pending[0].sha256="0".repeat(64);blocked(g);
 const h=fixture(true);h.evidence.completedAt="2026-10-28T12:40:00.000Z";blocked(h);
});
