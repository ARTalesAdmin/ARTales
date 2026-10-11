# Alice E2 — signed draft/review assembly (not ready for merge)

## Current change
This Draft PR #221 layers isolated E2 provisional SQL on E1 Draft PR #220. New private schema tables hold append-only SemanticRevision v2 draft records, DB-A text revisions, an atomic per-work head pointer, and immutable source-anchored editorial return issues. PostgREST entrypoints are signed RPCs with `auth.uid()`, active role lookup, per-work claimed task for editors, idempotency keys and `FOR UPDATE` head serialization. The public Reader, work identity/status, notes, entitlements and release pointer remain unchanged.

## Known blocking gaps
1. The Composer PG11 adapter currently emits `component_id='pg11:work-text'`, while DB-A `source_components.id` is UUID. A verified source-capture bridge must feed exact immutable DB-A component UUID, original byte span and snapshot digest to the generic `composeSemanticRevision`, then assert matching source/normalization and separately verify JSONB semantic_blocks digest. No string-only substitution or forged production-source mapping.
2. A synthetic signed GoTrue/PostgREST admin/editor/reader E2E using disposable local DB must prove initial save, second return, second child save, stale parent, crossed work/source/actor, replay and self-approval negatives. Current structural pgTAP does NOT prove operational E2.
3. Editorial `return_semantic_v2_revision` is append-only note creation; a future server adapter must ensure a child revision consumes the specific returned issue(s) with immutable ancestry and require independent sign-off. The assembly does not yet implement the full issue/round lifecycle or independent approval.
4. Private SQL checker attests source byte coverage and identity but does not yet independently validate all Semantic Composer v2 structural/mark/presentation recipe constraints. Signed server adapter and SQL validation must both fail closed. Evaluate malformed JSON, pathological sizes, wrong offsets, duplicate atoms and unrelated revision proof.
5. The real Alice baseline is only *live observed* old content; not a separately archived `legacy_observed` snapshot. Rights dossier and pinned source capture still pending (#213). Do not use real Alice or publish.
6. E1 PR #220 still Draft/unmerged; #221 includes its branch as a stack. Do not merge #221 directly into develop until parent reconciliation and final exact-head testing.
7. Final SQL must be produced as a canonical versioned Supabase migration via CLI on disposable local instance, with clean reset proof and security/advisors review. Present file in `supabase/ci` is NOT such migration.

## Governance
Risk: HIGH. Target: develop first. DB: yes (provisional local CI assembly only, zero cloud apply). Env: no. Rollback: discard local DB and revert draft; any eventual prod migration requires separate user authorization. No main, production DB apply, reader cutover, Nexus workers, or paid persistent Supabase branch. No merge authorization is inferred merely from green structural CI.
