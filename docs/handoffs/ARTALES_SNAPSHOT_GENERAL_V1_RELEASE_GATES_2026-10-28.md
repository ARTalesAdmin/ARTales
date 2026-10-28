# ARTales — Snapshot general v1: proposed production release gates

Date: 2026-10-28 (Europe/Prague). Draft PR #278 is **not authorized for release**.
Source of authority: Nexus STARTUP-01 / ARTales governance, explicit Architect approvals,
Phoenix handoff `ARTALES_SNAPSHOT_GENERAL_V1_PHOENIX_2026-10-28.md`.

## Scope / what acceptance would mean
- Generalize private **EPUB-only** raw capture for Gutenberg editions already approved
  and locked through Legal Screen. Admin-only POST; editor may inspect state.
- Exact SHA-256 storage path and full readback. Preserve original bytes; no upsert.
- Duplicate Gutenberg ID and candidate claims are immutable. Incomplete claims stop
  and require human reconciliation; no speculative automated retries after claim.
- Existing private #389 origin is registered **without upload or duplicate ingest**.
- Image retention remains private/archive-only; public illustration rights excluded.
- No old Reader integration, no semantic readiness or publication permission.

## Existing evidence (no production mutation in this PR)
- Production `main` baseline at this handoff: `98022c11`, private bucket one
  original and exactly one existing Legal lock for #389.
- Verified #389: Gutenberg ID 389, candidate
  `98508359-bce1-4e73-b842-b69a9d1112d0`, legal decision 9, owner verified,
  125934-byte EPUB, SHA-256
  `2e12d981f9c916e5c6264e284f97b03c8dda52f6de720451d32967d0be8736df`.
- Staged migrations: `20261027130000_artales_snapshot_general_v1.sql` and
  `20261027131000_artales_snapshot389_register.sql`.
- Isolated PostgreSQL 17 CI uses independent NOBYPASSRLS clients, validates
  admin/editor/anonymous policies, exact digest access, concurrency, duplicate
  claims and #389 readback registration.
- Preview status and GitHub CI must be re-read on the **exact final HEAD**. A
  historical PASS cannot authorize merge or production SQL.

## Phase A — source acceptance (read only)
1. Confirm Draft PR base remains `main`, exact HEAD and all CI checks SUCCESS,
   including PostgreSQL and Legal Screen. If live Gutenberg dependency fails,
   diagnose; do not mislabel it green or silently disable it.
2. Review the full SQL diff against live schemas, exact old Storage policy names,
   existing #389 legal lock/source/decision and object owner/size/path.
3. Review any Supabase security advisor regressions. Existing unrelated findings
   are recorded separately; do not grant more permissions to fix them.
4. Create no new active ARTales Continuity arc without explicit authority.

## Phase B — database rollout (requires separate explicit approval)
1. Take fresh read-only production evidence. Verify bucket contains exactly one
   #389 object and generic registry tables/policies are absent.
2. Apply ONLY the reviewed schema/RLS migration `20261027130000...`.
   Read back exact table constraints, grants, Storage policies and advisors.
   Feature flag remains OFF; source branch still unmerged.
3. After new dedicated authorization, apply ONLY evidence-backed backfill
   `20261027131000...`. It aborts if historical evidence or prior claim differs.
   Read back exactly one candidate claim and exactly one receipt for #389,
   exact SHA/path/size and unchanged Storage object count (=1).
4. Do NOT reapply a failed migration blindly. Investigate partial state first.

## Phase C — application rollout (requires separate explicit approval)
1. Merge reviewed exact HEAD. Verify production deployment READY on `main`.
   Keep `ARTALES_SNAPSHOT_GENERAL_V1` disabled through code deployment.
2. After independent authorization, enable `ARTALES_SNAPSHOT_GENERAL_V1=enabled`
   only for production, verify runtime environment and fresh deployment.
3. As admin/editor, confirm Legal Screen displays #389 as archived, no
   `Vytvořit Snapshot` button, no second upload, and no public asset rights.
4. Confirm non-admin cannot POST/create or read private archive; confirm
   no claims for unrelated candidates were created.

## Phase D — new title acceptance (separate Legal + Snapshot operator decision)
1. Legally screen and lock one different Gutenberg record/edition.
2. Start one admin-only consented Snapshot. Verify SHA-256 in Storage readback,
   exact receipt/claim and one additional private object; no public publishing.
3. Repeat click and simultaneous requests: read existing receipt or require
   reconciliation, never a second upload or automatic overwrite.
4. Check the resulting status is `archived_verification_pending`, not
   `verified_for_composition`, until independent content/edition QA exists.

## Recovery boundaries
- Before app activation, stop with flag OFF and investigate SQL if any readback
  fails. Do not delete existing #389 or globally UPDATE/DELETE registry data.
- After activation, turn only the feature flag OFF (separately authorized) to
  halt new general Snapshot requests, then inspect requests/claims/Storage.
- Do not use a blanket database rollback: schema creates append-only records,
  and the #389 historical object is a protected archival fact. Any compensating
  change needs its own reviewed migration and authorization.
- Existing dedicated #389 route remains a separately governed legacy pilot.
- No merge, APPLY, grants, feature activation or publication is authorized by
  this document; each release gate requires explicit Architect approval.

## 2026-10-28 reprioritization and current production prerequisite
Architect priority: minimal required fixes, then production rollout of Snapshot
general v1. Separate PLAN role/JIT/CI executor infrastructure is parked in
Draft PR #283 until later library work. Do not add a new privileged identity
merely to generate a plan.
PR #279 remains the narrower general role-authority correction, Draft and
unapplied. Live verified authenticated profiles.role remains UPDATE-capable,
therefore Snapshot's new admin RLS policy cannot be safely activated on that
profile claim alone. Before general Snapshot feature activation, ensure PR #279
is executed via a supported approved migration path with independently checked
ledger/grants/trigger, or an independently verified equivalent authorization
boundary; do not treat historical survival as a security control.
Source integration from 2026-10-28 merged main includes migration filename
canonicalization (#280). New Snapshot selection workflow must refer to
20261027081945_snapshot389_storage_admin_rls.sql, not historical
20261027083000. This is source-only correction.
The old Snapshot release-gate sequence needs review against currently
selected canonical execution surface: a blocked provider APPLY remains blocked,
and an exact SQL approval is not execution-surface authority.
No Snapshot flag activation, publication or DB mutation authorized here.
