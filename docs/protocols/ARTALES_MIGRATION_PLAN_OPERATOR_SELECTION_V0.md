# ARTales — Selection of a governed migration PLAN operator (v0)

Date: 2026-10-28. Status: source-only decision proposal. No database mutation,
no credential provisioning, no live CLI and no authorization for APPLY.
Project ref: nmhdwmszbwgrgfbmlguu. Repository: ARTalesAdmin/ARTales.

## Context and explicit distinction
- This is a **new** ARTales migration PLAN process, not a claim about how
  historical ARTales SQL was applied.
- Current Production main at selection time: ec27f82f0862806747ccf5007026377164d68c0c.
  Production migration ledger contains five versions, with four post-baseline
  SQL MD5 fingerprints matching the canonical repository.
- Identity Authority PR #279 and Snapshot general PR #278 are Draft and
  not applied. Main currently has **zero** pending migrations.
- The Supabase connector's earlier production apply was rejected by platform
  safety controls. The rejection remains binding. PLAN cannot become a
  replacement APPLY surface without a separately governed authorization.

## Environment chosen for design
Human-controlled, ephemeral local workstation checkout on an exact reviewed
ARTales commit. No GitHub Actions runner holding production DB credentials,
no Vercel function, no separate long-lived PLAN service, no Nexus credentials.
Artifacts are private and short-lived. A later human operator must explicitly
authorize any login, token creation, JIT role mapping, target connection or
actual remote CLI execution.

## Database identity
**Proposed** dedicated PostgreSQL role: artales_migration_plan_reader.
It is not present or active and MUST NOT be auto-created. Desirable
properties: LOGIN (for approved short-lived JIT only), NOINHERIT,
NOSUPERUSER, NOCREATEROLE, NOCREATEDB, NOREPLICATION, NOBYPASSRLS,
USAGE on supabase_migrations schema and SELECT on
supabase_migrations.schema_migrations, no other table writes or reads.
All grants, memberships, PUBLIC routines and inherited permissions must be
audited before any real role creation. No blanket PUBLIC privilege changes
are authorized. Session default read-only is defense in depth, **not**
a security boundary (a session may change it).

### Why the existing built-in read-only role is rejected
Read-only production SQL (2026-10-28) verified that
supabase_read_only_user has SELECT on **all 80** inspected tables:
auth 27, public 40, realtime 3, storage 8, supabase_migrations 1,
vault 1. It has no table INSERT/UPDATE/DELETE in those schemas,
but has BYPASSRLS and can execute 10 public SECURITY DEFINER routines.
It is unnecessarily broad for the migration ledger and therefore is
**not** selected as the ARTales PLAN principal.

## Temporary access and credentials — still an unresolved gate
Production Postgres version: 17.6.1.104, sufficient for Supabase temporary
database access (requires >=17.6.1.081). Its current JIT setting was not
accessible from the connected tools. Provider documentation says disabled
by default; do NOT infer actual project state.

Preferred option only if supported: explicit human authorization for narrowly
time-limited, CIDR-restricted JIT access to the dedicated role, under a
project-scoped Supabase PAT with minimum permissions. Scoped PATs are in
public alpha; availability for this account is unknown. A classic PAT would
carry access to all present/future projects and is NOT an acceptable silent
fallback. Never send tokens or database URLs in chat, issues, commits, job
logs or raw CI artifacts.

## CLI execution boundary and validator gap
Reviewed CLI tag: v2.122.0 (released 2026-10-23).
The CLI has a direct --db-url target mode for migration list and db push.
It is mutually exclusive with --linked. Explicit --project-ref cannot be
combined with --db-url in v2.122.0, so the direct connection target requires
an independent identity/host attestation and matching provider ledger.
The current ARTales PLAN v0.1 proof pins --linked --project-ref and does NOT
validate --db-url transcripts. Never fabricate equivalent linked evidence.

A direct-URL PLAN would include migration list and db push --dry-run
--skip-vault with JSON output. The operator MUST check CLI --help and
version before selecting arguments, and review the credential-handling
strategy (command-line URL arguments can leak secrets to process inspection).
Do not run these commands before a reviewed direct-URL proof validator,
bounded operator approval and actual JIT identity provisioning.

## Fresh Production effective-privilege audit — read-only 2026-10-28

The proposed `artales_migration_plan_reader` role **does not exist** in Production.
Catalog review found 11 `public` SECURITY DEFINER functions, 10 executable
through `PUBLIC`. Those functions are owned by `postgres`, and `public`
has PUBLIC schema USAGE. Examples include membership/AT-credit operations and
profile onboarding routines; their security must be assessed separately.
Having NOINHERIT on a new role does **not** negate PUBLIC function EXECUTE.
An isolated PG17 test proves even a role with ledger-only table SELECT can
invoke a PUBLIC SECURITY DEFINER routine that changes its owner's private data.
The fixture-only global REVOKE is a diagnostic control, **not** an authorized
Production change (it could break existing application callers).

Thus the proposed role is currently **BLOCKED**, not provision-ready. The
offline `artales-migration-role-audit.mjs` rejects any effectively executable
SECURITY DEFINER routine or other table read/write grant. Operator attestations
are not authenticated provider receipts. No blanket PUBLIC revoke or grant
change is approved, and the CLI plan remains not activated.

## Before any approved remote PLAN
1. Audit proposed role's table, schema, function and SECURITY DEFINER
   effective privileges; test it with negative access cases in disposable
   PostgreSQL and validate actual effective grants afterward.
2. Determine whether scoped PAT and temporary access are available in the
   human's dashboard. Do not enable them or create secrets during source prep.
3. Extend PLAN evidence format to bind exact project and DB role for a
   direct-URL CLI path; preserve mayApply=false and reject unknown outputs.
4. Obtain distinct authorization for role DDL/grants, time-limited JIT and
   operator login. Provider setting changes are separate from repository work.
5. On current main the expected pending set is empty. To plan PR #279's one
   pending migration, define an exact reviewed release-candidate checkout
   or separately authorize the source merge first; do not call a zero-pending
   main dry-run proof of PR #279 deployment readiness.
6. Any denied command, unexpected SQL, credential issue or provider mismatch
   is STOP. No credential/route escalation; keep the earlier apply block.
7. This doc authorizes no merge, production change, access transition or apply.

Sources: Nexus EXECUTION_SURFACE_AUTHORITY and ADR-0013;
ARTALES_PRODUCTION_MIGRATIONS; Supabase platform temporary-access and
personal-access-token docs; CLI v2.122.0 command sources.
