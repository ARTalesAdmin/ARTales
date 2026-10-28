import test from "node:test";
import assert from "node:assert/strict";
import * as m from "../lib/ingest/generalSnapshotPreflight.ts";
import {readFileSync} from "node:fs";
const {deriveSnapshotPreflight:preflight}=m.default??m;
test("an unseen candidate may begin its first Snapshot",()=>{
 assert.equal(preflight(false,false),"start");
});
test("historical archived #389 is never reacquired, even with a claim",()=>{
 assert.equal(preflight(true,true),"already_archived");
 assert.equal(preflight(true,false),"already_archived");
});
test("a claim without a receipt stops before any new acquisition",()=>{
 assert.equal(preflight(false,true),"claim_without_receipt");
});
test("route has preflight before mirror fetch and an independent conflict readback",()=>{
 const route=readFileSync("app/api/member/snapshot/[candidateId]/route.ts","utf8");
 const preflightCall=route.indexOf("deriveSnapshotPreflight(Boolean(existing),Boolean(priorClaim))");
 const acquisition=route.indexOf("await loadMirror(proposal.acquisitionUrl)");
 assert.ok(preflightCall>=0 && acquisition>preflightCall);
 assert.match(route,/snapshot_claim_exists_inspection_required/);
 assert.match(route,/if\(claimError\)[\s\S]*select\("candidate_id"\)/);
 assert.match(route,/reconciliation_required:true/);
});
