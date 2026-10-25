import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const r=p=>readFileSync(p,"utf8");
const m=r("supabase/migrations/20261025090000_legal_screen_v1.sql");
test("legal stage is fail-closed",()=>{assert.match(r("lib/legal/featureFlag.ts"),/LEGAL_SCREEN_V1_ENABLED = false/);assert.match(r("app/member/candidates/[id]/legal/page.tsx"),/if\(!LEGAL_SCREEN_V1_ENABLED\)notFound\(\)/);assert.match(r("lib/actions/legalScreen.ts"),/if\(!LEGAL_SCREEN_V1_ENABLED\)throw/)});
test("no Works/Reader mutations",()=>{assert.doesNotMatch(m,/\b(?:INSERT|UPDATE|ALTER|DELETE|DROP)\s+(?:INTO\s+|TABLE\s+|FROM\s+)?public\.works\b/i);assert.doesNotMatch(m,/\b(?:INSERT|UPDATE|ALTER|DELETE|DROP)\s+(?:INTO\s+|TABLE\s+|FROM\s+)?public\.work_candidates\b/i)});
test("audit and permissions",()=>{assert.match(m,/CREATE TABLE public.candidate_legal_sources/);assert.match(m,/CREATE TABLE public.candidate_legal_decisions/);assert.match(m,/ENABLE ROW LEVEL SECURITY/);assert.match(m,/approved_legal_source_immutable/);assert.match(m,/legal_final_verdict_admin_only/);assert.match(m,/legal_approval_missing_evidence_or_rights/)});
test("external preview, not content import",()=>{assert.match(r("app/member/candidates/[id]/legal/page.tsx"),/Číst externě/);assert.doesNotMatch(r("lib/actions/legalScreen.ts"),/\bfetch\(/)});

test("approved editions use the same transaction advisory lock for decisions and edits",()=>{
  assert.match(m,/artales_guard_approved_legal_source[\s\S]*pg_advisory_xact_lock\(410725, pg_catalog\.hashtext\(OLD\.id::text\)\)/);
  assert.match(m,/artales_validate_legal_decision[\s\S]*pg_advisory_xact_lock\(410725, pg_catalog\.hashtext\(NEW\.source_id::text\)\)/);
});
