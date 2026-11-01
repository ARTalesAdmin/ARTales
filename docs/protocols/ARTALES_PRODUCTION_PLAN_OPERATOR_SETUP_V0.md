# ARTales — one-time protected Production PLAN setup v0

**Status 2026-11-01:** REVIEW-ONLY. This page is NOT approval to run SQL, create a DB role, issue credentials, configure GitHub, merge PR, dispatch workflows or perform APPLY. Source-only proof at PR #284, exact-head PASS: 5989caea800825f047d8d715c5e8595c0c985fef, CI #41295211563 (both jobs). The next HEAD with this guide/role-membership check requires its own green CI. This is the smallest bounded setup for a single read-only PLAN identity.

**Target project:** ARTales Production, Supabase project ref \`nmhdwmszbwgrgfbmlguu\`. **Protected GitHub repository:** \`ARTalesAdmin/ARTales\`. Runtime executor: \`scripts/artales-production-plan-operator.mjs\` and \`.github/workflows/artales-production-readonly-plan.yml\`. Risk **HIGH** (new Production identity and GitHub secrets). Source-only changes: DB=no, Env=no; performing this guide: DB=yes (role/grants only), Env=yes (secrets/environment). Production SQL schema migrations, APPLY, grants on \`public\`, global RLS changes, \`migration repair\`, \`db push\` without \`--dry-run\`, privileged fallback and PR merges are excluded.

## Read-only provider facts (verified 2026-11-01 before any setup)

- PostgreSQL 17.6; \`artales_prod_plan_ro\` **does not exist**.
- Five applied versions: \`20260926142755_remote_schema\`; \`20261023063248_prescreen_shadow_library_v1\`; \`20261024073928_candidate_intake_ab\`; \`20261025095658_legal_screen_v1\`; \`20261027081945_snapshot389_storage_admin_rls\`.
- Four non-baseline provider \`md5(statements[1])\` fingerprints match committed source. Baseline has 557 statement parts and is intentionally verified by version/name, not byte equality.
- \`schema_migrations\` has six columns: \`version\`, \`statements\`, \`name\`, \`created_by\`, \`idempotency_key\`, \`rollback\`. Existing table is only read; RLS is off.
- PostgreSQL database has \`CONNECT\` and \`TEMP\` privileges for PUBLIC; \`public\` schema offers PUBLIC \`USAGE\`, not \`CREATE\`. The two non-system relations with PUBLIC SELECT are the extension diagnostics \`extensions.pg_stat_statements\` and \`extensions.pg_stat_statements_info\`. The new role inherits ordinary PUBLIC privileges, so "only SELECT on schema_migrations" is not a literal database-wide exclusivity claim; in particular TEMP is not removed globally as doing so would affect other clients. Persistent application-table write grants are not proposed.
- Supabase documentation confirms direct/server and session-pooler connections, and the provider-managed root CA for \`sslmode=verify-full\`; no project SSL settings need to change.

## Step 0 — decisions to obtain separately

A. Approve exact source release of runner PR #284 (after full CI, review and required ARTales release policy). **Do not merge automatically**.
B. Approve creation of **one** new Production login \`artales_prod_plan_ro\` with only the grants below, a fresh random password, and independent readback. Not the same approval as A.
C. Approve creation of protected GitHub Environment \`artales-production-plan\` with one required reviewer, allowed deployment branch **main only**, and two environment-scoped secrets; no repo-wide secrets. Not the same approval as A or B.
D. After setup, authorize the **first manual baseline PLAN dispatch** with the exact merged main SHA. No migration APPLY follows from D.

The production environment is never used on \`pull_request\`. The existing previous MCP denial must not be bypassed by a more privileged actor. Administrator credentials must never be substituted into \`ARTALES_PROD_PLAN_DB_URL\`.

## Step 1 — exact proposed PostgreSQL role (NOT RUN)

Use one explicitly approved, human-operated database role provisioning action within Supabase. Password is generated and kept by the human in a password manager; never supply it in chat, source code, CI logs, artifacts, PR or shared handoff. For the SQL form, replace \`<FRESH_RANDOM_SECRET>\` privately, taking care of SQL literal escaping and query-history exposure. Prefer secure password entry/rotation via an approved management interface where offered. The string below is a **review template only**, not runnable as-is:

\`\`\`sql
BEGIN;
CREATE ROLE artales_prod_plan_ro
  WITH LOGIN PASSWORD '<FRESH_RANDOM_SECRET>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE artales_prod_plan_ro SET default_transaction_read_only = on;
GRANT CONNECT ON DATABASE postgres TO artales_prod_plan_ro;
GRANT USAGE ON SCHEMA supabase_migrations TO artales_prod_plan_ro;
GRANT SELECT ON TABLE supabase_migrations.schema_migrations TO artales_prod_plan_ro;
COMMIT;
\`\`\`

Do **not** grant any other membership, \`CREATE\`, \`INSERT\`, \`UPDATE\`, \`DELETE\`, \`TRUNCATE\`, schema ownership, \`service_role\`, \`postgres\` or \`BYPASSRLS\`. Never change database-wide PUBLIC grants just to make this operator pass. \`default_transaction_read_only\` is an additional safety setting, **not** the privilege boundary: the privilege boundary is the absence of persistent writes and elevated role memberships.

Review-only rollback for the unneeded new login: first revoke GitHub secret and cancel pending PLAN workflows, then **after separate approval** \`REVOKE SELECT ON supabase_migrations.schema_migrations FROM artales_prod_plan_ro; REVOKE USAGE ON SCHEMA supabase_migrations FROM artales_prod_plan_ro; REVOKE CONNECT ON DATABASE postgres FROM artales_prod_plan_ro; ALTER ROLE artales_prod_plan_ro NOLOGIN;\` Do not DROP/DELETE credentials, roles or other DB objects automatically.

## Step 2 — independent privileges check (after B, do not assume success)

Run using an authorized read-only provider path (such as the already-connected Supabase readback tool); no password needed for the check:

\`\`\`sql
SELECT r.rolname, r.rolcanlogin, r.rolinherit, r.rolsuper,
       r.rolcreatedb, r.rolcreaterole, r.rolbypassrls,
       (SELECT count(*) FROM pg_auth_members am WHERE am.member=r.oid) AS membership_count,
       has_database_privilege(r.rolname,'postgres','CONNECT') AS can_connect,
       has_database_privilege(r.rolname,'postgres','CREATE') AS can_create_database,
       has_schema_privilege(r.rolname,'supabase_migrations','USAGE') AS can_use_migrations,
       has_schema_privilege(r.rolname,'supabase_migrations','CREATE') AS can_create_migrations,
       has_schema_privilege(r.rolname,'public','CREATE') AS can_create_public,
       has_table_privilege(r.rolname,'supabase_migrations.schema_migrations','SELECT') AS can_select_ledger,
       has_table_privilege(r.rolname,'supabase_migrations.schema_migrations','INSERT') AS can_insert_ledger,
       has_table_privilege(r.rolname,'supabase_migrations.schema_migrations','UPDATE') AS can_update_ledger,
       has_table_privilege(r.rolname,'supabase_migrations.schema_migrations','DELETE') AS can_delete_ledger,
       has_table_privilege(r.rolname,'supabase_migrations.schema_migrations','TRUNCATE') AS can_truncate_ledger
FROM pg_roles r WHERE r.rolname='artales_prod_plan_ro';
\`\`\`

Require exactly one row, login=true, no inheritance, no elevated role capabilities, zero memberships, CONNECT/USAGE/SELECT true, all CREATE/INSERT/UPDATE/DELETE/TRUNCATE false. A selected SQL readback performed through an admin connector proves provider-side grants, **not** that the future GitHub runtime has authenticated. First runtime PLAN must assert its own \`current_user\`, \`session_user\`, effective rights, SSL and fresh ledger.

## Step 3 — separate protected GitHub environment (after C)

1. In \`ARTalesAdmin/ARTales\` → Settings → Environments, create **\`artales-production-plan\`**, restrict deployment branches to **main**.
2. Require a specific human reviewer. In a single-maintainer repo, **do not enable Prevent self-review** without a second eligible reviewer (it could deadlock); record manual PLAN authorization separately. Do not enable automatic bypass. No unrestricted environment authorization.
3. After A and B are approved and complete, set only the environment-scoped secret **\`ARTALES_PROD_PLAN_DB_URL\`**: URL for **\`artales_prod_plan_ro\`** at the project's direct hostname \`db.nmhdwmszbwgrgfbmlguu.supabase.co:5432/postgres\`, or the Supabase-issued session pooler hostname on port 5432 with username \`artales_prod_plan_ro.nmhdwmszbwgrgfbmlguu\`. Use a privately generated percent-encoded password; query \`sslmode=verify-full\`; do not put \`sslrootcert\` in this secret (the runner supplies it). Do not use transaction pooler port 6543. Never use project owner password.
4. Set only the environment-scoped secret **\`ARTALES_PROD_PLAN_CA_PEM\`** to the PEM root CA certificate downloaded from this project's Supabase Dashboard → Database settings → SSL Configuration. It is not a private key. Verify its provenance with the human; do not paste to PR or chat.
5. Limit workflow permissions to \`contents: read\`; leave the existing action \`workflow_dispatch\` only on \`main\`; do not grant role or secrets to pull request jobs.

Rollback for this environment under a separate authorization: disable reviewer approval/dispatch access or revoke both environment secrets; do not modify repository-wide secrets or broad policies.

## Step 4 — first real read-only baseline PLAN (separate D)

After the exact code is approved and merged to main, obtain its **new** exact \`main\` SHA (not the Draft HEAD). Independently confirm only the five historical migrations are present. In GitHub → Actions → **ARTales Production read-only PLAN (NO APPLY)** → Run workflow:
- Branch: \`main\`.
- \`main_sha\`: the exact merged SHA.
- \`mode\`: \`baseline\`.
- \`migration_filename\`, \`migration_sha256\`: both empty.

Approve the queued protected environment job as the human reviewer. The script checks role privileges + exact main, verifies server certificate, reads migration history, executes **only** CLI 2.122.0 \`migration list\` and \`db push --dry-run --skip-vault\`, re-reads history, and saves a redacted \`artales-readonly-plan-receipt\` artifact with \`mayApply:false\`. On any mismatch, **stop**, do not use a stronger credential.

Independently read the production ledger through the existing Supabase connector **after** PLAN and check still five migrations. This separate connector readback is a second evidence source. A successful same-operator before/after comparison does **not** replace it.

Subsequent one-migration PLAN requires independently approved merge of Identity PR #279 and exact version \`20261028091029_artales_identity_role_authority_v1.sql\` and its SHA-256 from the merged commit. Snapshot PR #278 then contributes exactly two SQL versions: \`20261028110000_artales_snapshot_general_v1.sql\`, \`20261028111000_artales_snapshot389_register.sql\`, planned and eventually applied **one at a time** via independently approved gated APPLY executor. The PLAN cannot authorize APPLY.

## Safety findings and limits

- PostgreSQL PUBLIC \`TEMP\` is inherited. Avoid global \`REVOKE TEMP FROM PUBLIC\` solely for this project; it may break unrelated clients. The PLAN role is denied persistent database/table writes and role membership escalation. Do not imply the account is physically incapable of all temporary writes if a session changes default settings.
- The root CA verification with real project's host can only be proven through a separately authorized production connection, not by disposable PG17.
- No runbook instruction is permission to run it. Every production credential, role, GitHub settings transition, source merge, workflow dispatch and SQL APPLY needs its own action-specific approval.
