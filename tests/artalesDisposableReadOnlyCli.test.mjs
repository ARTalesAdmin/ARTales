import test from "node:test";
import assert from "node:assert/strict";
import {readonlyProbeCommands,assertReadonlyProbeCommands,validateReadonlyRoleProof}
 from "../scripts/artales-disposable-readonly-cli-proof.mjs";
test("disposable readonly proof uses exact local-only URL and dry-run",()=>{
 const commands=readonlyProbeCommands();
 assert.equal(assertReadonlyProbeCommands(commands),true);
 assert.ok(commands.every(c=>c.includes("--db-url")&&!c.includes("--linked")));
});
test("refuses broader host, non-dry-run and extra flags",()=>{
 for(const alter of [
  x=>{x[0][3]="postgresql://postgres:pw@db.example.net/prod";},
  x=>{x[1]=x[1].filter(v=>v!=="--dry-run");},
  x=>{x[1].push("--include-all");},
  x=>{x[0].push("--linked");}
 ]){const commands=readonlyProbeCommands();alter(commands);
  assert.throws(()=>assertReadonlyProbeCommands(commands),/blocked/);}
});
test("rejects any write privilege or unexpected identity",()=>{
 const proof={user:"artales_plan_probe_ro",readOnlySession:"on",migrationCount:0,
  canInsert:false,canUpdate:false,canDelete:false,canTruncate:false,
  canCreateSchema:false,canCreateMigrationObjects:false,
  isSuperuser:false,canCreateRole:false};
 assert.equal(validateReadonlyRoleProof(proof),true);
 for(const key of ["canInsert","canUpdate","canDelete","canTruncate",
  "canCreateSchema","canCreateMigrationObjects","isSuperuser","canCreateRole"]){
  assert.throws(()=>validateReadonlyRoleProof({...proof,[key]:true}),/blocked/);
 }
 assert.throws(()=>validateReadonlyRoleProof({...proof,user:"postgres"}),/blocked/);
 assert.throws(()=>validateReadonlyRoleProof({...proof,readOnlySession:"off"}),/blocked/);
});
