# ARTales Production runner — bootstrap v0 (source-only, no provider access)

Status: **Draft proposal** on an isolated branch. No production execution authority or credential setup. This is not a fix for the previous blocked Supabase MCP call and must not be used to bypass it.

## Goal
Adopt one narrow, reproducible, version-preserving Supabase CLI migration execution mechanism that can later be called by Nexus. Current scope is **only** inert workflow structure, offline checks and testable admission contract. No CLI invocation requiring login, no Secrets, no GitHub environment access, no dispatch, no migrations, no changes to `main`.

## Future design (NOT IMPLEMENTED OR AUTHORIZED)
- PLAN: exact `main` SHA, immutable filename and SHA-256, connected project identity, provider ledger and pinned CLI `migration list` + `db push --dry-run`. Start with existing `scripts/artales-migration-*.mjs` validators and confirm the active CLI's `--help`, not historical flags by assumption.
- APPLY: separate design and authorization, protected GitHub environment, exact source/plan, revalidate after approval, deny unapproved pending versions, version-preserving CLI apply, independent database readback. Do not grant broad operator credentials to PR workflows. Future GitHub `workflow_dispatch` must be linked to a separately reviewed execution surface/identity and exact-artifact authority.
- GitHub environment/reviewer and secrets are not configured by this PR. Never place credentials in PR, code, workflow logs or chat. PR-run code must never get provider credentials.
- The historical five migrations and queued Identity `20261028091029` and Snapshot `20261028110000`, `20261028111000` retain their existing source versions. Staged PRs #279 and #278 are still separate Drafts.
- Use Nexus governance boundaries including ADR-0013 and `EXECUTION_SURFACE_AUTHORITY`: blocked MCP remains blocked, and enabling a different executor requires its own authorization.

## Files
- `.github/workflows/artales-production-migration-bootstrap.yml`: inert PR/manual checks; no privileged environment.
- `scripts/artales-production-runner-contract.mjs`: strict source-only workflow validation and one-migration envelope contract.
- `tests/artalesProductionRunnerContract.test.mjs`: negative cases.

## Risk / rollout
Risk: **medium (future Production capability, presently inert)**.
Target: **production safe only after separate review**.
DB: **no**. Env: **no**. No secret creation, no provider connection, no merge.
Rollback: close Draft PR, or revert source-only commit if separately merged.
Test: exact-head CI, negative contract tests, canonical migration checks, independent human review.

## Required human step later
After the design has passed review and been explicitly approved as the ARTales production execution surface: human sets up appropriately scoped, protected credentials and approvals directly in provider dashboards. Do not infer approval from this Draft or from the earlier request to prepare it.

## PLAN review gate — second source-only slice

- `scripts/artales-production-plan-review.mjs` binds the existing canonical readback/CLI 2.122.0 offline verifier to an exact one-migration envelope (project ref, repository, `main` commit, filename, SQL SHA-256). A fabricated `approved:true` is rejected. It returns a safe review receipt with `mayApply:false`.
- `scripts/artales-production-plan-review-cli.mjs` formats that receipt from four operator-supplied JSON files on a **clean, checked-out `main`**. This CLI is deliberately offline; it does not run Supabase, authenticate or touch Production.
- `tests/artalesProductionPlanReview.test.mjs` exercises one pending migration and negative cases (zero pending, wrong project/source/digest, stale capture, CLI failures, invented approval).
- Both the existing `verifyPlanV01` and the new review gate treat captures as **operator-attested rather than provider-authenticated**. Green CI does NOT verify real Supabase CLI command support, linked project, live credentials or actual dry-run output. CLI help and provider authenticity are mandatory evidence before connecting the runner.
- `describeApplyBoundary` is a deliberately inert requirements document in code: it returns `state:NOT_IMPLEMENTED` and `mayApply:false` in all valid cases. It does not evaluate approvals or issue a command.
- Proposed future APPLY flow: independently selected narrow ARTales operator, separate protected GitHub environment with human reviewer, checkout pinned `main` SHA, new live provider PLAN against the exact one pending migration, explicit authorization scoped to that SHA, fresh revalidation after the human gate, version-preserving CLI push, independent provider ledger/ACL readback; fail-closed on drift. **None of this is live or authorized by this Draft.**

## Pinned CLI help probe (source-only)

The isolated GitHub Actions test installs exactly `supabase@2.122.0` in an unprivileged job and runs only `--version`, `migration list --help` and `db push --help`. It never links/authenticates/connects to a database. The probe checks CLI flags used by the existing offline PLAN v0.1 validator, and fails with sanitized command help if flags are unavailable. A green probe shows CLI command-line option compatibility **only**, not that the previous synthetic JSON output schema is real. No secrets or provider identities are present.

## Real CLI JSON probe against disposable PG17

An isolated GitHub Actions job adds a temporary PostgreSQL 17 service on
`127.0.0.1:5432` using only synthetic credentials. It creates a new scratch
project with a single `SELECT 1` fixture migration and uses pinned CLI
`2.122.0` with `migration list --db-url ... --output-format json` and
`db push --db-url ... --dry-run --skip-vault --output-format json`.
The job prints sanitized JSON result shape to its own CI logs and fails if
command exit status, JSON parsing or disposable-URL / dry-run protection fails.
There is **no production access, no linked project, no production PLAN** and no
ability to apply the fixture. This provides real CLI output evidence distinct
from synthetic PLAN tests.

