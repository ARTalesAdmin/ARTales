# ARTales Phoenix checkpoint — 2026-09-28

> **Status:** non-authoritative durable handoff for continuation.
>
> This file records the state reached at the end of the 2026-09-28 ARTales session. It does not override `AGENTS.md`, `docs/WORKFLOW.md`, `docs/RELEASE_POLICY.md`, live code/database state, or explicit user authorization.

## 1. Governance / branch baseline

- `main` = production.
- `develop` = sandbox/integration.
- Feature work starts from current `develop`, uses a dedicated branch, and opens PR back to `develop`.
- Production promotion to `main` is always separate.
- Code merge authorization does **not** imply production database apply.
- Supabase schema changes intended for testing use an ephemeral branch and must be deleted at the end of the active session.
- No production Supabase apply was performed during the P1-2A/P1-2B work described below.
- User explicitly chose fixture-first preview where a real DB is not required; ephemeral Supabase is reserved for DB/Auth/RLS/write proofs.

Current `develop` merge point after today's work:
- PR #192 merge commit: `18ca45a82a56f5b1785329866bdced04adc635e2`.

## 2. Candidate / rights program — current state

The Candidate program now has the full pre-promotion skeleton from P1-1A through P1-2B.

### P1-1A — Work Candidates foundation

Candidate remains a distinct pre-work entity, not a `works.status`.

Lifecycle:
- `new`
- `checking`
- `ready`
- `accepted`
- `deferred`
- `review_required`
- `rejected`

Rights statuses:
- `unknown`
- `clear`
- `partial`
- `alternate_edition_required`
- `review_required`
- `deferred`
- `blocked`

Discovery statuses:
- `unknown`
- `pending`
- `complete`
- `needs_review`

Origins:
- `manual`
- `internal_list`
- `reader_request`
- `nexus`
- `other`

Candidate UI is editor/admin only. Rejected/deferred candidates remain durable history; no normal hard-delete workflow.

### P1-1B — Work-level rights triage

Implemented on `develop`.

Triage blockers include:
- discovery incomplete,
- rights not clear,
- future `not_before`.

`ready` / `accepted` may only advance when triage is clear.

Non-clear rights require a human-readable reason.

### P1-1C — Source / edition discovery

Implemented on `develop`.

Discovery concepts:
- normalized work identity,
- normalized author identity,
- author life dates,
- first publication facts,
- source shortlist,
- source identity confidence,
- preferred source,
- contradictory/uncertain source handling.

Important principle:
**Do not map title -> first result -> ingest.**

Fixture pilot:
- *The House of the Wolfings* — William Morris.
- Preferred fixture source: Project Gutenberg eBook #2885.
- Source/edition/component validation remains separate from work identity validation.

### P1-1D — Component rights

Implemented on `develop`.

Component types:
- `WORK_CONTENT`
- `EDITION_CONTENT`
- `TRANSLATION`
- `SOURCE_WRAPPER`
- `EDITORIAL_ADDITION`
- `ASSET`
- `UNKNOWN`

Decisions:
- `usable`
- `exclude`
- `review_required`
- `alternate_edition_required`
- `blocked`
- `not_applicable`

Publication effects:
- `allow`
- `exclude_component`
- `block_source`
- `review`

Expected use cases:
- literary text usable while wrapper is excluded,
- edition usable but assets still need review,
- original work usable while translation is not,
- unclear source component blocks promotion until review.

### P1-1E — Promotion gate

Implemented and merged earlier.

Promotion gate requires:
- candidate status `ready` or `accepted`,
- candidate triage clear,
- preferred source exists,
- preferred source identity is strong,
- component-rights set exists,
- no component with `publication_effect = review`,
- no component with `publication_effect = block_source`,
- candidate is not already linked through `matched_work_id`.

`exclude_component` is intentionally non-blocking: excluded material must simply not be ingested.

No real promotion action exists yet.

## 3. P1-2A — canonical persistence model

PR #191 merged to `develop`.

Merge commit:
- `c67eae8f9611545a42ba6d9912d17e1feefe9e91`.

Canonical migrations now live in:
- `supabase/migrations/20260928100532_work_candidates_foundation_p1_1a.sql`
- `supabase/migrations/20260928100546_candidate_persistence_p1_2a.sql`

Legacy P1-1A migration under `lib/supabase/migrations` was removed.

### Persisted candidate identity

`work_candidates` now has migration support for:
- `normalized_title`,
- `normalized_author_name`,
- `normalized_author_birth_year`,
- `normalized_author_death_year`,
- `first_publication_year`,
- `identity_status`,
- `identity_reason`,
- `preferred_source_id`,
- `promoted_at`,
- `promoted_by`.

Legacy single-source fields remain temporarily for compatibility:
- `selected_source_type`,
- `selected_source_reference`,
- `selected_source_url`.

Do not remove them until normalized persistence is fully proven and cleanup is explicitly approved.

### `work_candidate_sources`

