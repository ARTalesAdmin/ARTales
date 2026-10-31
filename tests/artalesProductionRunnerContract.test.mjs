import test from "node:test";
import assert from "node:assert/strict";
import {BOOTSTRAP,validateBootstrapWorkflow,validateMigrationEnvelope,readBootstrapWorkflow} from "../scripts/artales-production-runner-contract.mjs";
test("bootstrap has no live execution capability",()=>{
 const c=validateBootstrapWorkflow(readBootstrapWorkflow());
 assert.equal(c.allowApply,false);assert.equal(c.allowSecrets,false);
 assert.equal(c.allowProviderAccess,false);assert.equal(c.allowDispatchToProduction,false);
});
test("blocked capabilities are rejected, not ignored",()=>{
 const base=readBootstrapWorkflow();
 for(const s of ["SUPABASE_ACCESS_TOKEN","secrets.DB","environment: artales-production","supabase db push","supabase link","psql --db-url","contents: write","schedule:","push:"]){
  assert.throws(()=>validateBootstrapWorkflow(base+"\n"+s),/bootstrap_privileged_capability/);
 }
});
test("exact project, source and one migration; no inferred authority",()=>{
 const e={schema:"artales-migration-envelope/v0",projectRef:BOOTSTRAP.projectRef,repository:BOOTSTRAP.repository,sourceRef:"refs/heads/main",sourceSha:"a".repeat(40),migrations:[{filename:"20261028091029_artales_identity_role_authority_v1.sql",sha256:"b".repeat(64)}]};
 assert.equal(validateMigrationEnvelope(e).mayApply,false);
 for(const bad of [{...e,projectRef:"other"},{...e,sourceSha:"main"},{...e,migrations:[]},{...e,migrations:[...e.migrations,...e.migrations]},{...e,migrations:[{...e.migrations[0],sha256:"wrong"}]}])assert.throws(()=>validateMigrationEnvelope(bad));
});
