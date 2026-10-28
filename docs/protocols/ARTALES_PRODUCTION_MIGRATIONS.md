# ARTales — canonical Production Supabase migrations (v1)

Status: source-governance proposal; NO Production apply / merge authorization.
Date: 2026-10-28. Applies to **ARTalesAdmin/ARTales**, not Nexus control-plane DB.

## Scope and invariant

- Canonical new migration files live in `supabase/migrations/YYYYMMDDHHMMSS_name.sql`.
- `lib/supabase/migrations` is legacy history, **not** an additional queue of Production migrations.
- A migration's 14-digit filename prefix + name + exact reviewed SQL are its
  identity. An execution-time version substituted for that prefix is drift.
- The actual Supabase `supabase_migrations.schema_migrations` ledger is evidence,
  never permission to replay a migration. Never edit ledger rows to make them fit.
- `main` is Production; `develop` is reference / ordinary sandbox per
  AGENTS/WORKFLOW. This one migration-reconciliation PR is isolated FROM and TO
  `main` under the Architect's explicit Snapshot/Identity workstream exception.
- A blocked connector/provider action remains blocked; do not use manual SQL,
  owner console, service_role, another token, CLI identity or Nexus executor to
  bypass a failed governed action. New execution-surface selection needs its own
  reviewed authorization. See Nexus ADR-0013 and EXECUTION_SURFACE_AUTHORITY.
- **Nexus's own migration executor is bound to Nexus and cannot be invoked for ARTales.**

## Source-only ledger reconciliation (2026-10-28)

Production ledger, read-only (project `nmhdwmszbwgrgfbmlguu`):

| Version | Name | Git source result |
|---|---|---|
| 20260926142755 | remote_schema | same registered identity; local dump includes comments and is NOT claimed byte-identical to 557 provider statements |
| 20261023063248 | prescreen_shadow_library_v1 | same version and SQL |
| 20261024073928 | candidate_intake_ab | local SQL byte-identical; filename previously had version 20261023114500 |
| 20261025095658 | legal_screen_v1 | local SQL byte-identical; filename previously had version 20261025090000 |
| 20261027081945 | snapshot389_storage_admin_rls | same CREATE POLICY definitions; repository had staged-only comment plus BEGIN/COMMIT unlike Production; mirror exact Production SQL bytes |

`scripts/check-artales-production-migration-canon.mjs` freezes observed
source fingerprints for the four post-baseline applied migrations and rejects
missing/duplicate names and versions. CI is **offline** and is not a live
Production-ledger check, nor proof that the baseline dump replays successfully.

The reconciliation changes repository filenames and mirrors already-applied
SQL as repository evidence only. It MUST NOT execute migration SQL, apply a
repair, change Supabase credentials, re-run #389, or alter the Production ledger.

## Canonical forward flow — pending independent executor approval

1. Author an exact versioned migration in an isolated PR, with rationale,
   dependency versions, RLS/ACL, rollback boundaries and explicit DB risk.
2. Validate in disposable PostgreSQL and, when authorized and available, in
   a PR-associated Supabase Preview Branch. Preview PASS is NOT Production.
3. Separately authorize exact-head merge of the source proposal. Confirm that
   automatic Supabase `Deploy to production` coupling is DISABLED via fresh
   provider/human evidence BEFORE merging migration-file changes. No inferred
   coupling state from absent unexpected migrations.
4. **Only after explicitly selecting an approved ARTales Production executor
   / operator identity:** link only that Production project and perform
   `supabase migration list --linked`. Compare each version/name with the
   provider ledger and `main`. Halt on any unexpected mismatch.
5. Run `supabase db push --linked --dry-run` (review CLI arguments against
   the currently installed version). The output must contain ONLY the exact
   migration versions in the approved apply envelope. No blanket `db push`.
6. Obtain and bind a separate exact-action Production APPLY approval to that
   pending set and reviewed SHA. Use the approved version-preserving migration
   executor. No switch to a stronger identity after a refused attempt.
7. Independently read `supabase_migrations.schema_migrations`, schema,
   permissions, RLS, historical data and advisors; retain durable evidence.
8. A partial/unknown outcome is a STOP. Read back first; never blindly retry,
   alter history with `migration repair`, or edit historical rows.

## Next ARTales steps

- This reconciliation PR: source-only, must pass exact-head CI; no merge
  until explicit approval and the production GitHub integration coupling is
  independently checked.
- Identity Authority PR #279: stay Draft/not-applied. After this source
  reconciliation is accepted, refresh base + CI, then plan only that exact
  migration under a separately authorized, supported executor.
- Snapshot general PR #278: stay Draft/feature flag OFF; no schema APPLY
  or backfill until identity gate and independent approvals.
- Establish a bounded ARTales Production executor path separately. Reuse Nexus
  *invariants*, not its Nexus-scoped credential, tool or standing authority.

## Recovery / emergency

No destructive DB operations, no broad grant and no data rewrite. A denied
migration execution is an auditable blocked outcome, not an invitation for
a manual `SQL Editor` workaround. Break-glass, if ever justified, requires
a distinct bounded human/governance decision and must never be presented
as proof of the normal path.