One row = one concrete candidate source/edition.

Persists:
- provider,
- source type/reference/URL,
- canonical identifier,
- language,
- publication metadata,
- identity match,
- lifecycle status,
- note,
- created/updated actor metadata.

Preferred source is represented once on the candidate via `preferred_source_id`; `preferred` is not persisted as a competing source status.

### `work_candidate_component_rights`

One row = one rights decision for one component of one concrete source.

Persists:
- component type,
- decision,
- publication effect,
- reason,
- jurisdiction,
- optional `not_before`,
- reviewer/review timestamp,
- actor/audit metadata.

Current uniqueness is one row per `(source_id, component_type)`.

### `work_candidate_promotion_attempts`

Append-oriented promotion audit prepared for P1-2C.

Persists:
- candidate,
- actor,
- preferred source,
- result: `allowed | blocked | promoted | failed`,
- blockers JSON,
- gate snapshot JSON,
- resulting work ID when promoted,
- timestamp.

The snapshot is intended as durable evidence of the gate state at the time of the attempt.

## 4. Important `works` schema decision

User explicitly approved allowing incomplete draft works.

P1-2A changes the constraints conceptually as follows:

For `status = draft`:
- empty `content` allowed,
- empty/incomplete `summary` allowed.

For non-draft states, including review/published/archived:
- `content` must remain non-blank,
- `summary` must remain non-blank,
- `summary` must remain 200–800 characters.

Reason:
P1-2C must be able to create a legitimate empty editorial skeleton without fake placeholder prose.

Functional proof on ephemeral Supabase:
- empty draft insert: accepted,
- identical review insert: blocked with check violation.

## 5. P1-2A ephemeral DB proof

Temporary branch:
- name: `p1-2a-persistence-proof`
- branch project ref: `kuuzbytbrokccduhswwp`
- observed branch cost at creation: **$0.01344/hour**

Production project:
- `nmhdwmszbwgrgfbmlguu`

Result:
- baseline ARTales schema was present on the branch despite a misleading empty `list_tables` response,
- P1-1A foundation applied,
- P1-2A persistence applied,
- RLS active on source/component-rights/promotion tables,
- policy counts observed: sources 3, component rights 3, promotion attempts 2,
- covering indexes were added so P1-2A did not introduce new unindexed-FK advisor findings,
- P1-1A canonicalization also hardened its own FK indexes and `(select auth.uid())` RLS pattern,
- remaining advisor warnings belong to older baseline debt outside this block.

Important tool/runtime dirty:
- `reset_branch(...baseline)` returned success but did **not** actually remove the proof schema/migration history.
- Therefore a clean second replay from baseline was **not** claimed.
- Final schema was verified state-equivalently instead.

Cleanup:
- ephemeral branch deletion returned success.
- No branch from this proof should remain running.

## 6. P1-2B — application wiring to normalized persistence

PR #192 merged to `develop`.

Merge commit:
- `18ca45a82a56f5b1785329866bdced04adc635e2`.

Implemented:
- candidate detail can read normalized identity fields,
- reads `work_candidate_sources`,
- reads `work_candidate_component_rights`,
- legacy single-source values remain fallback-only,
- normalized identity is editable,
- component rights decision/effect/reason are editable,
- save creates/updates normalized preferred source,
- save sets `preferred_source_id`,
- save upserts component-rights rows,
- existing `created_by` is preserved on component-right updates,
- fixture mode remains write-disabled,
- after reload, promotion gate derives from persisted normalized rows when real DB tables are present.

No P1-2B migration was added.

### Build incident and correction

After source persistence reading was first introduced, Vercel builds began failing with `type_error`.

The failure began exactly when the previously server-neutral domain helper started importing the Supabase server client transitively.

Correction:
- DB reads moved into explicit server data module `lib/dbCandidateDetails.ts`,
- `candidateSources.ts` and `candidateComponentRights.ts` returned to server-neutral mapping/domain roles.

Final exact head before merge:
- `1088b872680abf079a954581f75844600bee46f8`

Final Vercel deployment:
- READY / success.

Lesson:
**Keep domain mapping helpers server-neutral; isolate Next/Supabase server access in explicit DB/server modules.**

## 7. Fixture / preview mode

Fixture-first remains the default low-cost UI preview strategy.

Develop-scoped Vercel env:
- `ARTALES_FIXTURE_MODE=candidates`
- Preview only
- scoped to Git branch `develop`
- production fail-closed.

Fixture candidate set includes:
- Wolfings / William Morris,
- one ready/clear example,
- one blocked/deferred example.

Fixture writes intentionally redirect/fail closed.

Implication:
- visual candidate workflow can be inspected without a paid persistent Supabase branch,
- real persistence CRUD still requires a real DB carrying P1-1A/P1-2A schema.

## 8. Production database state / release dirty

