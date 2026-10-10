# ARTales durable checkpoint — 2026-09-28

## Current continuation — 2026-10-10 after #196/#197/#198 integration

**Authoritative instruction documents still take precedence.** Latest verified `develop` HEAD: `41a55757cb87b6a5b717f6b6921f35b141af96bc`; production `main` unchanged in this integration. PR [#196](https://github.com/ARTalesAdmin/ARTales/pull/196), [#197](https://github.com/ARTalesAdmin/ARTales/pull/197), [#198](https://github.com/ARTalesAdmin/ARTales/pull/198) merged into develop; PR [#199](https://github.com/ARTalesAdmin/ARTales/pull/199) updates this documentation. Full reconciled log and next-step handoff: [`docs/ARTALES_PHOENIX_2026-10-10_MAIN.md`](./ARTALES_PHOENIX_2026-10-10_MAIN.md).

PR #198's SQL schema is source code in develop, NOT a production Supabase apply. Real authenticated browser E2E remains open. Both ephemeral Supabase test branches deleted; no production data used. Next product milestone: a provenance- and snapshot-gated atomic candidate→draft→`edit_text` task primitive, then connect admin bounded catalog execution. No Nexus worker queue; no modification of second thread's Reader/Composer files. Future `main` release and production DB apply need separate approval.

Previous sections below this one are historical and may contain older PR status and HEAD claims.

---

> **Status:** non-authoritative continuation checkpoint.
>
> This document is the current ARTales handoff index. Live code/database state, `AGENTS.md`, `docs/WORKFLOW.md`, `docs/RELEASE_POLICY.md`, and explicit user authorization remain authoritative.

## Current main-thread Phoenix (2026-10-10)

- **Current full main-thread integration handoff:** `docs/ARTALES_PHOENIX_2026-10-10_MAIN.md` (this checkpoint's companion, pending separate documentation-only PR into `develop`). Verify live GitHub/DB heads before continuing.
- On 2026-10-10, `develop` head was `4f630c4a581ef85c70b25ea6c9f3ecb6050a7c88`, production `main` head `171df191eb54dbcef7bb015f748138c630428b2f`.
- #196 ingest/Reader fixture, #197 machine-first rights and admin catalog fixture, #198 editorial inbox/RLS were all open **drafts**, not merged. See new Phoenix for exact heads and risks.
- Shared `Editorial Task Contract v1` resides on #198 branch; second thread coordinated via a PR #196 comment.
- All short-lived Supabase test branches had been deleted. No production candidate/inbox DB migration was applied.
- Read this section/new Phoenix **before older 2026-09-28 action text**, which is historical and not the newest task ordering. These notes remain nonauthoritative.

## Historical continuation point (2026-09-28; superseded by dated Phoenix)

Current `develop` after today's work:
- PR #191 — P1-2A canonical candidate persistence migrations — merged.
- PR #192 — P1-2B application wiring to normalized persistence — merged.
- current known merge commit: `18ca45a82a56f5b1785329866bdced04adc635e2`.

Detailed dated Phoenix snapshot:
- `docs/ARTALES_PHOENIX_2026-09-28.md`

Current resumed-ingest plan, component-wise capture/rights safeguards and PR #194 status (verify live):
- `docs/ARTALES_PHOENIX_2026-10-09_INGEST.md`

The 2026-09-28 P1-2C1 next action remains relevant but is now part of the 2026-10-09 prioritized multi-PR ingest plan. The newer Phoenix does not supersede explicit governance or authorization.

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
