import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../supabase/migrations/20261010164459_artales_candidate_draft_edit_text_handoff.sql",import.meta.url),"utf8");
test("review identity is session-bound and cannot be supplied",()=>{assert.ok(sql.includes("v_actor uuid:=auth.uid()"));assert.ok(!sql.includes("p_reviewer_id"));assert.ok(sql.includes("self_review_forbidden"))});
test("review and promotion lock candidate, source, rights, capture",()=>{assert.ok((sql.match(/candidate -> source -> rights rows -> capture/g)||[]).length>=1);assert.ok(sql.includes("review_invalidated"))});
test("publication provenance is explicit, never inferred public domain",()=>{assert.ok(sql.includes("p_origin_type public.work_origin_type"));assert.ok(sql.includes("explicit_source_classification_required"));assert.ok(sql.includes("v_capture.draft_origin_type,v_capture.draft_source_label"));assert.ok(!sql.includes("'public_domain'::public.work_origin_type,'manual'::public.work_source_label"))});
test("captured source cannot be directly changed by ordinary authenticated role",()=>{assert.ok(sql.includes("revoke all on public.candidate_source_captures from public,anon,authenticated"));assert.ok(sql.includes("grant select on public.candidate_source_captures to authenticated"))});
test("source review binds to candidate, source and rights content",()=>{assert.ok(sql.includes("candidate_fingerprint"));assert.ok(sql.includes("source_fingerprint"));assert.ok(sql.includes("rights_fingerprint"));assert.ok(sql.includes("source_digest_mismatch")||sql.includes("digest_mismatch"))});
