# ARTales identity authority — security release block for Snapshot PR #278

Date: 2026-10-28. Source-only Draft PR, base `main`, separate approval required.

## Verified live (read-only) issue
- `authenticated` can UPDATE/INSERT the `role` and `is_active` fields of
  `public.profiles`. Existing RLS allows self-updates on `id=auth.uid()`
  without restricting privilege-bearing column changes.
- Active `auth.users` trigger `zz_artales_profile_sync_v081` falls back to
  untrusted `raw_user_meta_data.role` when no trusted invitation exists.
- Existing authenticated invite UPDATE grants allow edits to invitation fields.
  Only server-verified roles must be authoritative, and existing editor/admin
  revocation via `status=revoked` must remain functional.
- No production data was modified to demonstrate these cases.

## Proposed source-only mitigation
- Revoke browser INSERT and DELETE on `profiles`; restrict UPDATE to safe
  profile display/preferences columns. Keep service-role synchronization.
- Remove the permissive own-profile INSERT policy.
- Revise the active auth trigger to assign `reader` without a valid pending
  database invitation, ignoring client-provided `role` metadata.
- Limit authenticated invitation UPDATE to `status=revoked` on pending
  invitations by authorized managers. Leave service-role acceptance intact.
- Independent NOBYPASSRLS identities prove reject/allow boundaries and
  signup with malicious metadata; preserve normal onboarding and revocation.

## Dependencies / approval
1. Verify exact `main`, CI PASS, and current production permissions.
2. Require explicit Architect approval for merge and production APPLY.
3. Production migration requires separate grant/privilege authorization.
4. Test real signup and invite flows with approved synthetic users only;
   no user role modifications or real customer data in a pilot.
5. Confirm independent Snapshot PR #278 remains OFF until identity gate passes.
6. After activation, review existing privileged profile and invite history
   for anomalous assignments; do not revoke users without an approved procedure.

## Out of scope
General invite-token enumeration/visibility review, unrelated security
advisors, metadata normalization beyond role, publication, data deletion.
