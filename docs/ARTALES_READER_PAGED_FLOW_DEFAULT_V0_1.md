# ARTales Reader — paged-flow default v0.1

## Status and basis

This is Phase 1 of the Reader redesign audited in PR #145 and in
`ARTALES_READER_MODE_CHROME_NOTES_REDESIGN_AUDIT_V0_1.md`. It targets the
`develop` preview first. It does not authorize promotion to `main`.

**Risk:** medium  
**Target:** develop first  
**DB:** no  
**Env:** no

## Mode model

The former user-facing model offered `scroll`, `page`, and `spread`. The new
model offers exactly two choices:

- `pagedFlow` (default): existing sliced page sheets rendered sequentially in a
  continuous vertical document;
- `spread`: the existing two-sheet desktop view and its safe narrow-screen
  stacked fallback.

The canonical setting values are now `pagedFlow | spread`. Settings are
normalized on read: legacy `scroll` and `page` values become `pagedFlow`,
legacy `spread` remains `spread`, and missing or invalid values use
`pagedFlow`. The storage key is unchanged and legacy progress/bookmark mode
strings remain accepted so rollback and old records stay readable.

## Rendering and progress

Paged flow reuses `paginateReaderBlocks`; it does not alter the parser, content
blocks, or slicing algorithm. Every resulting `ReaderPage` is rendered with the
existing page header, content, footer, typography, and containment rules in a
single vertical grid. A viewport reading line at 35% selects the latest sheet
whose top has crossed that line. That page index drives the toolbar, bookmark,
and the unchanged progress record schema. Scroll and resize updates are grouped
with `requestAnimationFrame`.

Resume uses a stored `pageIndex` when present. A legacy scroll-only progress
record falls back to its stored percentage mapped onto the current page count.
Paged-flow resume and bookmark navigation scroll the selected sheet into view.
Spread retains even-index normalization, two-page stepping, keyboard/side
navigation, desktop pairing, and narrow stacked rendering.

## Changed files

- `lib/reader/readerSettings.ts`: canonical modes, default, legacy mapping.
- `lib/reader/readerStorage.ts`: persisted type compatibility.
- `components/reader/ReaderClient.tsx`: sequential sheets, active-sheet
  tracking, restore and bookmarks.
- `components/reader/ReaderToolbar.tsx`: two visible choices and labels.
- `components/reader/reader.css`: paged-flow selectors and vertical sheet grid.
- `docs/ARTALES_READER_MODE_CHROME_NOTES_REDESIGN_AUDIT_V0_1.md`: phase note.
- this implementation note.

## Intentionally unchanged

No parser, page slicer, work model, editor, media, access/entitlement,
bookmark schema, notes model, account setting, database, environment, package,
asset, or non-Reader public/internal styling was changed. Focus mode and the
existing toolbar structure remain as-is. Compact chrome, go-to-page, and
notes/bookmarks redesign remain follow-up work.

## Develop preview checklist

- [ ] Empty/default localStorage opens in paged flow.
- [ ] Stored `scroll` and `page` settings open in paged flow.
- [ ] Stored `spread` remains spread.
- [ ] All page sheets appear sequentially and scroll continuously.
- [ ] No horizontal overflow, clipped text, or unreachable content.
- [ ] Typography and notes/footnotes/letters/prefaces/newspaper blocks render.
- [ ] Desktop spread shows two adjacent sheets.
- [ ] Narrow spread stacks safely and both sheets remain reachable.
- [ ] Switching between both toolbar choices works.
- [ ] Progress and bookmark save/restore work in both modes.
- [ ] Focus behavior is unchanged.
- [ ] Work detail and account/member/internal pages are unchanged.

## Rollback

Revert this Phase 1 commit. The old settings implementation can still read the
unchanged localStorage key; `spread` remains identical, while an old build will
fall back safely when it encounters the new `pagedFlow` value. Do not delete or
rewrite user storage during rollback. Recheck open, resume, bookmark, desktop
spread, and narrow spread after reverting.
