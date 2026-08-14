# ARTales main release protocol v0.1

## Purpose and scope

This protocol applies to every pull request that promotes `develop` to `main` for a production deployment. The production release decision remains explicit and separate from approval of the develop preview.

The deployment marker at `public/version.json` lets an already-running browser tab or installed app discover that a newer deployment is available. A changed marker shows the existing update banner and leaves the user in control of refreshing. The marker is a release signal, not an application-data migration.

## Production promotion protocol

For every `develop` → `main` production promotion pull request:

1. Decide explicitly whether stale or open clients should see the update banner.
2. If they should, bump `public/version.json` in the promotion pull request itself.
3. State the marker bump in the pull request description.
4. If the marker is intentionally unchanged, state the reason in the pull request description.

A marker bump must not be accompanied by clearing `localStorage`, clearing Reader progress, bookmarks, or settings, or forcing users to log out. Those actions are not part of the release protocol.

## Recommended marker format

Keep the marker unique and human-readable. Prefer either:

- a UTC date/time-based marker, for example `2026-08-14T10-18-main`; or
- a date plus release label, for example `2026-08-14-reader-phase-3`.

Use a concise label that identifies the production release. Do not encode secrets or environment-specific configuration in the marker.

## Exception rule

Not every production promotion needs to notify stale clients, but skipping the bump must be a deliberate, documented decision.

The marker should normally be bumped for public runtime, Reader, or user-interface changes. A docs-only or internal-only release with no user-facing runtime change may leave the marker unchanged when the promotion pull request gives the reason.

## Promotion pull request checklist

No repository pull request template currently exists, so every `develop` → `main` promotion pull request must include this checklist item in its description:

- [ ] For `develop` → `main` promotion: `public/version.json` bumped, or intentionally not bumped with reason.

When checked, the accompanying pull request text should identify the new marker or record the skip reason.

## Future automation

CI could later verify that pull requests targeting `main` either modify `public/version.json` or include an explicit skip marker and reason. This protocol does not add that automation; any CI enforcement should be designed and reviewed separately.

## Rollback

If this documentation convention needs to be withdrawn, revert the commit that introduced this protocol and remove its cross-reference from the PWA update-hygiene document. No runtime, database, environment, Supabase, Reader state, or user-data rollback is required.

**Risk:** low — documentation and release-process convention only.

**Target:** develop first.

**DB:** no.

**Env:** no.
