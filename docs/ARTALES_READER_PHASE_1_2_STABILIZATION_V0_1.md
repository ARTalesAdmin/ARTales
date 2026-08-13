# ARTales Reader — Phase 1 + 2 stabilization v0.1

## Status and scope

This is a focused pre-production audit of Reader Phase 1 (paged-flow default)
and Phase 2 (calm chrome, compact menu, and go-to-page). It targets the
`develop` preview first and does not authorize or perform a promotion to
`main`.

**Risk:** high — the Reader is a critical user path, although the fixes are
small and isolated.

**Target:** develop first

**DB:** no

**Env:** no

## Checked

- Default and compatibility settings: a missing, `scroll`, or `page` layout
  opens `pagedFlow`; `spread` remains `spread`; the new `pagedFlow` value and
  the unchanged storage key remain safe for rollback.
- Rendering: paged flow still renders existing slices sequentially; spread
  still preserves two-sheet pairing, even-index alignment, two-page movement,
  keyboard navigation, and the narrow-screen stack.
- Progress: full-reader save and restore use `pageIndex` when available and
  retain percentage fallback for legacy records. Preview does not save full
  reading progress.
- Single bookmark: create/update, go-to, clear, legacy `scrollY` fallback, and
  current `pageIndex` records remain supported without a schema change.
- Go-to-page: Enter confirms, Escape cancels, empty/non-numeric input is
  rejected, finite out-of-range input is clamped, decimals are normalized to
  an integer, first/last sheets are reachable, spread targets the containing
  spread, and paged flow scrolls the selected sheet into view.
- Compact menu: semantic trigger state, outside-click and Escape closing,
  closed-control removal from the DOM, theme/font/width/density/layout
  controls, bookmark actions, preview continuation, and leave-reader links.
- Layout: existing desktop and narrow responsive rules were reviewed for
  toolbar/content overlap, horizontal overflow, title truncation, control
  space, progress legibility, page indicator legibility, and menu viewport
  containment. No further cosmetic redesign was needed.
- Full and preview branches were checked in the component paths. Parser,
  page slicing, work/editor models, access, media, account settings, and all
  unrelated site styling remain untouched.

## Small fixes made

1. Full-reader progress saving now waits until the initial storage restore has
   been attempted. This prevents the first render at page one from briefly
   replacing an existing saved position before its restored page is applied.
2. Go-to-page parsing now validates the complete input rather than accepting a
   numeric prefix, rejects empty/non-finite values safely, and normalizes
   finite decimal input before clamping to `1..pageCount`.
3. Escape in the page field cancels only page entry instead of also bubbling to
   the compact menu's Escape listener. Escape used to close the compact menu
   now returns keyboard focus to its trigger.

No CSS change was required by this pass.

## Known limitations

- Validation here is code-level and automated. Device/browser behavior,
  actual long works, and preview/full entitlement transitions still require
  the develop-preview smoke test below.
- The Reader intentionally retains one local bookmark per work. It does not
  add multiple bookmarks, notes management, or cross-device synchronization.
- Page numbers refer to existing generated slices. Changes in typography,
  width, or density can repaginate a work; this pass does not redesign how a
  saved index maps across a changed page count.
- Narrow spread remains the existing stacked fallback, not a new mobile mode.

## Production smoke checklist

Run this checklist on the `develop` preview before any separately approved
production promotion:

- [ ] With empty storage, open preview and full Readers; confirm paged flow.
- [ ] Repeat with stored `scroll`, `page`, `spread`, and `pagedFlow` settings.
- [ ] In full mode, move away from page one, reload, and confirm restoration in
      paged flow and spread.
- [ ] Create/update, visit, and clear a bookmark in both layouts; also verify a
      pre-existing single-bookmark record.
- [ ] Go to page 1, the last page, zero, a value above the page count, an empty
      value, text/pasted invalid input, and a decimal. Test Enter and Escape.
- [ ] In spread, confirm odd page requests open the spread containing that
      page. In paged flow, confirm the requested sheet scrolls into view and
      the toolbar count matches its sheet header/footer.
- [ ] Open and close the compact menu by pointer, outside click, and Escape;
      tab through it while open and confirm its controls cannot be reached
      after closing.
- [ ] Exercise layout, theme, font size, width, and density; confirm the menu
      remains usable and the work stays readable.
- [ ] In preview, use Continue reading from both menu and end CTA. In full and
      preview, use Leave reader.
- [ ] Check a short and long work at desktop, tablet, narrow phone, and browser
      zoom widths for toolbar overlap, horizontal overflow, title truncation,
      legible progress/page state, and reachable content.
- [ ] Confirm public work detail and gallery plus account/member/internal pages
      are unchanged.

## Rollback path

Revert the stabilization commit/PR only. No DB, environment, package, asset,
or storage migration needs reversal. Do not clear or rewrite localStorage:
the existing key and record shapes are unchanged, legacy `scroll`/`page`
values remain tolerated by the Phase 1 normalizer, `spread` remains stable,
and an older build safely falls back when reading `pagedFlow`. After revert,
smoke-test full-reader resume, first/last go-to-page, spread alignment, compact
menu closing, and bookmark create/go/clear.

## Future work (not part of this stabilization)

- account-level simple/advanced Reader settings;
- notes and bookmarks redesign;
- separate cosmetic polish after functional preview feedback.
