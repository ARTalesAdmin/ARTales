import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const r=p=>readFileSync(p,"utf8");
const m=r("supabase/migrations/20261025090000_legal_screen_v1.sql");
test("legal stage is fail-closed",()=>{assert.match(r("lib/legal/featureFlag.ts"),/LEGAL_SCREEN_V1_ENABLED = false/);assert.match(r("app/member/candidates/[id]/legal/page.tsx"),/if\(!LEGAL_SCREEN_V1_ENABLED\)notFound\(\)/);assert.match(r("lib/actions/legalScreen.ts"),/if\(!LEGAL_SCREEN_V1_ENABLED\)throw/)});
test("no Works/Reader mutations",()=>{assert.doesNotMatch(m,/\b(?:INSERT|UPDATE|ALTER|DELETE|DROP)\s+(?:INTO\s+|TABLE\s+|FROM\s+)?public\.works\b/i);assert.doesNotMatch(m,/\b(?:INSERT|UPDATE|ALTER|DELETE|DROP)\s+(?:INTO\s+|TABLE\s+|FROM\s+)?public\.work_candidates\b/i)});
test("audit and permissions",()=>{assert.match(m,/CREATE TABLE public.candidate_legal_sources/);assert.match(m,/CREATE TABLE public.candidate_legal_decisions/);assert.match(m,/ENABLE ROW LEVEL SECURITY/);assert.match(m,/approved_legal_source_immutable/);assert.match(m,/legal_decisions_editor_insert/);assert.match(m,/legal_approval_missing_evidence_or_rights/)});
test("external preview, not content import",()=>{assert.match(r("app/member/candidates/[id]/legal/page.tsx"),/Číst externě/);assert.doesNotMatch(r("lib/actions/legalScreen.ts"),/\bfetch\(/)});

test("approved editions use the same transaction advisory lock for decisions and edits",()=>{
  assert.match(m,/artales_guard_approved_legal_source[\s\S]*pg_advisory_xact_lock\(410725, pg_catalog\.hashtext\(OLD\.id::text\)\)/);
  assert.match(m,/artales_validate_legal_decision[\s\S]*pg_advisory_xact_lock\(410725, pg_catalog\.hashtext\(NEW\.source_id::text\)\)/);
});

test("edition recommendation cannot bypass legal approval",()=>{
 const src=r("lib/legal/editionRecommendation.ts");
 assert.match(src,/legalApprovalRequired: true/);
 assert.match(src,/identityMatch === "confirmed"/);
 assert.match(src,/languageMatch === "matches"/);
 assert.match(src,/legallyDocumented\(e\)/);
 assert.match(src,/newer_equal_usability/);
 assert.match(src,/ambiguous_tie/);
 assert.match(src,/insufficient_evidence/);
});

test("editor+ legal verification and admin-only snapshot requests",()=>{
 const page=r("app/member/candidates/[id]/legal/page.tsx");
 const action=r("lib/actions/legalScreen.ts");
 assert.match(page,/Čeká na schválení administrátorem/);
 assert.match(r("components/legal/LegalSourceDiscovery.tsx"),/Gutenberg \(výchozí\)/);
 assert.match(page,/Navrhnout snapshot/);
 assert.match(action,/profile\.role!=="admin"/);
 assert.match(m,/candidate_snapshot_requests/);
 assert.match(m,/snapshot_requests_admin_review/);
 assert.match(m,/snapshot_requires_current_approved_screen/);
 assert.match(m,/s\.id=NEW\.source_id AND s\.candidate_id=NEW\.candidate_id/);
 assert.match(m,/author_died integer/);
 assert.match(m,/translator_died integer/);
 assert.match(m,/illustrator_died integer/);
});
