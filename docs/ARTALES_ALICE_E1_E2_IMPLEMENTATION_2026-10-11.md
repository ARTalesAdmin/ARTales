# Alice E1/E2 safe integration — 2026-10-11

## Scope
E1 starts with a real read-only existing work UUID/slug and trusted archived pinned source, not a fixture ID. This PR only establishes a pure fail-closed binding contract, never a live reader or data fetch. No production data is exported into tests. The public Reader and notes/progress/entitlements remain authoritative and unchanged.

## Follow-on E1 browser integration
Protected editor/admin route must read existing work identity from signed session plus DB. Fetch immutable source snapshots and current editorial metadata with least privilege, and show original pinned source, new semantic composition and separately captured *legacy observed* content; evidence cannot be synthesized from slug or WorkBlock JSON. Unknown rights remain pending. Sanitization must not silently alter literary bytes. The current #215 preview is not this protected route.

## E2 persistence gate (not implemented in this PR)
Approved future migration/RPC must write append-only revisions and source-anchored editorial issues, binding auth.uid, active editor/admin profile, genuine work UUID, source snapshot, complete SemanticRevision digest, DB-A semantic_blocks JSONB digest (distinct), parent ancestry, current task and idempotency key. Reject foreign work, stale parent, duplicate/replayed writes, self-approval and forged source/rights. Provide signed GoTrue editor/admin/reader E2E and concurrent conflict tests in disposable local Supabase; no prod apply. Never write works.status or release pointer. Task assignment from #216 is only proposed until server verifies rights, revision and active staff.

## Governance
Risk low for pure code/tests; high for future authorized editor/DB operations. Target develop first. DB no; Env no; no main, production migrations, paid persistent Supabase or Nexus workers. Rollback: revert this isolated PR. Tests: `npx tsx --test tests/legacyWorkBinding.test.ts`, `npx tsc --noEmit`, ESLint. The authenticated route, actual Alice legacy reconciliation and persistent review are NOT yet implemented; do not claim E1/E2 operational completion.