Note: `--db-url` against a local Postgres fixture is not the future linked
Production command. Real provider-linked PLAN and its operator scope still
require a separate selection/authorization. If CLI JSON differs from our
existing synthetic offline format, adapt the validator conservatively and
retest without silently accepting unrecognized output.

## Phoenix handoff — 2026-10-28 · continue in fresh ARTales thread

**Canonical scope:** ARTales production migration runner bootstrap for the
general Snapshot rollout. Keep the work isolated in
`feature/artales-production-runner-bootstrap-20261028`,
[Draft PR #284](https://github.com/ARTalesAdmin/ARTales/pull/284).
No merge/production provider mutation/credentials granted by this handoff.

### Verified source and provider state
- **Implementation HEAD independently tested:** `78c7b8a2186651f1d1b363692086699741d20f57`.
- **CI:** GitHub Actions
  [#40745758771](https://github.com/ARTalesAdmin/ARTales/actions/runs/40745758771)
  **SUCCESS** with both `source-only` and `disposable-postgres-cli-json`
  jobs passing. The latter job's log is evidence; not production execution.
- Real pinned Supabase CLI **2.122.0** returned JSON for the isolated
  single pending fixture `20261028190000_artales_disposable_json_probe.sql`.
  `migration list` returned `{"migrations":[{"local":"20261028190000","remote":"","time":"2026-10-28 19:00:00"}],"message":"Migrations listed"}`.
  `db push --dry-run` returned
  `{"upToDate":false,"dryRun":true,"migrations":["20261028190000_artales_disposable_json_probe.sql"],"seeds":[],"roles":[],"message":"Finished supabase db push."}`.
  Thus observed disposable CLI JSON shapes **match** the prior synthetic PLAN
  fixture for one pending migration. No schema APPLY occurred.
- Existing PLAN code is still **offline**; these tests do not prove an
  authenticated linked-production `migration list`, operator identity, a live
  production `db push --dry-run`, or permission for SQL mutation.
- **Production `main` at last readback:** `ec27f82f0862806747ccf5007026377164d68c0c`.
- **Supabase ARTales Production:** `nmhdwmszbwgrgfbmlguu`. Fresh migration
  ledger readback shows exactly five applied migrations:
  `20260926142755_remote_schema`,
  `20261023063248_prescreen_shadow_library_v1`,
  `20261024073928_candidate_intake_ab`,
  `20261025095658_legal_screen_v1`,
  `20261027081945_snapshot389_storage_admin_rls`.
  No Identity or general Snapshot migration installed.
- **Identity Authority PR #279:** Draft, HEAD
  `cb164af257c41e361369fd4c8cd63748b8c1d00c`;
  SQL migration `20261028091029_artales_identity_role_authority_v1.sql`
  required before using Snapshot policies based on `profiles.role`.
- **Snapshot General PR #278:** Draft, HEAD
  `e86146cec6e91392bb3075f5b6969925174b4b75`;
  `20261028110000_artales_snapshot_general_v1.sql` then
  `20261028111000_artales_snapshot389_register.sql`.
  Feature `ARTALES_SNAPSHOT_GENERAL_V1` remains disabled.
- Existing #389 private archive is immutable; no re-upload, publication,
  new Reader binding, or public image permission inferred.

### Required next continuation — do not restart the offline framework
1. Rehydrate ARTales AGENTS/WORKFLOW/RELEASE_POLICY, Nexus
   ADR-0013 and Execution Surface Authority, this handoff, PRs #284/#279/#278,
   exact CI, and fresh production migration ledger.
2. Review #284 as the completed **source-only** bootstrap and preserve the
   green exact-head CI evidence. If this documentation-only handoff is committed,
   independently verify CI on that final documentation HEAD before calling
   the PR exact-head green.
3. Next materially useful work is the **separately authorized operator
   selection** for a real, read-only production PLAN. Confirm that the intended
   production identity and access restrictions can be implemented in the
   protected GitHub environment before creating/asking for Secrets. The
   `--db-url` disposable test is NOT a linked-project identity proof.
4. Prove actual production CLI plan: exact `main` SHA, canonical migration
   inventory, migration list and dry-run, one pending migration only, fresh
   provider readback. Bind evidence to operator identity, not a pasted claim.
   Stop on unexpected pending migration, CLI JSON shape, SQL hash or version.
5. Design and review the separate protected APPLY surface, explicit
   action-scoped approval, post-approval revalidation and post-apply readback.
   A blocked MCP provider operation does not authorize a stronger alternate
   identity or silent SQL/CLI fallback (Nexus ADR-0013).
6. After independent approvals for source merge, production operator and
   each exact DB APPLY: Identity #279, Snapshot general schema, #389 evidence
   registration, app release/flag activation and second-title smoke.
   Do not infer authorizations or execute a later step from this handoff.

### Explicit non-actions and limits
PR #284 remains Draft; `main` unchanged; no merge, production SQL,
production CLI PLAN, APPLY, credentials, GitHub Secrets/environment changes,
Vercel env changes, feature enable or publication from this slice.
Previous Supabase MCP `apply_migration` rejection is not resolved, and the
reason for it remains unknown. No rewrite of applied migration history.
