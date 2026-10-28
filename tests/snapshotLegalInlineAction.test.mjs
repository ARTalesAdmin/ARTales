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
 assert.match(legal,/canArchive=\{profile\.role==="admin"\}/);
});
test("the shared action is a consent-gated POST directly from Legal detail",()=>{
 assert.match(panel,/state\.status==="ready"&&canArchive/);
 assert.match(panel,/action=\{\`\/api\/member\/snapshot\/\$\{candidateId\}\`\}/);
 assert.match(panel,/name="private_original_retention" value="archive_only" required/);
 assert.match(panel,/Vytvořit Snapshot/);
 assert.match(snapshot,/<SnapshotActionPanel candidateId=\{candidateId\}/);
});
test("editors and unresolved claims cannot accidentally offer an archive button",()=>{
 assert.match(panel,/state\.status==="ready"&&!canArchive/);
 assert.match(panel,/state\.status==="reconciliation_required"/);
 assert.match(state,/const acquisitionEligible=/);
 assert.match(state,/facts\?\.textFormat==="epub"/);
 assert.match(state,/sourceAvailable:acquisitionEligible/);
});
