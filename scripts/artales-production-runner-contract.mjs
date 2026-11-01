// Source-only bootstrap contract for a future ARTales Production migration runner.
// Does not call any provider, network or CLI.
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve,dirname} from "node:path";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
export const BOOTSTRAP={schema:"artales-production-runner-bootstrap/v0",projectRef:"nmhdwmszbwgrgfbmlguu",repository:"ARTalesAdmin/ARTales",mode:"source-only",allowApply:false,allowSecrets:false,allowProviderAccess:false,allowDispatchToProduction:false};
export function validateBootstrapWorkflow(input){
 if(typeof input!=="string"||input.length>16000)throw Error("invalid_workflow");
 const blocked=[
  /\b(?:supabase|psql|pg_restore)\s+(?:db\s+push|migration\s+repair|login|link|--db-url)/i,
  /\b(?:SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD|DATABASE_URL|service_role)\b/i,
  /\benvironment\s*:\s*artales-production\b/i,
  /\b(?:secrets\.|vars\.)/i,
  /\b(?:repository_dispatch|schedule|push)\s*:/i,
  /\b(?:contents|actions|id-token|deployments)\s*:\s*write\b/i
 ];
 if(blocked.some(p=>p.test(input)))throw Error("bootstrap_privileged_capability");
 for(const line of ["permissions:","  contents: read","  pull_request:","  workflow_dispatch:","persist-credentials: false","tests/artalesProductionRunnerContract.test.mjs","tests/artalesProductionPlanReview.test.mjs"]) {
  if(!input.includes(line))throw Error("bootstrap_guard_missing:"+line);
 }
 return BOOTSTRAP;
}
export function validateMigrationEnvelope(envelope){
 if(!envelope||envelope.schema!=="artales-migration-envelope/v0"||envelope.projectRef!==BOOTSTRAP.projectRef||envelope.repository!==BOOTSTRAP.repository||envelope.sourceRef!=="refs/heads/main"||!/^[a-f0-9]{40}$/.test(envelope.sourceSha)||!Array.isArray(envelope.migrations)||envelope.migrations.length!==1)throw Error("invalid_migration_envelope");
 const m=envelope.migrations[0];
 if(!m||!/^[0-9]{14}_[a-z0-9_]+\.sql$/.test(m.filename)||!/^[a-f0-9]{64}$/.test(m.sha256))throw Error("invalid_migration_identity");
 // No authority is carried in an envelope. Live operator and execution-surface
 // approval must be verified externally before any future runner is permitted.
 return {filename:m.filename,sha256:m.sha256,mayApply:false};
}
export function readBootstrapWorkflow(){
 return readFileSync(resolve(root,".github/workflows/artales-production-migration-bootstrap.yml"),"utf8");
}