As of this checkpoint:
- P1-1A/P1-2A migrations are committed to `develop`,
- no production Supabase apply was authorized or performed during this work,
- P1-2B code is now on `develop`,
- do **not** assume production Supabase contains `work_candidates`, `work_candidate_sources`, `work_candidate_component_rights`, or `work_candidate_promotion_attempts` until a future explicit production apply/readback confirms it.

This is intentional.

The next development step should continue against ephemeral DB proof, not by silently applying migrations to production.

## 9. Exact next block — P1-2C Candidate -> Work promotion

User explicitly agreed this is the next step, but also explicitly ended implementation for today.

### P1-2C target

Implement a real promotion primitive that moves a fully cleared candidate into a real `works` draft.

Promotion must:
1. be editor/admin only,
2. re-read canonical candidate/source/component-rights state from DB,
3. recompute the promotion gate server-side,
4. fail closed if any gate requirement is not met,
5. create a real `works` row in `draft`,
6. allow the draft to have empty summary/content under the new draft-only constraints,
7. set candidate `matched_work_id`,
8. set `promoted_at` and `promoted_by`,
9. append `work_candidate_promotion_attempts`,
10. be atomic: either all state changes commit, or none do,
11. prevent duplicate promotion via existing `matched_work_id` / idempotency checks,
12. create **no blocks/content ingest yet**,
13. perform **no publication**.

### Recommended decomposition

#### P1-2C1 — transactional promotion primitive

Preferred shape:
- database RPC or equivalent single transactional server-side primitive,
- no multi-call frontend choreography,
- explicit actor authorization,
- exact gate snapshot and blockers persisted,
- resulting work linked atomically.

Before committing:
- design against the actual `works` required fields,
- determine the minimum legitimate draft values for fields still NOT NULL besides summary/content,
- do not invent misleading metadata just to satisfy constraints.

Proof on ephemeral Supabase:
- blocked candidate -> no work created, blocked audit recorded or safely returned per final design,
- eligible candidate -> exactly one draft work + candidate link + promotion audit,
- repeated call -> no duplicate work,
- induced failure -> full rollback.

#### P1-2C2 — editor/admin UI action

Only after the primitive is proven:
- enable a visible action such as **Vytvořit dílo** when gate is green,
- blocked state continues to explain exact blockers,
- action invokes the proven transactional primitive,
- success navigates/links to the new internal work detail,
- no auto-ingest, no auto-publish.

## 10. After P1-2C

Next intended block:
### P1-2D — source acquisition / ingest preparation

Goal:
- fetch selected concrete source,
- separate literary work content from wrapper/editorial additions/assets,
- remove Project Gutenberg boilerplate from ARTales content,
- preserve provenance,
- keep excluded/unclear components out of the ingest,
- prepare clean source material for later block synthesis.

After that:
- automatic block synthesis,
- safe source snapshot,
- dual-reader diff QA,
- editor flags/correction loop,
- cover workflow,
- gate-checked publication,
- later Nexus orchestration.

## 11. Pilot / rights principle retained

Pilot remains:
**The House of the Wolfings — William Morris**

Reference source candidate:
- Project Gutenberg #2885.

Do not interpret “Gutenberg” as automatic clearance of every component.

Keep component separation:
- original literary work,
- transcription/edition contribution,
- translation,
- Gutenberg wrapper/license text,
- transcriber/editorial additions,
- illustrations/assets.

Core rule:
**Reconstruct the literary work, not the source website.**

## 12. Known dirties / follow-ups

- Production Supabase has not yet received the candidate persistence migrations.
- P1-2B has a green build, but real end-to-end save/reload against the normalized tables still belongs in an ephemeral DB session before production release.
- Legacy candidate selected-source fields still exist and should be removed only in a later explicit cleanup after normalized persistence is proven.
- Existing baseline Supabase security/performance advisor debt remains outside this Candidate block.
- Supabase branch/reset behavior can be misleading: verify actual schema with SQL rather than trusting a single branch/list API response.
- Persistent staging Supabase remains deferred for cost reasons.
- The earlier “worker may wait overnight” idea remains unresolved against ARTales' hard ephemeral-session/no-overnight branch policy; do not silently relax that policy.

## 13. Safe continuation procedure

At the start of a fresh ARTales thread:

1. read `AGENTS.md`,
2. read `docs/ARTALES_DURABLE_CHECKPOINT.md`,
3. read this dated Phoenix checkpoint,
4. read `docs/WORKFLOW.md`,
5. read `docs/RELEASE_POLICY.md`,
6. inspect live `develop` head and open PRs,
7. verify no ephemeral Supabase branch is unexpectedly active,
8. verify live production DB state before any production apply,
9. continue with **P1-2C1 transactional promotion primitive**,
10. keep production apply and production promotion as separately authorized actions.

## 14. Session closure

End-of-session state:
- P1-2A merged to `develop`,
- P1-2B merged to `develop`,
- final P1-2B Vercel build green,
- no production DB apply performed,
- P1-2A ephemeral proof branch deleted,
- no intended paid proof workload should remain,
- next implementation intentionally deferred to a future session.
