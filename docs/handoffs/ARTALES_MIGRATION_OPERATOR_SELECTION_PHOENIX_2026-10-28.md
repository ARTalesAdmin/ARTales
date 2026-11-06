# ARTales — PLAN operator selection Phoenix, 2026-10-28

Existing canonical source baseline: PR #280, #281 and #282 merged.
Current main at investigation: ec27f82f0862806747ccf5007026377164d68c0c.
Working scope: source-only operator selection and exact evidence.

Provider read-only results:
- ARTales ref nmhdwmszbwgrgfbmlguu healthy, Postgres 17.6.1.104.
- Existing applied ledger: five migrations. Four post-baseline MD5 hashes
  exactly match the canonical source inventory. Current main has no pending SQL.
- Built-in supabase_read_only_user has SELECT on 80 tables across auth,
  public, realtime, storage, vault and migration history; BYPASSRLS true;
  table writes denied, but 10 public SECURITY DEFINER routines executable.
  Rejected for least-privileged PLAN identity.
- No enabled JIT, scoped PAT access, or real CLI run proven.
- Approved operator environment *for design*: human-controlled local
  checkout, no GitHub Actions secrets. Proposed database principal:
  artales_migration_plan_reader, not created.

Next operator boundary: isolated negative PostgreSQL privilege tests and
reviewed direct-URL CLI proof (the merged v0.1 linked validator cannot
substitute). After review, separate authorization for role/JIT/credentials.
No stronger-path workaround for earlier blocked production apply.

PR #279 Identity Authority and PR #278 Snapshot general remain Draft and
unapplied. No automatic Continuity arc created. No production changes,
new credentials, role grants, feature activation or publication this turn.

## 2026-10-28 addendum — disposable proof and current blocker

Source commit 5d336f04ca1d2af08217be64adf9f06037041047:
- GitHub Actions run 40712107172: offline-admission PASS; disposable-postgres-17-role-proof PASS.
- CI fixture role: ledger SELECT allowed, ledger INSERT/UPDATE/DELETE and private table SELECT/INSERT denied, CREATE in public denied.
- A PUBLIC EXECUTE SECURITY DEFINER canary created by fixture superuser nevertheless updated an owner-private table when called as the reader. An isolated fixture-only REVOKE then blocked it.
- This is **not** authorization to revoke PUBLIC EXECUTE on ARTales Production; 10 existing functions are publicly callable and their app callers may depend on that.
- Production readback: proposed role absent. No role/grant/JIT/credential/login/provider CLI/SQL mutation performed.
- The proposed role is **not safe to provision** until effective function execution is constrained with an independently audited design. Direct --db-url CLI JSON proof also needs its own test implementation; --linked v0.1 evidence is not equivalent.
- Keep PR #283 Draft; merge requires separate exact authorization. Do not apply PR #279 or #278.
