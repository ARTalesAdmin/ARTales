# ARTales — Production APPLY: minimal authority decision (2026-11-02)

Status: **preparation only; NO operator approval, credentials, environment change or Production APPLY**.
Work arc: `work:nexus:arc-3d6d55c95175431f9d5e9e92988945ad`, milestone `as-2-identity-security`.
Canonical repo: `ARTalesAdmin/ARTales`; bootstrap exception PR #286: new branches from current `main` to PR into `main`.

## Practical outcome and current truth

Target is the **single** pending, source-committed migration
`supabase/migrations/20261028091029_artales_identity_role_authority_v1.sql`,
then independent rights and auth-trigger readback. Do **not** apply the two newer
Snapshot migrations as part of this operation.

Verified provider state (read-only, 2026-11-02):
- Production project `nmhdwmszbwgrgfbmlguu` records **five** applied versions ending
  `20261027081945_snapshot389_storage_admin_rls`; identity version is absent.
- `authenticated` retains column UPDATE on both `public.profiles.role`
  and `public.profiles.is_active`. This is a live security gap.
- `public.profiles`, `public.invites`, Supabase migration ledger owned by `postgres`;
  `storage.objects` owned by `supabase_storage_admin`.
- The separate `artales_prod_plan_ro` login exists; **no**
  `artales_prod_apply_operator` login exists.
- Protected baseline PLAN run `41308766110` passed on an **old** main SHA,
  not on this exact pending single-migration request. Baseline PLAN cannot back an APPLY.
- Draft PR #285 adds one-migration APPLY source, but is **not deployable as-is**.
  Its dedicated low-privilege role design does not solve owner-only privileges for
  `CREATE OR REPLACE FUNCTION` and ownership-sensitive policy changes.
- A previous attempt to use the Supabase MCP APPLY surface was blocked.
  That rejection is **not** permission to switch to owner SQL Editor / privileged CLI.

## Smallest safe resolution — one decision, not another subsystem

**First decide the supported authority boundary; no implementation can
manufacture ownership with extra SQL GRANTs.** Choose ONE separately reviewed
provider-approved execution model, based on actual provider support:

A. **Dedicated narrowly authorized operator**, only if verified technically
possible for the precise SQL and ledger without broad postgres/storage ownership
or privileged role fallback. The existing PR #285 can then be completed with
isolated PG17 owner-boundary integration tests and protected environment review.

B. **Explicit one-time owner-operated maintenance**, *only* if the owner-managed
DDL genuinely requires it and the Architect independently authorizes this
specific stronger surface after reviewing the prior provider denial. Label it
maintenance/break-glass, not successful execution of the old governed APPLY
path. Limit to one reviewed SQL artifact and preserve exact migration history
through a supported version-preserving CLI or migration operation; no manual
untracked SQL, `migration repair`, credential sharing or generic `db push`.

**Neither A nor B is approved by this preparation document.** If provider
rules deny the chosen mode, STOP and preserve the denial. Do not attempt a
different interface, role or credential as a fallback.

## Read-only admission before any later authorized operator setup

1. Re-read `main` HEAD, exact SQL SHA-256, preflight predicates and
   `supabase_migrations.schema_migrations`. Verify exactly five applied
   versions and exactly these three ordered pending migrations:
   `20261028091029`, `20261028110000`, `20261028111000`.
2. Review owner and actual privileges of `profiles`, `invites`, the
   auth-user sync function and migration ledger. Verify PostgreSQL 17
   owner/membership semantics in disposable fixture; do **not** test
   privileged DDL against Production.
3. Review the independently enforced earlier APPLY refusal and its exact
   reason, and obtain the Architect's explicit selection of identity/surface.
4. Only after that decision, complete the smallest necessary part of Draft
   PR #285, verify isolation and source CI on exact branch HEAD. No broad
   reusable migration framework is a prerequisite.
5. Provision operator and protected GitHub environment/secrets **only after
   separate authorization**, with independent provider identity readback.
6. Perform **new protected one-migration PLAN** bound to the current main SHA,
   exact filename/hash and intended operator; use staged one-migration
   inventory so default CLI cannot push all three pending files.
7. Obtain a separate exact-action APPLY authorization identifying
   project, main SHA, SQL SHA-256, plan run/receipt, identity, environment and
   fallback=none. Freshly recheck before the write.
8. Execute **exactly one** migration using the authorized version-preserving
   official Supabase CLI path. On any unknown outcome, STOP; never blindly
   retry or manipulate the ledger.
9. Independently verify one new ledger version, `authenticated` cannot
   UPDATE privileged profile fields, self-service allowed fields still work,
   trusted invite-based role assignment works and user-editable metadata
   cannot escalate privileges. Check RLS, function grants and security advisors.

## Acceptance and stop

AS-2 is not complete without independent production evidence for
`20261028091029`, denied `authenticated` UPDATE of role/is_active,
and preserved normal onboarding. Only afterward proceed to Snapshot
schema `20261028110000`, historical #389 register `20261028111000`,
and visual retention. Each later migration receives its own PLAN/APPLY/verification.

Risk HIGH in future production execution; this PR is docs-only.
DB: no. Env: no. Target: source-only `main` PR. Rollback: revert this
document. Tests: source/provider read-only facts above; **no APPLY test passed**.
AutoApply=false; authorizationCarryForward=false; nextBlock=unselected.
