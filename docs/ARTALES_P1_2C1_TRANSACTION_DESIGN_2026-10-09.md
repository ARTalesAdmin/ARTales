# ARTales P1-2C1 — Candidate -> Work draft: transactional design and proof

Status: **design and fixture proof only**. No production database migration or live promotion RPC has been run or deployed. The editor action remains disabled until atomic DB proof and a separately reviewed follow-up.

## Verified baseline (2026-10-09)

- Production `works` schema: NOT NULL `title`, `slug`, `summary`, `content`, `canonical_language`, `origin_type`, `source_label`, `primary_author_id`, `created_by`, `updated_by`.
- `works` currently enforces nonempty `summary` (200–800 chars) and `content`. Previously committed, *not production applied*, P1-2A migration relaxes these constraints **only for draft**. Do not add filler summaries to pass production constraints.
- `primary_author_id` must reference an actual `authors.id` and be resolved explicitly; `proposed_author_name` does not suffice.
- `work_candidate_sources` stores concrete edition and belongs to one candidate; component rights are source-specific, with unique `(source_id,component_type)`.
- P1-2B corrected readback in PR #194. Existing work candidate update still uses multiple distinct API writes: **do not mistake this for atomic promotion**.
- `works.slug` is unique; collisions must use deterministic candidate-based suffix, never overwrite an existing work.

## Exact atomic mutation contract (ephemeral proof first)

An authenticated editor/admin, active profile, issues a single `promote_work_candidate(candidate_uuid)` request. The function must run **one DB transaction**.

1. Reject anon, inactive and noneditor roles. Bind identity from `auth.uid()`, not a caller-supplied `actor_id`, JWT editable metadata, or `service_role`.
2. Lock candidate row with `FOR UPDATE` before checking `matched_work_id` / `promoted_at`. Retry returns existing result idempotently only when the prior matching link is valid.
3. Read selected source by exactly `(source_id, candidate_id)`, ensure `status = candidate` (neither rejected nor needs_review), `identity_match = strong`. Lock the selected source and its rights records against concurrent changes.
4. Re-evaluate authoritative candidate facts: `status IN (ready,accepted)`, `discovery_status = complete`, `rights_status = clear`, `review_required = false`, `not_before <= current_date` or null, `identity_status = matched`.
5. Require explicit suitable rights for original `WORK_CONTENT` and `EDITION_CONTENT`; reject `block_source` / `review`, future restrictions, inconsistent decision/effect. Excluded components are never copied to an ingest artifact. Translation/asset rights are separate, not inherited; missing record does not approve inclusion later.
6. Validate `matched_author_id` references an existing author whose identity matches the reviewed candidate. If not, return `author_match_required`; never create an unreviewed author automatically.
7. Pick the candidate's validated edition language. If language is unknown, fail `source_language_required`. Use `origin_type = public_domain` only if legally established for the selected content; otherwise fail instead of inventing licensing metadata. Do not infer original vs translated edition from provider alone. Map the source label from provider/URL without misrepresenting the origin.
8. Generate stable, unique, bounded slug (base from title, with candidate-id suffix to avoid collisions) using a deterministic checked rule. A collision with any existing work is an error to resolve, not overwriting.
9. Insert exactly one `works` record with `status='draft'`, `summary=''`, `content=''`, `content_blocks='[]'`, no publish timestamps. Set user author IDs, source reference, provenance metadata, verified language.
10. Update candidate `matched_work_id`, `promoted_at`, `promoted_by`, `updated_by`; insert `work_candidate_promotion_attempts` with `result='promoted'`, source, work ID, and sanitized gate snapshot.
11. Return work id/slug and a success status. On error, **everything rolls back**. No partial work, no candidate half-link; blocked attempts can be separately audited only through a carefully designed independent transaction, never a partial success.
12. Verify concurrent requests and duplicate/retry behaviour with two sessions, forced rollback, invalid roles, stale candidate and rights edits.

### Database function security decision required

Prefer an explicitly scoped Postgres function with `SECURITY INVOKER` wherever existing RLS suffices. Existing `works` RLS is broad editor/admin, so reevaluate active-user protection and no accidental publication before implementation. Avoid exposed `SECURITY DEFINER` RPCs and public default execute grants. Any elevated function requires a separate security review, tightly limited privileges and role tests.

