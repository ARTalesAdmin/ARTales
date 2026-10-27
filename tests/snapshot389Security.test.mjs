import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("supabase/migrations/20261027083000_snapshot389_storage_admin_rls.sql","utf8");
test("single-title Storage RLS cannot widen to all authenticated users",()=>{
 assert.match(sql,/FOR INSERT TO authenticated/);
 assert.match(sql,/FOR SELECT TO authenticated/);
 assert.match(sql,/bucket_id = 'artales-raw-snapshots'/);
 assert.match(sql,/name ~ '\^gutenberg\/389\/sha256\//);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/p\.role::text = 'admin'/);
 assert.match(sql,/p\.is_active IS TRUE/);
 assert.doesNotMatch(sql,/FOR (?:UPDATE|DELETE)/i);
 assert.doesNotMatch(sql,/SET ROLE|TO service_role|BYPASSRLS/i);
});
