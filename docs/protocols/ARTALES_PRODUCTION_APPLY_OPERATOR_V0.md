# ARTales single-migration APPLY operator v0 — source-only proposal

**Status:** IMPLEMENTED ONLY AS SOURCE IN DRAFT PR. No configured APPLY environment, no APPLY identity, no new grants, no secrets, no activation, no merge, no provider mutation authorized. A workflow file committed to a branch **does not** prove an execution surface exists or is approved.

## Target
Finish the existing approved ARTales Snapshot release without merging unfinished \`develop\`.
Canonical production: \`ARTalesAdmin/ARTales\`, Supabase \`nmhdwmszbwgrgfbmlguu\`.
Bounded migration allowlist and order:
1. \`20261028091029_artales_identity_role_authority_v1.sql\` (Identity PR #279);
2. \`20261028110000_artales_snapshot_general_v1.sql\` (Snapshot PR #278);
3. \`20261028111000_artales_snapshot389_register.sql\` (same PR #278).

Do not imply that a Draft, a PLAN, or a successful preflight authorizes APPLY. Do not auto-merge #279/#278 or enable Snapshot feature flag.

## Source behavior
The operator requires: exact clean \`main\` SHA, GitHub Actions \`workflow_dispatch\`, chosen first pending allowlisted migration with exact SQL SHA256, a successfully finished **prior protected** \`one-migration\` PLAN run on the same SHA, a matching actual \`artales-readonly-plan-receipt\` downloaded via \`actions/download-artifact\`, independent GitHub run metadata from the REST API, exact-plan digest and source/readback evidence, fresh writable-identity SQL ledger, role/host/TLS \`verify-full\` constraints, and re-execution of the pinned Supabase CLI v2.122.0 \`migration list\` + \`db push --dry-run --skip-vault\`. The runner uses the existing one-migration staging helper so later pending versions are deferred, not accidentally included. Right before real APPLY it checks remote main and ledger again. It then runs **one** version-preserving \`supabase db push --db-url ... --skip-vault --output-format json\`. An immutable source digest and exact ledger+md5 postcheck are mandatory.

The purpose-selected database operator is hard-coded \`artales_prod_apply_operator\` to refuse fallback to a project owner, read-only role, \`service_role\`, random credential or cross-project URL. **Do not create this identity or assume it can execute the SQL without separately reviewed grants.**

One local receipt is written as \`held_unknown\` **before** any provider write. If a CLI call fails or output/postcondition is uncertain, the job fails and the receipt stays \`held_unknown\`, autoRetryAllowed=false. If successful, receipt status is \`applied_requires_independent_readback\`; this is **not** an external approval to activate Snapshot. An independent Supabase readback of exact migration version and object/RLS state is still required.

## HIGH-risk provider authority blocker
Confirmed in actual ARTales Production: \`public.profiles\`, \`public.invites\`, identity trigger/function and \`supabase_migrations.schema_migrations\` are owned by \`postgres\`. \`storage.objects\` is owned by \`supabase_storage_admin\`. PostgreSQL owner privilege is required for \`ALTER POLICY\` and \`CREATE OR REPLACE FUNCTION\`. A generic INSERT+DDL grant to \`artales_prod_apply_operator\` will **NOT** suffice. No membership, \`SET ROLE\`, privileged fallback, owner password or grant changes should be inferred from this source proposal. Separate explicit operator/privilege design and human authorization are required, as is validation on an isolated PG17 owner fixture. If provider-managed owner policy makes the dedicated role technically infeasible, stop and bring that exact blocker back for a decision. Do not repurpose the previously blocked Supabase MCP apply path via a stronger client.

## Required later human gates
1. Finish isolated validation, code review, exact-head green CI and separately approve merging *this* source-only PR into \`main\`.
2. Separately approve a new protected GitHub Environment \`artales-production-apply\` (required reviewer \`ARTalesAdmin\`, main-only, no admin bypass), choose a provider-allowed narrowly bounded execution identity and audited grants, and separately provision only \`ARTALES_PROD_APPLY_DB_URL\` and \`ARTALES_PROD_APPLY_CA_PEM\`. Neither secret is currently present. Do not use general owner/root credentials as a convenience fix.
3. Merge Identity PR #279 under separate approval; keep Snapshot feature OFF. Obtain a successful **new** one-migration PLAN and independently check Production ledger before APPLY. The earlier *baseline* PLAN run #41308766110 is **not** suitable as the input to APPLY.
4. Independently approve exactly one APPLY for one source SHA/filename/hash and matching planRunId/proofDigest, dispatch manually and approve protected job; no standing dispatch authority.
5. After independent provider ledger, permissions and functional readback, repeat separately for Snapshot schema and historical #389 evidence register. Feature flag activation/second-title smoke are separate.

## Risk / rollback / test
Risk HIGH; Target production only after all gates; DB no in source-only PR, YES when applied; Env no in source-only PR, YES for a separate future setup; no production effects from this branch. Rollback before merge: close PR; after merge before activation: revert exact source commit and keep APPLY environment unconfigured. After a successful migration do **not** automatically reverse SQL; plan a separate compensating migration if necessary. Negative unit tests have no provider access. Disposable write-path acceptance on isolated PG17 is a separate required CI proof; until then **this is NOT production-ready**.

## Phoenix
Observed 2026-11-01: baseline protected PLAN run #41308766110 SUCCESS on main \`0d3e6200e2cd6d06f095846694488815bc688750\`, read-only role \`artales_prod_plan_ro\`, confirmed five historical migrations and stable checksums. Identity #279 remains Draft; Snapshot #278 Draft; no new SQL applied. This proposal advances from read-only PLAN to bounded source-only APPLY. No cross-boundary approval carried forward.
