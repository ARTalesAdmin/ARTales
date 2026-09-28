# ARTales durable checkpoint — 2026-09-28

> **Status:** non-authoritative continuation checkpoint.
>
> This document is the current ARTales handoff index. Live code/database state, `AGENTS.md`, `docs/WORKFLOW.md`, `docs/RELEASE_POLICY.md`, and explicit user authorization remain authoritative.

## Current continuation point

Current `develop` after today's work:
- PR #191 — P1-2A canonical candidate persistence migrations — merged.
- PR #192 — P1-2B application wiring to normalized persistence — merged.
- current known merge commit: `18ca45a82a56f5b1785329866bdced04adc635e2`.

Detailed dated Phoenix snapshot:
- `docs/ARTALES_PHOENIX_2026-09-28.md`

## Candidate / rights program status

Completed on `develop`:
- P1-1A — Work Candidates foundation.
- P1-1B — work-level rights triage.
- P1-1C — source/edition discovery model.
- P1-1D — component-rights model.
- P1-1E — promotion gate.
- P1-2A — canonical persistence schema for candidate identity, source shortlist, component rights, promotion audit, plus draft-only relaxation of `works` summary/content constraints.
- P1-2B — app reads/writes normalized candidate identity, preferred source and component-rights persistence.

Production DB:
- candidate persistence migrations have **not** been production-applied in this work.
- treat production as lacking the new candidate tables until a future explicit apply/readback confirms otherwise.

Fixture mode:
- remains the low-cost default for candidate UI preview.
- writes remain disabled in fixture mode.
- ephemeral Supabase is used for real DB/Auth/RLS/write proofs.

## Exact next step

### P1-2C1 — transactional Candidate -> Work promotion primitive

Build and prove an atomic editor/admin-only promotion operation that:

1. re-reads candidate/source/component-rights state,
2. recomputes the gate server-side,
3. fails closed when blocked,
4. creates exactly one `works` draft when eligible,
5. links `matched_work_id`,
6. sets `promoted_at` / `promoted_by`,
7. writes a promotion-attempt audit snapshot,
8. rolls back all state on failure,
9. prevents duplicate promotion,
10. does not ingest blocks/content,
11. does not publish.

Proof this first on a fresh ephemeral Supabase branch.

### P1-2C2 — UI action

Only after P1-2C1 is green:
- expose **Vytvořit dílo** for editor/admin,
- show exact blockers while gate is red,
- navigate/link to the created draft after success.

## Then

P1-2D:
- acquire selected source,
- separate work content from wrapper/editorial additions/assets,
- remove Gutenberg boilerplate,
- preserve provenance,
- prepare safe clean source material for later block synthesis.

Longer-term path:
- source snapshot,
- automatic block synthesis,
- dual-reader QA/diff,
- editor correction loop,
- cover workflow,
- publish gates,
- Nexus orchestration.

## Important retained decisions

- Candidate is not a work status.
- Rights are component-aware.
- `not_before` triggers re-review, never automatic unlock/publication.
- Reconstruct the literary work, not the Gutenberg page.
- Draft `works` may be incomplete; review/published/archived remain strict.
- No automatic candidate promotion.
- No automatic publication.
- No production-data copy into ephemeral Supabase.
- Persistent ARTales staging Supabase remains deferred for cost reasons.
- Legacy single-source fields remain temporarily until normalized persistence is proven end-to-end.
- Production code merge and production DB apply remain separate authorizations.

## Continuation protocol

Before modifying ARTales:

1. read `AGENTS.md`,
2. read this checkpoint,
3. read `docs/ARTALES_PHOENIX_2026-09-28.md`,
4. read `docs/WORKFLOW.md`,
5. read `docs/RELEASE_POLICY.md`,
6. inspect current `develop` and open PRs,
7. verify ephemeral Supabase branch state,
8. verify production DB state before any production apply.

**Recommended next action:** start P1-2C1 design against the real current `works` schema, then create a fresh ephemeral branch and prove the atomic promotion primitive.
