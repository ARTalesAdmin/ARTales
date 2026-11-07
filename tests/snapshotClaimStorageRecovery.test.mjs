import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("supabase/migrations/20261107114500_artales_snapshot_claimed_storage_access.sql","utf8");
const route=readFileSync("app/api/member/snapshot/[candidateId]/route.ts","utf8");
test("private snapshot policy restricts every object to a matching owned immutable SHA-256 claim",()=>{
 assert.match(sql,/ON storage\.objects\s+FOR INSERT TO authenticated/);
 assert.match(sql,/ON storage\.objects\s+FOR SELECT TO authenticated/);
 assert.match(sql,/bucket_id='artales-raw-snapshots'/);
 assert.match(sql,/c\.claimed_by=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/p\.role::text='admin'/);
 assert.match(sql,/p\.is_active IS TRUE/);
 assert.match(sql,/d\.verdict='approved'/);
 assert.match(sql,/d\.territory='CZ\/EU'/);
 assert.match(sql,/name='gutenberg\/'\|\|c\.gutenberg_id::text\|\|/);
 assert.match(sql,/c\.sha256\|\|'\/original\.epub'/);
 assert.doesNotMatch(sql,/FOR UPDATE|FOR DELETE|DROP POLICY|ALTER POLICY/i);
});
test("claim resume never deletes immutable ledger or overwrites existing object",()=>{
 assert.match(route,/const recovery=preflight==="claim_without_receipt"/);
 assert.match(route,/priorClaim\.claimed_by!==actor\.id/);
 assert.match(route,/priorClaim!\.sha256!==captured\.manifest\.sha256/);
 assert.match(route,/snapshot_recovery_existing_object_needs_readback/);
 assert.doesNotMatch(route,/\.upsert\(|\.remove\(|\.delete\(\)/);
});
