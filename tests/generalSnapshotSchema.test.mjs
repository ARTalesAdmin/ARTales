import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const schema=readFileSync("supabase/migrations/20261028110000_artales_snapshot_general_v1.sql","utf8");
const backfill=readFileSync("supabase/migrations/20261028111000_artales_snapshot389_register.sql","utf8");
const route=readFileSync("app/api/member/snapshot/[candidateId]/route.ts","utf8");
test("candidate claim and receipt use separate one-record primary keys",()=>{
 assert.match(schema,/CREATE TABLE public.candidate_snapshot_claims/);
 assert.match(schema,/CREATE TABLE public.candidate_snapshots/);
 assert.match(schema,/CREATE TABLE public\.candidate_snapshot_claims \(\s*candidate_id uuid PRIMARY KEY/);
 assert.match(schema,/CREATE TABLE public\.candidate_snapshots \(\s*candidate_id uuid PRIMARY KEY/);
 assert.match(schema,/c\.sha256=split_part\(name,'\/',4\)/);
 assert.match(schema,/c\.sha256=candidate_snapshots\.sha256/);
 assert.doesNotMatch(schema,/FOR UPDATE|FOR DELETE|GRANT UPDATE|GRANT DELETE/i);
 assert.match(schema,/gutenberg_id integer NOT NULL UNIQUE/);
 assert.match(schema,/ALTER POLICY artales_snapshot389_admin_insert_v1/);
 assert.match(schema,/ALTER POLICY artales_snapshot389_admin_readback_v1/);
 assert.match(schema,/name='gutenberg\/389\/sha256\/2e12d981/);
});
test("source status and runtime remain held until activation",()=>{
 assert.match(route,/SNAPSHOT_GENERAL_V1_ENABLED/);
 assert.match(route,/snapshot_already_claimed_or_denied/);
 assert.match(route,/snapshot_receipt_registration_failed_needs_reconciliation/);
 assert.match(route,/readLockedSnapshotPacket/);
 assert.match(route,/archiveRawSource/);
});
test("historic #389 is registered only against immutable existing object",()=>{
 assert.match(backfill,/historical_snapshot_storage_evidence_mismatch/);
 assert.match(backfill,/historical_snapshot_legal_evidence_mismatch/);
 assert.match(backfill,/historical_snapshot_already_registered/);
 assert.doesNotMatch(backfill,/storage\.objects\s+(?:INSERT|UPDATE|DELETE)/i);
 assert.match(backfill,/125934/);
});
