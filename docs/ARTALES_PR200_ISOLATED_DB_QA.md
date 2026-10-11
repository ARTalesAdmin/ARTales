# PR #200 — isolated database verification harness (2026-10-10)

The CI workflow `.github/workflows/artales-pr200-db-qa.yml` runs only on a GitHub-hosted disposable Linux runner. It starts Supabase locally with Docker and applies the committed migration chain, including the schema-only baseline, without copying production data.

## Security boundary
- No production Supabase URL, service credentials, linked project, `db push`, or remote apply.
- No persistent secondary Supabase branch.
- All test data and containers must disappear with the job. The cleanup step runs even after test failure.
- `permissions: contents: read`. Tests do not need GitHub write permissions or secrets.
- `supabase/tests/200_candidate_handoff_contract.sql` checks schema and access-control invariants.

## Evidence levels
1. A successful CI boot and pgTAP contract suite proves local migration compatibility and schema/ACL invariants, **not** product E2E.
2. To certify #200 for merge, extend CI with synthetic actor fixtures on the local-only database, authenticated two-actor capture/review/promote, changed-rights rejection, repeat-promote idempotency, forced rollback and actual dual-connection concurrency tests.
3. Review `SECURITY DEFINER` privileges and audit events; avoid classifying caller-authored data as legally approved just because it has a SHA digest.

If the local baseline fails, fix the test stack or migration contract; do not point CI at the production database as a workaround.

## Release
This is a high-risk DB change, target `develop` only, DB yes (migration), Env no. No production apply authorized. Rollback: revert branch code in `develop` only; database schema changes require a separately reviewed forward migration before any eventual release.
