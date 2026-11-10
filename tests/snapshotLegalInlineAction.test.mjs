import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const legal=readFileSync("app/member/candidates/[id]/legal/page.tsx","utf8");
const panel=readFileSync("components/snapshot/SnapshotActionPanel.tsx","utf8");
const snapshot=readFileSync("app/member/snapshot/[candidateId]/page.tsx","utf8");
const state=readFileSync("lib/ingest/server/getCandidateSnapshotState.ts","utf8");
test("legal detail renders the Snapshot action only on a locked source with enabled flag",()=>{
 assert.match(legal,/lock&&SNAPSHOT_GENERAL_V1_ENABLED\?await getCandidateSnapshotState\(id\):null/);
 assert.match(legal,/snapshotState\?<><SnapshotActionPanel|snapshotState\?<\>/);
 assert.match(legal,/canArchive=\{canProgress\}/);
 assert.match(legal,/canProgressCandidate\(id,profile\)/);
});
test("the shared action starts a private-only POST with clear informed action text",()=>{
 assert.match(panel,/\(state\.status==="ready"\|\|state\.status==="recovery_ready"\)\&\&canArchive/);
 assert.match(panel,/action=\{\`\/api\/member\/snapshot\/\$\{candidateId\}\`\}/);
 assert.match(panel,/name="private_original_retention" value="archive_only"/);
 assert.match(panel,/ilustrace nebudou součástí veřejného vydání/);
 assert.match(panel,/Pokračovat v přípravě/);
 assert.match(snapshot,/<SnapshotActionPanel candidateId=\{candidateId\}/);
});
test("unauthorized actors and unresolved claims cannot accidentally offer an archive button",()=>{
 assert.match(panel,/state\.status==="ready"&&!canArchive/);
 assert.match(panel,/state\.status==="reconciliation_required"/);
 assert.match(state,/const acquisitionEligible=/);
 assert.match(state,/facts\?\.textFormat==="epub"/);
 assert.match(state,/sourceAvailable:acquisitionEligible/);
});
