import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const legal=readFileSync("app/member/candidates/[id]/legal/page.tsx","utf8");
const panel=readFileSync("components/snapshot/SnapshotActionPanel.tsx","utf8");
const snapshot=readFileSync("app/member/snapshot/[candidateId]/page.tsx","utf8");
const state=readFileSync("lib/ingest/server/getCandidateSnapshotState.ts","utf8");
test("legal detail shows one next-step link; archive POST remains on Snapshot",()=>{
 assert.match(legal,/lock&&SNAPSHOT_GENERAL_V1_ENABLED\?await getCandidateSnapshotState\(id\):null/);
 assert.match(legal,/href=\{"\/member\/snapshot\/"\+id\}/);
 assert.match(snapshot,/canArchive=\{canProgress\}/);
 assert.match(legal,/canProgressCandidate\(id,profile\)/);
});
test("the shared action starts a private-only POST with clear informed action text",()=>{
 assert.match(panel,/\(state\.status==="ready"\|\|state\.status==="recovery_ready"\)\&\&canArchive/);
 assert.match(panel,/fetch\("\/api\/member\/snapshot\/"\+candidateId/);
 assert.match(panel,/private_original_retention:"archive_only"/);
 assert.match(panel,/role="alert"/);
 assert.match(panel,/if\(busy\)return/);
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
