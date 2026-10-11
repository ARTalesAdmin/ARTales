# ARTales — P1-2C1B transactional candidate → draft → edit_text handoff

Status: **implementation work order / draft PR**, not executable end-to-end software yet. Branch based on exact `develop` `41a55757cb87b6a5b717f6b6921f35b141af96bc`.

## Why this vertical slice
Three foundations are merged: #196 source-anchored Reader fixture, #197 synthetic catalog/rights planning, #198 actual SQL candidate *legal_review* queue contract. None connects a real candidate to a persisted draft and a work-scoped text-editing task. The 2026-10-10 P1-2C1 proof V2 can create one draft and audit entry in an ephemeral DB but is noncanonical and omits work-scoped task creation.

## Hard invariants
1. Server RPC alone may promote; only an active editor/admin actor verified from `auth.uid()`. No rights booleans, reviewer identity, cost or computed gate accepted from client payload.
2. Lock candidate, preferred source and edition-scoped component rights; validate exact source candidate ownership, strong identity, author match, reviewed legal/component provenance, source modification freshness, and no pending restrictions. Do **not** interpret synthetic structurally-valid dossier as genuine commercial rights.
3. Before any *publication-capable* handoff, independently bind a captured immutable source snapshot ID and actual archived evidence with verifiable SHA-256 and included/excluded component inventory. If schema/authority is absent, **return blocked**, not `promoted`. Excluded translation, illustrations, wrapper or edition additions cannot appear in composed text.
4. Exactly one `works` **draft** and one `editorial_tasks` `edit_text` work-target row per candidate/source version; both created together in a single transaction with an audit and dedupe key; a retry returns existing IDs, never duplicates. Do not mutate published works or create a production release.
5. If task creation, gate recheck or audit fails, rollback the work/candidate linkage. Never return successful promotion if no matching task was created.
6. Keep `editorial_tasks` existing RLS/column grants and trigger invariants. Its current trigger accepts INSERT only for `legal_review`; work-scoped `edit_text` therefore REQUIRES an explicitly designed, narrowly privileged server-side creation path and negative tests, **not** a broad client INSERT permission.
7. The first integrated path can start from an admin button. Real AI research, acquisition, budget authorization and multi-book batching will be separately wired only after durable backend proof.

## Build steps and acceptance tests
- Review `docs/prototypes/ARTALES_P1_2C1_EPHEMERAL_PROOF_V2.sql` as an **untrusted design reference**, not a migration. Also inspect live `works`, `authors`, candidate source/rights, editorial task audit/RLS and contract v1.
- Define minimal immutable source/evidence reference schema and auditable approval semantics, with invalidation on source mutation. Confirm compatibility with second-thread Reader/Composer ownership.
- Generate canonical migration with Supabase CLI, keeping permissions least-privilege, `search_path` fixed and functions invisible/callable only by intended roles. For transaction, use one bounded RPC; direct user session must not be able to mint a fake completed revision.
- In ephemeral Supabase only: test valid synthetic source **with independently attested fixture binding** (assert explicitly NOT commercial clearance), wrong edition, missing hash, stale reviewer, wrong author, old restriction, partial rights and excluded component leakage; anon/member denial; two genuinely competing sessions; re-run/idempotency; forced failure rollback after work INSERT and before task INSERT; immutable task audit. Record exact evidence and delete ephemeral DB at end.
- Add admin UI with explicit blockers and outcome links, then authenticated end-to-end preview bound to disposable DB. No user/prod data or credentials in tests.
- Second thread continues Reader, Composer and source-span QA; don't edit its fixture files.

## Out of scope / release boundaries
This draft provides **scope only**. It must never be used as legal determination, to enable paid workers or to justify production apply. No main changes. Production DB apply and promotion remain explicitly gated. A completed work-scoped editing task and content/Reader revision are distinct: stage a draft and a task first; revision editing and accepted results follow separately.

## Risk / rollback
**High / DB: planned yes / Env: no currently / Target: develop first**. Current document-only commit needs no rollback beyond revert. Future SQL migration needs independent test, compatibility assessment and a concrete production rollback strategy before release.
