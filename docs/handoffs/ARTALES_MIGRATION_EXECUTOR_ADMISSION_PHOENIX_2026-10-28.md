# ARTales Migration Admission v0 — Phoenix 2026-10-28

Active scope: source-only plan guard and negative CI; not an executor activation.

Baseline main: 3d899b314d516b3cd7d37dc0b983dd34feb1cb2c (merged PR #280). Working PR #281. No ARTales/Nexus work arc auto-created.

Added: pure migration inventory parser, source/ledger/request admission validator, non-provider offline CLI and CI with fail-closed synthetic tests. Output always mayApply=false. Canonical migration versions and hashes remain unchanged; Supabase project untouched.

Why: default Supabase CLI db push would process every pending migration. Production admission must verify a single exact approved artifact, version, checkout SHA and independent provider dry-run before any separately authorized APPLY.

Next gate: verify exact HEAD and CI; select/approve ARTales-specific operator and credentials in a **separate action**. No use of Nexus-scoped executor/credentials. Previous provider block remains a block, not a reason for a stronger fallback.

Identity PR #279 and Snapshot PR #278 remain isolated Drafts with no Production apply. See docs/protocols/ARTALES_MIGRATION_EXECUTOR_ADMISSION_V0.md.
