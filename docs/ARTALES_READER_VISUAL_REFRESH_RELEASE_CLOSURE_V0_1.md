# ARTales Reader visual refresh release closure v0.1

## 1. Summary

The Reader visual refresh has been completed in `develop`. This document is a
production decision note and release-closure record; it makes no runtime
change. The recommended next step is to promote `develop` to `main` after this
closure document is merged, unless review identifies a new blocker. The
promotion remains a separate, explicitly approved production action.

## 2. Included PRs

The closure covers the complete Reader visual-refresh sequence:

- **PR #107 — Reader visual/token audit:** documented the existing visual
  system and migration boundary.
- **PR #108 — Reader semantic token proposal:** defined the proposed semantic
  token model.
- **PR #109 — Reader semantic aliases:** introduced the Reader semantic
  aliases.
- **PR #110 — Safe selector consumption:** moved approved selectors onto the
  semantic aliases without changing Reader behavior.
- **PR #111 — Reader palette mapping preview:** mapped and previewed the Reader
  palette across its supported visual states.
- **PR #112 — Comfort softening:** softened the Reader colors for calmer
  long-form reading.
- **PR #113 — Controls/access polish:** refined Reader controls and access or
  preview calls to action.
- **PR #114 — Long-form content QA:** reviewed and aligned Reader-scoped
  long-form content presentation.
- **PR #115 — Mobile/final QA:** added responsive safety polish and recorded the
  final mobile QA boundary.
- **PR #116 — Reader runtime brand mark alignment:** replaced the legacy Reader
  toolbar composition with the approved runtime ARTales lockup.

## 3. Scope included

The completed release scope includes:

- Reader palette;
- Reader semantic tokens;
- Reader controls;
- Reader access and preview CTA styling;
- Reader-scoped long-form content overrides;
- Reader mobile and responsive safety polish;
- Reader toolbar runtime brand lockup alignment;
- supporting documentation and checklists.

## 4. Explicit non-scope

This release closure does not include or approve changes to:

- parser or pagination behavior;
- Reader settings persistence;
- access or entitlement logic;
- the public homepage, gallery, or work-detail design;
- shared renderer global styling;
- databases, environment configuration, or Supabase;
- packages or dependencies;
- brand masters or source-export changes;
- logo recreation or regeneration.

## 5. Manual review notes

- The desktop Reader appears acceptable in manual review.
- Reader colors are softer following PR #112.
- Controls and access polish are subtle by design.
- PR #116 replaced the old Reader mark, and the approved runtime lockup is now
  visible in `develop`.
- Mobile could not be fully checked before production and requires an immediate
  production smoke check after promotion.

## 6. Brand mark alignment result

The Reader previously used an old or legacy mark composition. PR #116 switched
the Reader toolbar to the approved runtime lockup through
`ArtalesBrand mode="lockup"`.

The approved runtime assets are:

- `public/brand/artales-logo-primary-light.svg`;
- `public/brand/artales-logo-primary-dark.svg`.

The runtime SVG files were verified byte-for-byte against the approved exports.
No brand master, source export, or generated artwork was modified. No logo was
recreated, simplified, redrawn, or regenerated.

## 7. Production promotion recommendation

Promote `develop` to `main` after this closure document is merged, unless a new
blocker is found. Smoke-check mobile immediately after the production
deployment. If mobile has blocking overlap or control-reachability issues,
prepare a small, focused production patch. If the Reader is broadly broken,
revert the `develop` to `main` promotion.

This recommendation records readiness; the production promotion remains a
separate action requiring explicit approval and must not be performed by this
documentation-only PR.

## 8. Post-production smoke checklist

- [ ] Homepage still appears and functions as expected.
- [ ] Public header still appears and functions as expected.
- [ ] Favicon and browser tab icon remain correct.
- [ ] Reader opens successfully.
- [ ] Reader toolbar shows the approved ARTales runtime lockup.
- [ ] Reader light, script, and dark themes render correctly.
- [ ] Reader preview mode works.
- [ ] Reader full mode works, if available to the tester.
- [ ] Settings open and close correctly.
- [ ] Toolbar controls remain reachable.
- [ ] Reading progress is visible.
- [ ] Bookmark control and marker are visible.
- [ ] Long-form content remains readable.
- [ ] Reader receives a quick mobile check at 320px and 360px.
- [ ] Global light theme with Reader dark theme renders correctly.
- [ ] Global dark theme with Reader light theme renders correctly.

## 9. Rollback

- Revert the `develop` to `main` promotion if the Reader is broadly broken.
- Prefer a small production patch for minor mobile spacing or control issues.
- No database, environment, or package rollback is expected.
- Brand mark alignment can be rolled back by reverting PR #116 only, but this
  should not be used unless the runtime lockup breaks the layout.

After any rollback or patch, repeat the relevant Reader, homepage, public-header,
and mobile smoke checks.

## 10. Next-wave backlog

- Mobile refinements informed by the real-device production check.
- Account, member, and internal visual migration.
- Possible tooling for visual route and asset checks.
- Later cleanup of legacy brand composition where it is still used outside the
  Reader or public header, if any.
- A longer reading-session comfort review.

## Delivery metadata

- **Changed files:**
  `docs/ARTALES_READER_VISUAL_REFRESH_RELEASE_CLOSURE_V0_1.md` records the
  release closure, production recommendation, caveats, rollback, and follow-up
  work.
- **Risk:** `low`; this is a documentation-only decision record with no runtime
  impact.
- **Target:** `production safe`; this label records the reviewed Reader release
  sequence as ready for a separately approved promotion after this document is
  merged.
- **DB:** `no`.
- **Env:** `no`.
- **Rollback notes:** revert this documentation commit to remove the closure
  record. No runtime, data, asset, package, or environment rollback is required
  for this PR itself.

## Documentation validation checklist

- [x] The full PR #107 through PR #116 sequence is recorded.
- [x] PR #116 runtime brand mark alignment and asset provenance are recorded.
- [x] The production recommendation and mobile smoke caveat are explicit.
- [x] Runtime and operational non-scope is explicit.
- [x] Only documentation is changed.
- [x] No app, CSS, component, route, i18n, public or brand asset, database,
  environment, Supabase, or package file is changed.
- [x] `git diff --check` passes before commit.
