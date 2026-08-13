# Reader Phase 2 — calm chrome and go-to-page v0.1

## Scope

Phase 2 changes only the Reader chrome and its controls. The regular Reader is now the calm reading experience; there is no separate, user-facing focus mode and no browser-fullscreen action.

## Toolbar

The sticky toolbar has two quiet rows. The first contains the ARTales identity and work title. The second contains reading progress, the current page (which opens a small page input), and one compact settings-menu trigger.

## Compact menu

The menu retains the existing single-bookmark create/update, go-to and clear actions. It also contains the paged-flow/spread layout choice, light/script/dark themes, text size, width and density controls, the work-detail exit, and the full-reader continuation link in preview mode.

## Go to page

Activating the page indicator exposes a numeric input. Enter confirms; Escape cancels. Numeric values outside the available range are clamped. Paged flow scrolls to the requested sheet; spread mode opens the spread containing that page (at its even zero-based start). This uses the existing `pageIndex` and `pageCount` and does not change slicing.

## Accessibility

The menu trigger is a button with `aria-expanded` and `aria-controls`. The page field has a localized accessible label and supports Enter and Escape. Closed controls are removed from the DOM, so they cannot retain keyboard focus. The menu does not trap focus and closes on an outside pointer action.

## Not changed

Parser behavior, slicing, work/editor content, media, entitlement/access, bookmark data, notes, account reading preferences, DB, environment and other site surfaces are unchanged. Notes/multiple bookmarks and account simple/advanced settings remain future work.

## Develop preview checklist

- Open full and preview Readers in paged flow; confirm calm two-row chrome, progress and page indicator.
- Jump to valid, low and high page numbers in paged flow and spread; test Enter and Escape.
- Open/close the menu by keyboard and pointer; test layout, theme, font, width and density.
- Create, update, visit and clear the existing bookmark.
- Test preview continuation and leave-reader links.
- Confirm no focus-mode/fullscreen wording or action is visible.
- Check desktop and narrow mobile widths for wrapping, unobscured content and horizontal overflow.
- Confirm work detail and account/member/internal surfaces are visually unchanged.

## Rollback

Revert the Phase 2 commit/PR. Reader settings and saved progress/bookmarks require no migration or data rollback; the compatibility-normalized settings remain readable by the previous Reader.
