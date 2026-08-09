# ARTales Reader mobile page/spread overflow fix v0.1

## Status and release scope

- **Target:** `develop first`; the change must be checked in the develop preview and is not approved for `main` by this document.
- **Risk:** high. The runtime change is CSS-only, but it affects the Reader, which is a critical reading path.
- **DB:** no.
- **Env:** no.

This follow-up fixes unreadable or unreachable prose in page and spread modes on phones and other narrow viewports. It follows the separate Reader content-block typography polish and does not extend the rebrand.

## Layout audit and root cause

`ReaderClient` applies the root mode classes `.artales-reader--layout-scroll`, `.artales-reader--layout-page`, and `.artales-reader--layout-spread` to `.artales-reader`. The layout surface is `.artales-reader__stage`; its sheet is `.artales-reader__paper`. Paged sheets additionally use `.artales-reader__paper--paged`, `.artales-reader__page-header`, `.artales-reader__page-content`, and `.artales-reader__page-footer`. A double page is wrapped by `.artales-reader__spread`, with `.artales-reader__paper--spread-left` and `.artales-reader__paper--spread-right`. Rendered prose is rooted at `.artales-work-content` inside the paper.

Paged sheets had a fixed A-series `aspect-ratio`, a constrained grid content row, and `overflow: hidden`. On a narrow sheet, responsive padding and a high font scale reduced the usable measure and increased the rendered height, but the estimated page slice could not make the CSS sheet taller. The excess prose was therefore clipped. Spread mode changed to a block below 980 px and hid the right sheet, even though navigation still advanced through the two-page spread; that made the second page unreachable. Content blocks also needed a consistent minimum-width and wrapping boundary inside the paper.

There is no content transform or scale in the steady page layout. Page-turn transforms are animation-only. The fix therefore does not add scaling and does not change the paginator.

## Changed selectors and behavior

### Shared Reader containment

The stage, paper, page content, Reader-scoped `.artales-work-content`, and relevant prose blocks now use border-box sizing, `max-width: 100%`, and `min-width: 0`. Paragraphs, list items, quotations, and letter metadata can wrap anywhere as a last resort and use automatic hyphenation. This keeps long words and high font scales within the readable measure without hiding prose.

These rules are scoped beneath Reader classes. The shared work-renderer stylesheet and public work detail are unchanged.

### Mobile single-page mode

At 720 px and below, paged sheets use the available stage width with safe 10 px outer gutters and responsive 16–28 px inner padding. The fixed aspect ratio and constrained content row become a content-sized three-row sheet. Both the sheet and content area allow vertical growth, so an underestimated slice continues down the paper rather than being clipped. A stable minimum height retains the page silhouette and avoids short-page jumps.

### Mobile/narrow spread mode

At 980 px and below, the selected two-page spread stacks vertically in reading order. Both sheets remain rendered and reachable, and navigation continues to advance by the existing two-page step. This is less risky than adding viewport state to `ReaderClient`: the stored `spread` choice, progress, bookmark page, labels, and desktop behavior remain intact.

The stacked sheets use independent borders, rounded corners, a responsive gap, content-sized height, and no book-hinge transform. At 720 px and below they receive the same safe gutters and padding as single-page mode. The blank terminal sheet remains decorative; normal second-page prose is never hidden.

### Font scale and content blocks

The existing 85%–130% scale range and pagination budget remain unchanged. At every scale, the narrow sheet can grow vertically and prose can wrap horizontally. Notes, inline and collected footnotes, letters, prefaces, quotations, and normal paragraphs inherit the containment safeguards. Note indentation is removed at narrow width to preserve measure.

Newspaper/article content is explicitly one column at 720 px and below. The earlier Reader typography rules still use left alignment at the narrowest breakpoint to avoid extreme justified spacing; this fix restores automatic hyphenation and adds emergency wrapping so long tokens cannot widen the paper.

## Desktop and theme preservation

Above the responsive thresholds, page mode keeps its existing paper widths and A-series ratio, while spread mode keeps two adjacent desktop sheets. Scroll mode receives only non-visual containment safeguards. The light, script, and dark theme tokens, shadows, surfaces, and typography remain unchanged. No new color or asset was introduced.

## Intentionally unchanged

- Parser behavior, work content model, block mapping, editor behavior, or page-slicing logic.
- Reader mode names, settings persistence, font-scale bounds, progress, bookmarks, access, or entitlement.
- Tables and the cancelled table-pagination/generated-header patch.
- Media upload, Supabase, DB, environment variables, packages, or brand assets.
- Public homepage, gallery, work detail, account, member, or internal styling.
- Promotion or merge to `main`.

## Develop preview checklist

- [ ] Mobile/narrow viewport in Reader light theme.
- [ ] Mobile/narrow viewport in Reader script theme.
- [ ] Mobile/narrow viewport in Reader dark theme.
- [ ] Scroll mode on mobile.
- [ ] Single-page mode on mobile; short and long slices remain inside the paper.
- [ ] Spread mode on mobile; both pages stack and remain reachable.
- [ ] Page mode on desktop remains a single sheet.
- [ ] Spread mode on desktop remains a two-page book spread.
- [ ] Font scale 85%, 100%, 130%, and the largest available value (currently 130%).
- [ ] Normal and justified paragraphs, including an unbroken long token.
- [ ] Note, inline footnote, collected footnotes, letter, and preface blocks.
- [ ] Long newspaper/article block is one column on mobile.
- [ ] No horizontal prose clipping or unreachable text outside a page.
- [ ] No horizontal scrolling is needed for normal reading.
- [ ] Page navigation, progress, bookmark restoration, and stored spread selection still work.
- [ ] Public work detail is unchanged.
- [ ] Account, member, and internal pages are unchanged.

## Validation

- [ ] `git diff --check`.
- [ ] CSS parses through the project build/lint toolchain.
- [ ] No circular CSS variable references.
- [ ] Changed-file audit contains no DB, env, package, asset, parser, editor, media, access, public, account, or internal changes.
- [ ] Develop preview checklist completed manually at representative phone and desktop widths.

## Rollback path

Revert the single mobile overflow-fix commit. No data, schema, environment, dependency, or asset rollback is required. After reverting, smoke-test scroll, page, and spread modes in all three Reader themes and confirm settings/progress persistence. The prior content-block typography polish remains independently revertible.
