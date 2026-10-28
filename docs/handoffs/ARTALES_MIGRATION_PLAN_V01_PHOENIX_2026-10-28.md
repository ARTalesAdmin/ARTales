# ARTales PLAN v0.1 — Phoenix 2026-10-28
Work: plan-only, isolated main-based branch, user authorized source preparation.
Baseline main: 9306ac069bbfc60502e8a3247e3066bd11b001db.
Purpose: add strict JSON CLI 2.122.0 PLAN evidence verification, no executor
credentials or provider calls. Source-only tests and GitHub CI.

Evidence: official v2.122.0 CLI command source + JSON output formatter;
read-only production Supabase currently has the canonical 5 migrations.
The previous v0 evidence checker pins 2.119.0; v0.1 introduces a separately
pinned and tested JSON path rather than treating older text captures as proof.

Boundary: No new Arc auto-created; no merge, login, link, CLI execution,
production SQL, grant, feature flag or publication. Remaining: CI on exact
HEAD, review, explicit merge decision, then distinct authorization to
choose/read from ARTales-specific provider identity and execute live dry-run.
PR #279 Identity Authority and PR #278 Snapshot general are unchanged.
