# ARTales P0 — AI semantic QA rollout

**Scope:** ARTales only; no Nexus, legacy reader, published text, automatic publication, or unapproved content rewriting.

## Runtime contract

1. An editor who has **claimed** the title's current text-QA task sends open flags to ARTales AI. No administrator approval is required for ordinary assigned-work repairs.
2. A Vercel Cron worker with a server-only secret claims a durable job, checks the exact parent revision SHA and editor ownership, and calls Vercel AI Gateway using **Vercel OIDC**. No direct provider key is required.
3. Strict structured model output is validated against each source-anchored flag. The model cannot change atoms or source text. Unsafe or uncertain suggestions remain open for human review.
4. Protected terms (personal names, work titles and other nonbreaking expressions) are automatically stored as **rendering-only work metadata**. This is not an editor-maintained language-rules registry and does not alter the source SHA. The editor visually verifies pagination and resolves the open finding after inspection.
5. For safe block-layout actions, the deterministic composer and database independently check source integrity, atomicity, the specific flags, and expected parent SHA. The worker may create a **draft QA revision**, not publish it. The assigned editor can accept or return each change and close QA only when all gates pass.
6. Gateway generation ID and token usage are recorded in an admin-only table before the worker commits the safe layout revision. Every retry is a separate generation receipt. Unknown exact prices remain NULL until independently reconciled with the Gateway; they must not be reported as zero.

## Staged rollout (not yet authorized for automatic APPLY)

- [x] PR #304 QA source ported onto updated current main in draft PR #307.
- [x] Gateway OIDC adapter and strict structured-output bridge.
- [x] Work-local nonbreaking-name corrections applied by the worker without administrator approval.
- [x] Generation usage ledger schema and admin token-report UI.
- [x] Worker disabled unless ARTALES_AI_DURABLE_JOBS_ENABLED=enabled.
- [ ] Isolated Postgres verification of all 5 SQL files and correct RLS/service_role grants; no billed Supabase branch is created without agreement.
- [ ] Integration tests for exact SHA, tampering, duplicate generation, concurrent workers, canceled/failed provider requests, retry and admin isolation.
- [ ] Live Gateway authentication, model, budget/credits, cost reconciliation and one bounded request.
- [ ] Authenticated end-to-end pilot on Pan including the Raymond no-break line, editor accept/return, QA task continuity, and a verified immutable source SHA.
- [ ] Production merge and controlled feature activation after gates are green.

### Database migration order

1. `ops/sql/20261104_artales_ai_qa_durable_jobs.sql`
2. `ops/sql/20261104_artales_qa_change_decisions_v4.sql`
3. `ops/sql/20261104_artales_qa_closeout_v4.sql`
4. `ops/sql/20261104_artales_safe_layout_commit_v4.sql`
5. `ops/sql/20261106_artales_ai_gateway_usage.sql`

Review each migration against current production objects. Do **not** run these against production just to preview the feature.

### Production configuration

- `ARTALES_EDITORIAL_AI_MODEL`: a confirmed live Gateway `provider/model` ID; initial candidate `openai/gpt-5.4-mini`, verify availability and structured Responses API on a bounded pilot.
- `VERCEL_OIDC_TOKEN`: supplied by Vercel's production runtime. No provider API key is stored by ARTales.
- `CRON_SECRET`: securely generated and stored by Vercel, never committed.
- `SUPABASE_SERVICE_ROLE_KEY`: existing server-only production secret.
- `ARTALES_AI_DURABLE_JOBS_ENABLED`: leave unset/disabled until an authorized pilot.
- Configure a small, project-scoped Gateway budget **before** enabling requests; this is an external billing action and needs its own approval.

### Rollback and truthfulness

Disable the AI feature first, then restore the previous Vercel build if needed. Do not delete revisions, QA flags, generation receipts or audit events. Service-only worker writes must fail closed if the database ledger is unavailable. The admin report distinguishes missing database schema from an empty ledger and unknown prices from known zero.

### Verified boundaries

Passing GitHub CI / Vercel preview does **not** prove live Gateway spend, SQL correctness on production, authenticated editing or a working Pan repair. All such claims require dedicated readback.
