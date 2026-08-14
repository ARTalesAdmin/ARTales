# Reader Phase 3 — account reading preferences v0.1

## Current preference ownership audit

- **Route:** `/account/settings`.
- **Components:** `app/account/settings/page.tsx`, the client-side
  `ReaderPreferencesForm`, and the existing account navigation/layout.
- **Account storage:** `preferred_locale`, `reader_theme`, `reader_width`,
  `reader_density`, and `reader_font_scale` already persist on the existing
  `profiles` record through `updateReaderPreferences`. Phase 3 adds no schema or
  Supabase policy.
- **Device storage:** the Reader reads and writes `artales.reader.settings` in
  localStorage. The account form writes Reader defaults there before saving the
  profile-backed subset.
- **Limitation:** `layoutMode` and `showAdvancedReaderControls` have no existing
  profile fields and remain device-local. Cross-device sync for them is future
  work and is not promised by the UI.

## Simple and advanced settings

The always-visible simple section offers light, script/warm-paper, and dark
themes plus `pagedFlow` or `spread`; `pagedFlow` remains the safe default. A
native keyboard-accessible disclosure separates text size, reading width, line
density, and **show advanced controls in the Reader**. The latter defaults to
`false`. Bookmark preferences are not added because the single-bookmark model
is outside Phase 3.

## Reader compact menu

Layout, theme, bookmark actions, preview continuation, and leaving the Reader
remain available. Text size, width, and density render only when advanced
controls are enabled. Hidden controls are therefore not keyboard-focusable;
their underlying settings and update handlers remain intact.

## Storage compatibility

Normalization tolerates old or partial settings. A missing advanced-controls
value becomes `false`; reads do not clear or eagerly rewrite storage. Existing
keys remain readable:

- `artales.reader.settings`
- `artales.reader.progress:<slug>`
- `artales.reader.bookmark:<slug>`
- `artales.reader.savedWorks`

There is no data migration. An older Reader safely ignores the extra JSON field.

## Not changed

Parser behavior, page slicing, work/editor blocks, media, access/entitlement,
packages, environment, DB schema, public surfaces, progress restoration,
go-to-page, and notes/bookmarks data are unchanged. Notes and multiple-bookmark
design remain future work.

## Develop preview checklist

- [ ] Open `/account/settings` in Czech and English; verify simple settings and the advanced disclosure.
- [ ] Save every theme and both layouts; open a subsequent Reader and verify its defaults.
- [ ] Disable advanced controls; verify text size, width, and density are absent from the compact menu.
- [ ] Enable advanced controls; verify all three controls appear and still work.
- [ ] Verify keyboard operation and that hidden controls cannot receive focus.
- [ ] Verify bookmark create/update/go-to/clear and go-to-page are unchanged.
- [ ] Verify progress restore, `pagedFlow`, and `spread` on desktop and mobile.
- [ ] Verify preview continuation and leave-reader links remain present.
- [ ] Verify unrelated public, account, and member pages are unchanged.

## Rollback

Revert the Phase 3 commit/PR. No DB, environment, or storage rollback is needed.
Established settings/progress/bookmark/saved-work keys retain their prior data.
After rollback, smoke-test Reader open, layout/theme, typography controls,
bookmark, go-to-page, and progress restoration.
