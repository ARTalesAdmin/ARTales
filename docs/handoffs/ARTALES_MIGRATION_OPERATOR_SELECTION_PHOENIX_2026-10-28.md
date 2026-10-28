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
