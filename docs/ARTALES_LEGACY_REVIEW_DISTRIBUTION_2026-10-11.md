# ARTales — migration review assignment gate

Read-only draft planning only. Editor capacity and IDs are injected from trusted admin setup; no real account IDs or books are hard-coded. The proposed order is pilot titles assigned to the administrator, followed by capacity-aware distribution among active editors **including the administrator**. Work that still needs legal evidence, source discovery or semantic recomposition is excluded from regular editorial review until gates are satisfied. A blocking rights status never becomes a publication authorization.

This is **not** server-side assignment authorization or legal clearance. Actual enqueue must independently verify `auth.uid()`, active staff roles, a real immutable revision ID, current source and legal dossiers, work/task ownership and idempotency under row locks. Later build scoped work tasks, separate text and visual review and independent signoff. Current editorial inbox supports claiming/returning mostly candidate legal-review tasks; automatic work assignment is not wired.

Context: production read-only baseline 49 published, 15 drafts; 1 admin and 2 editor profiles. New candidates, `artales_evidence` and `editorial_tasks` are NOT yet applied in production, so no batch should run there. PR #205 pinned one Alice source only, #213 intake is Draft, #215 semantic editing integration is Draft. No live migration, snapshot, legal approval, or work conversion is performed.

Target develop, DB no, environment no, risk low for pure proposals. Rollback by revert. Exact-head unit, typecheck and lint must pass before any merge; no merge implied.
