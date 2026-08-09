# ARTales Reader reading-mode header overlap fix v0.1

> **Follow-up:** `ARTALES_READER_FOCUS_MODE_CHROME_SIMPLIFICATION_V0_1.md` subsequently removes bookmark and settings chrome from focus mode. The sticky, in-flow page/spread toolbar treatment documented here remains the layout safeguard for the smaller focus toolbar; no pagination or page sizing behavior changes.

## Status and release scope

- **Target:** `develop first`; this focused fix is intended for develop preview and is not approved for automatic promotion to `main`.
- **Risk:** high. The implementation is CSS-only and narrowly scoped, but Reader is a critical reading path.
- **DB:** no.
- **Env:** no.

## Production feedback and affected states

Production feedback confirms that wrapping, responsiveness, normal Reader behavior, single-page mode, and double-page mode are otherwise working as intended. The remaining defect appears only in reading/focus mode (`.artales-reader--focus`) when combined with page (`.artales-reader--layout-page`) or spread (`.artales-reader--layout-spread`) layout. The first page can begin underneath the chrome containing the ARTales/title row, progress, bookmark actions, focus exit, and settings controls. Reading-mode scroll (`.artales-reader--layout-scroll`) is not affected.

The audited structure is the `.artales-reader` root, its direct `.artales-reader-toolbar`, and the following `.artales-reader__stage`. Single-page paper uses `.artales-reader__paper--paged`; a spread uses `.artales-reader__spread` with left and right paged papers.

## Root cause

Focus mode changes the toolbar from its normal sticky positioning to `position: fixed`. A fixed toolbar leaves document flow, while the page/spread stage reserved only a fixed responsive top padding (including later mobile overrides). That estimate did not represent the toolbar's real height when actions wrapped or when bookmark and settings controls expanded. The centered page/spread stage could therefore move upward behind the fixed chrome.

## Chosen layout fix

For the intersection of focus mode and page/spread mode, `.artales-reader-toolbar` now uses `position: sticky`. Sticky positioning preserves the existing top chrome behavior while keeping the toolbar's actual, dynamic height in document flow. The following stage therefore always begins after the complete visible toolbar, including wrapped bookmark actions and an expanded settings panel.

The old focus-mode padding estimate is replaced, only for page/spread, by the normal paged-stage spacing: a responsive 18–34 px desktop/tablet gap and the established 14 px narrow-screen gap. This is spacing between chrome and paper, not a substitute for chrome height.

## Mode and viewport behavior

### Continuous mode

Scroll mode is intentionally excluded from both selectors. Its established focus-mode fixed toolbar and visual layout remain unchanged.

### Page mode

The single paged paper starts after the in-flow toolbar in reading mode. Collapsed, wrapped, bookmark-expanded, and settings-expanded chrome heights are accounted for by layout rather than a guessed offset. Paper sizing, content overflow safeguards, navigation, and page slicing are unchanged.

### Spread mode

The spread starts after the same in-flow toolbar. Desktop retains the two-sheet book layout; narrow screens retain the previously released stacked spread and containment rules. No spread widths, page steps, or responsive paper behavior are changed.

### Mobile and desktop

On desktop and tablet, the existing responsive paged gap is restored below the dynamically sized toolbar. At 560 px and below, the existing 14 px stage gap is used. Because the toolbar itself reserves its full rendered height, safe-area padding, action wrapping, bookmark state, and expanded settings do not require device-specific height constants. The change introduces no width, overflow, or prose clipping rule.

## Intentionally unchanged

- Normal, non-focus Reader scroll, page, and spread layout.
- Parser behavior, pagination budgets, page slicing, work content model, and editor blocks.
- Reader settings persistence, bookmark behavior, progress behavior, exit actions, access, and entitlement.
- Mobile page/spread containment and desktop spread dimensions.
- Public homepage, gallery, work detail, account, member, and internal styling.
- Media upload, Supabase, DB, environment variables, packages, and brand assets.
- The cancelled table-pagination/generated-header patch.
- Promotion or merge to `main`.

## UX follow-up

A later, separately scoped Reader change may simplify reading-mode chrome. This fix does not redesign, hide, relabel, or remove any chrome or control.

## Develop preview checklist

- [ ] Normal Reader mode: scroll.
- [ ] Normal Reader mode: page.
- [ ] Normal Reader mode: spread.
- [ ] Reading mode: scroll remains visually unchanged.
- [ ] Reading mode: page.
- [ ] Reading mode: spread.
- [ ] Reading-mode page on mobile/narrow viewport.
- [ ] Reading-mode spread on mobile/narrow viewport; both stacked sheets remain reachable.
- [ ] Reading-mode page on desktop.
- [ ] Reading-mode spread on desktop remains a two-page book.
- [ ] Bookmark controls collapsed/no saved bookmark.
- [ ] Bookmark actions expanded/saved bookmark.
- [ ] Settings collapsed.
- [ ] Settings expanded.
- [ ] Progress bar remains visible.
- [ ] Exit reading mode works.
- [ ] No text is hidden behind the header in page or spread mode.
- [ ] No horizontal prose overflow.
- [ ] Public work detail is unchanged.
- [ ] Account, member, and internal pages are unchanged.

## Validation

- [ ] `git diff --check` passes.
- [ ] CSS parses through the project toolchain.
- [ ] No circular CSS variable references are introduced (this patch adds no variable).
- [ ] Changed-file audit contains no DB, env, package, asset, parser, pagination, settings, bookmark, access, public, account, or internal changes.
- [ ] Preview checklist is completed at representative phone and desktop widths.

## Rollback path

Revert the single reading-mode header-overlap commit. No data, schema, environment, dependency, asset, or persisted-setting rollback is needed. After reverting, smoke-test focus-mode scroll, page, and spread plus settings and bookmark expansion. The earlier mobile page/spread overflow fix remains independent.
