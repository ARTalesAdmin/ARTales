# Reader Phase 2 — calm chrome and go-to-page v0.1

## Scope

Phase 2 changes only the Reader chrome and its controls. The regular Reader is now the calm reading experience; there is no separate, user-facing focus mode and no browser-fullscreen action.

## Toolbar

The sticky toolbar has two quiet rows. The first contains the ARTales identity and work title. The second contains reading progress, the current page (which opens a small page input), and one compact settings-menu trigger.

## Compact menu

The menu retains the existing single-bookmark create/update, go-to and clear actions. It also contains the paged-flow/spread layout choice, light/script/dark themes, text size, width and density controls, the work-detail exit, and the full-reader continuation link in preview mode.

## Go to page

Activating the page indicator exposes a numeric input. Enter confirms immediately;
moving focus away confirms a valid value so the control also works with a mouse.
Escape cancels and suppresses confirmation from the resulting blur. Empty or
non-finite input resets to the current page without navigating. Numeric values
outside the available range are clamped and decimals are truncated consistently.
Paged flow scrolls to the requested sheet; spread mode opens the spread containing
that page (at its even zero-based start). This uses the existing `pageIndex` and
`pageCount` and does not change slicing or target-page computation.

## Accessibility

The menu trigger is a button with `aria-expanded` and `aria-controls`. The page field has a localized accessible label and supports Enter and Escape. Closed controls are removed from the DOM, so they cannot retain keyboard focus. The menu does not trap focus and closes on an outside pointer action.

## Not changed

Parser behavior, slicing, work/editor content, media, entitlement/access, bookmark data, notes, account reading preferences, DB, environment and other site surfaces are unchanged. Notes/multiple bookmarks and account simple/advanced settings remain future work.

## Develop preview checklist

- Open full and preview Readers in paged flow; confirm calm two-row chrome, progress and page indicator.
- Jump to valid, low, high and decimal page numbers in paged flow and spread;
  test Enter, mouse blur and Escape followed by blur.
- With the mouse, use the number stepper and click away; confirm the selected page
  opens. Click away from empty/non-finite input and confirm it resets without a jump.
- Open/close the menu by keyboard and pointer; test layout, theme, font, width and density.
- Create, update, visit and clear the existing bookmark.
- Test preview continuation and leave-reader links.
- Confirm no focus-mode/fullscreen wording or action is visible.
- Check desktop and narrow mobile widths for wrapping, unobscured content and horizontal overflow.
- Confirm work detail and account/member/internal surfaces are visually unchanged.

## Rollback

Revert the Phase 2 commit/PR. Reader settings and saved progress/bookmarks require no migration or data rollback; the compatibility-normalized settings remain readable by the previous Reader.

## Phase 1 + 2 stabilization note

The focused stabilization pass is recorded in
`ARTALES_READER_PHASE_1_2_STABILIZATION_V0_1.md`. It hardens complete-value
page input validation and Escape behavior, and restores focus to the compact
menu trigger when that menu closes with Escape. It does not redesign the
toolbar or change page slicing. Production promotion remains a separate,
explicitly approved step after the `develop` preview smoke test.

## Phase 3 follow-up

Phase 3 adds account simple/advanced reading preferences. The compact menu now
shows typography controls only after the reader enables them; layout, theme,
bookmark actions, preview continuation, and exit remain available. The
notes/bookmarks redesign remains future work. Layout and advanced-control
visibility remain device-local, so cross-device sync is also future work.

## Phase 4 follow-up

Phase 4 replaces the single-bookmark menu surface with **Poznámky**. Notes support multiple positions, jump/delete, local fallback and signed-in account sync behind owner-only RLS. Calm chrome, go-to-page, restore, pagedFlow and spread remain unchanged; the legacy bookmark key is retained after import.
