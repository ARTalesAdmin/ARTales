// Run from repository root: node --test tests/candidates-ab.contract.test.mjs
// Source-level regression only. Does not replace PostgreSQL or signed Auth E2E.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(file)=>readFileSync(file,"utf8");
const migration=read("supabase/migrations/20261023114500_candidate_intake_ab.sql");
const route=read("app/api/member/prescreen/shadow/route.ts");
const view=read("components/admin/ShadowLibraryAdmin.tsx");
const actions=read("lib/actions/candidateIntake.ts");
test("Migration preserves existing published works and reader",()=>{
 assert.doesNotMatch(migration,/\b(?:insert|update|delete|alter|drop)\s+(?:into\s+|table\s+|from\s+)?public\.works\b/i);
 assert.match(migration,/CREATE TABLE public\.work_candidates/);
});
test("Prescreen Open Library identifier is only provenance",()=>{
 assert.match(migration,/prescreen_work_key text UNIQUE/);
 assert.match(migration,/rights_status='unknown'/);
 assert.match(migration,/discovery_status='pending'/);
 assert.doesNotMatch(migration,/CREATE TABLE public\.work_candidate_sources/);
});
test("Concurrent transfer has locking and idempotency",()=>{
 assert.match(migration,/FOR UPDATE/);
 assert.match(migration,/ON CONFLICT DO NOTHING/);
 assert.match(migration,/already_transferred/);
 assert.match(migration,/prescreen_handoff_already_transferred/);
 assert.match(migration,/FOREIGN KEY \(transferred_candidate_id\)/);
});
test("Candidate rights cannot be elevated in this phase",()=>{
 assert.match(migration,/candidate_rights_not_screened/);
 assert.match(migration,/GRANT UPDATE\(status,priority,notes,updated_at,updated_by\)/);
 assert.doesNotMatch(actions,/rights_status:/);
});
test("Prescreen transfer is admin-only",()=>{
 assert.match(migration,/p\.role='admin'/);
 assert.match(route,/action==="transfer"/);
 assert.match(view,/Převést na Kandidáta/);
});
test("Manual candidate creation checks existing works",()=>{
 assert.match(migration,/artales_create_manual_candidate/);
 assert.match(migration,/SELECT 1 FROM public\.works/);
 assert.match(migration,/existing_work/);
 assert.match(migration,/existing_candidate/);
});
test("Migration history aligned with applied prescreen",()=>{
 assert.match(read("supabase/migrations/20261023063248_prescreen_shadow_library_v1.sql"),/CREATE TABLE public\.prescreen_shadow_handoffs/i);
});
