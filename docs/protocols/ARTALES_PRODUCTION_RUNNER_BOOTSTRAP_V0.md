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
