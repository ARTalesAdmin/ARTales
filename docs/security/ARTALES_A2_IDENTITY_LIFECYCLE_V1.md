# ARTales A2.2 — identity lifecycle and atomic invitation acceptance

Status: implementation contract proposed for the A2 workstream, NOT a production or migration authorization.
Base: f18e237c31ba664413d893c37aa52326a6fe8334
A2.1: application #383 and migration #384 deployed. APPLY 46133594225, independently read back: ledger 34; exact migration 20261128094513, 11 statements cover the reviewed source. Browser E2E remains open.

## Verified production findings, 2026-11-28

- `lib/profileSync.ts` currently computes the next role from a pending invitation, then upserts the profile with `is_active: true`, then attempts to accept the invite in a separate request. A failed/revoked/competing acceptance can leave an already changed role. A stale read also allows role/activation overwrite.
- `artales_ensure_profile_after_login_v082()` likewise writes `is_active=true` on conflict and changes the role before checking the invitation update result. `artales_complete_onboarding_v082(text,text)` calls it without checking the returned result. Both are currently executable by anon/authenticated/service_role; their bodies check auth.uid(), but that does not make reactivation acceptable.
- `artales_sync_profile_from_auth_user_v081()` runs only AFTER INSERT on auth.users and independently performs role assignment/acceptance. It uses the actual email plus a pending invitation, not mutable role metadata. It also writes is_active=true on conflict.
- `registerFromInvite` calls service profile sync even after a sign-up returning no session. `registerReader` contains an ignored client profile upsert that is already denied by profile grants.
- `auth.users`: 21 rows, all with profiles; all 3 existing privileged admin/editor profiles have verified email, the 17 unverified profiles are readers. No inactive profiles at observation time. No individual account data included here.
- `profiles`: existing role, activity, referral and onboarding fields; unique non-null handle index. Existing self-update RLS does not require active status. No broad profile role/state DML for browser roles.
- Supabase security advisor after A2.1: 7 anonymous-executable and 23 authenticated-executable public SECURITY DEFINER findings; these counts do not classify every function as unsafe. The invitation email helper is no longer in these findings. Other A2/B/C areas remain separate.

## Proposed invariant

1. Account activation is independent of authentication, onboarding and invitation acceptance. Existing inactive profiles remain inactive. No synchronization path sets an existing profile active, rewrites its role from stale input, or consumes an invite for an inactive profile. Explicit trusted administrator state changes remain possible; no historical account updates/backfill.
2. Use auth.users id and verified email as authority, not request-supplied email or editable metadata. Create an unconfirmed new account as reader; do not consume an invite or elevate it before email confirmation. Existing roles are not retroactively demoted. A verified email matching a pending, non-expired invite authorizes only the role recorded by the trusted manager. Existing role policy is retained for intentional future invitations. The invitation selection rule (multiple valid invites for one address / explicit link vs latest) must be deterministic and tested; do not silently implement a different product rule.
3. Exactly one DB transaction locks the relevant identity/profile and candidate invite, verifies status/expiry/identity, conditionally changes the invite to accepted, then changes the profile and writes acceptance audit. A zero-row conditional acceptance never grants the role. Failure rolls back all three effects. Replay does not duplicate audit or accept an already accepted/revoked invite. Test the competing revoke and duplicate-call cases with real isolated roles.
4. Existing profile preferences, onboarding fields, and historical referral attribution are not overwritten by ordinary login. Self-service onboarding validates auth.uid(), active status, handle uniqueness and completion marker.
5. Existing auth trigger and login/onboarding RPCs delegate to one internal transactional implementation, with fixed pg_catalog search_path and qualified relation/function names. Internal arbitrary-UID operation is not executable by PUBLIC/anon/authenticated/service_role. Keep the existing authenticated self-scoped RPC names for the app; do not create an additional externally callable service RPC or a second profile authority. Remove direct anonymous access and unnecessary grants; auth trigger retains the trusted execution context. Confirm exact call sites with repository-wide CI grep.
6. Application uses the session-scoped RPC after a verified auth session and reads its own profile through RLS. Remove legacy multi-request service-role upsert/acceptance from profileSync and remove forbidden, ignored browser profile insert from registerReader. No pre-confirmation service-role acceptance from registerFromInvite. Existing error/redirect contracts need review; inactive account should follow existing inactive-login path.
7. For confirmation callbacks that do not use password login, verify the existing auth callback/session flow and ensure confirmation-to-identity sync without granting anything before verified email. Avoid changes to public catalog or reader.
8. The proposed verified-email boundary changes when new invitations take effect; it does not change current account roles. In particular, do not add a blanket confirmation requirement to existing reader access without a product decision.

## Rollout plan

- DB-first: isolated SQL candidate and tests for the shared implementation and legacy RPC wrappers, preserve compatibility with the deployed application. Allocate a canonical filename via pinned native CLI, run full PR CI, review exact source, then existing separate PLAN/APPLY and independent readback.
- App immediately after DB verification: switch current callers to the self-scoped canonical RPCs, remove direct service upsert/acceptance; test sign-up with no session, verified first login, revoked/expired invite, onboarding, inactive account, repeated login. Separate exact-head merge/release approval.
- During the transition the old application can still perform its legacy direct service writes. The database-first step alone is NOT closure; do not present it as such. Avoid deactivating accounts or issuing new privileged invites during the rollout until app is updated. This is an operational recommendation, not an authorized production mutation. If that gap is unacceptable, explicitly review an application-first compatibility cutover instead of installing an unreviewed trigger guard.
- Post-release: independent catalog/ACL/ledger and application deployment readback; isolated end-to-end account flow when an approved test environment is available. Do not write to real customer accounts to prove safety.
- Later A2 work: active-state checks across editorial and account RLS/actions, scoped RPC grants, remaining public/table/column/sequence privileges, storage/view boundaries; B1/B2 for paid content/internal editorial boundary. No blanket revocation.

## Test matrix (implementation gate)

| Case | Expected |
|---|---|
| unconfirmed registration with matching privileged invite | reader profile, pending invite |
| confirmation and valid invite | exactly one accepted transition, correct role |
| unconfirmed login / forged metadata | no new elevated role |
| normal confirmed registration without invite | reader |
| active existing admin/editor without new invite | unchanged role/state |
| inactive account, even with valid invite | no reactivation, role unchanged, no acceptance |
| repeated or concurrent login, one invite | one acceptance and one audit |
| concurrent revoke vs accept | only winning transition has effect; revoked invite cannot grant role |
| expired or unrelated email | no acceptance |
| onboarding valid / duplicate handle | completed marker or safe conflict; no role/state mutation |
| anonymous and arbitrary-UID invocation | denied |
| authenticated self RPC | allowed; cannot target another user |
| manager invite creation/revoke and service lookup from A2.1 | continue to work |
| A1 economic RPC and existing migration runner CI | remain green |

Open design review before final source approval: explicit-link versus latest-invite precedence and behavior when multiple valid pending invitations exist. No production config, dispatch, Nexus, or reader changes.