## Preview now (without DB)

Open `/member/candidates/promotion-preview` in ARTales fixture mode (`ARTALES_FIXTURE_MODE=candidates`, not production). See happy path, blocked author, blocked translation, and blocked/missing edition outcomes. **Buttons never create a work; this preview is not a proof that the transaction exists.**

## Independent editor inbox (secondary)

Later `editorial_tasks` with `id, kind, project/work/candidate/segment_ref, source_system (artales|nexus|manual), source_external_id, priority, status, assignee_user_id, claimed_at, due_at, created_by, updated_at, unique inbound dedupe key`. Editors can claim/return/reassign within role-based permissions; task history and notifications retained. Nexus pushes via separately authorized bounded integration, without sharing its worker queue or forcing editors to have Nexus. No inbox schema migration in C1.

## Parallel implementation recommendation

Two streams initially: A transactional Candidate->Draft + UI once proven, B fixture-only ingestion/composer/Reader prototype. Avoid concurrent changes to the same RLS and Editor forms. Scale to 3–5 branches after immutable source snapshot contract is stable. Merge `develop` integration sequentially and verify fresh base each time.

## Exit criteria

No merge of a real write button or promotion RPC until: canonical migration generated with Supabase CLI, ephemeral DB branch test including rollback/idempotency/concurrency/roles, cleanup confirmed, review and explicit authorization. Production schema and `main` stay untouched.

## Continuation 2026-10-09 (main thread)

- The second ARTales chat is now running independently on Ingest / Adaptive Composer / Reader QA; this branch owns P1-2C1 only. No shared files or Nexus queue.
- A new reusable **read-only** `lib/candidateDraftReadiness.ts` checks the existing rights/source gate plus verified author link, normalized identity, and selected source language. The interactive fixture lab now uses this shared check rather than duplicate UI logic.
- Regression cases were added in `tests/candidateDraftReadiness.test.ts`. Executing the Node tests is **pending**. Neither these tests nor the fixture lab prove atomic RPC behaviour.
- GitHub branch has no promotion DDL and no real write action. Supabase production was inspected SELECT-only. No ephemeral Supabase branch exists; creation has a cost-confirmation boundary, therefore no branch was created silently. Do not mark P1-2C1 complete.
- `origin_type` and `source_label` must be selected from explicit source/legal provenance, not guessed from the candidate title or Gutenberg hostname. `matched_author_id` must point to an existing verified author, and draft-only constraints must exist on the test DB before promotion.
- Important: Current UI form creates a source identity with `identity_match=strong` whenever discovery is complete; the final server-side transaction must not trust a status label alone as evidence of edition rights. Real evidence and component decision review remains an editorial responsibility.

## Ephemeral DB proof, 2026-10-09 (closed)

- Temporary branch: `artales-p1-2c1-proof-20261009` / `dhmkebwjulsksppskxpi` (branch ID `880a847d-90c5-4b7c-9c99-04a05361b4e0`); cost rate quoted USD 0.01344/hour. No production data carried over; `works` rows = 0 before test.
- Applied pre-existing P1-1A and P1-2A candidate migrations successfully to branch **only**.
- Applied the trial SQL from `docs/prototypes/ARTALES_P1_2C1_EPHEMERAL_PROOF_ONLY.sql` to branch **only**; function compiled.
- Checked `prosecdef=false` (SECURITY INVOKER), `anon EXECUTE=false`, `authenticated EXECUTE=true`.
- Anonymous/no editor identity SQL call returned expected `42501 editor_authorization_required`.
- **NOT PROVEN:** synthetic editor+author+rights success, duplicate/idempotency, rollback under failure, concurrent requests, editor/admin RLS read/write interaction. No full E2E run.
- **Security/design defect in current trial SQL:** `origin_type='public_domain'` and source label inferred from provider name, without explicit provenance/edition-rights evidence. DO NOT treat this SQL as production-ready or apply it to production. Require independently reviewed explicit origin/source mapping, stronger edition identity facts and all required rights decisions before proceeding to live action.
- The trial SQL is retained only as nonproduction reference. It is **not** a canonical migration; follow Supabase CLI migration workflow for final version.
- **Cleanup confirmed:** deleted branch via Supabase and re-listed branches: only production `main` remained. No persistent staging created. No production mutation.
