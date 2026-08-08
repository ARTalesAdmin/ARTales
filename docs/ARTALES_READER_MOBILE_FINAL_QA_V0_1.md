# ARTales Reader mobile final QA v0.1

## Status and release boundary

- **Target:** `develop first`. This pass is for the develop preview and does not promote or merge anything into `main`.
- **Risk:** medium. The runtime change is CSS-only and Reader-scoped, but the Reader is a critical user path.
- **DB:** no.
- **Env:** no.
- **Behavior:** unchanged. Reader state, settings persistence, parsing, pagination, access, and entitlement logic are untouched.

This pass follows PR #114, which aligned special long-form blocks with the Reader paper palette. The remaining review boundary is responsive Reader chrome and paper presentation before a separate production-promotion decision.

## Responsive audit

The existing `980px`, `820px`, `640px`, and `560px` layers were reviewed together with the base desktop rules and the standalone-display/safe-area layer. The final corrections add only a `360px` refinement; `320px` is covered by that same layer. No breakpoint or mature rule was removed.

States reviewed in code:

- phone widths at 320px, 360px, and common mobile sizes;
- tablet portrait and landscape, plus desktop;
- scroll, page, and spread layouts;
- focus mode and the settings panel open/closed structure;
- bookmark marker absent/present;
- page, bottom, and side navigation;
- toolbar control wrapping and long Czech/English label containment;
- font scale 85/100/130, width narrow/normal/wide, and density comfortable/compact;
- browser and standalone PWA safe-area placement.

## CSS selectors changed

All changes are in final, narrow media-query layers in `components/reader/reader.css`:

- `.artales-reader-toolbar__settings-panel`
- `.artales-reader-control-group`
- `.artales-reader-select-label` and its `select`
- `.artales-reader-toolbar__action-row > *`
- `.artales-reader__bookmark-marker`
- `.artales-reader-page-nav`
- `.artales-reader-toolbar`
- `.artales-reader-toolbar__top-actions`
- scroll and paged `.artales-reader__paper` variants
- previous/next `.artales-reader-side-nav` positions

## Issues fixed

1. The narrow settings panel now stays within the dynamic viewport after the top safe area, clips accidental horizontal overflow, and lets its established vertical scrolling remain usable.
2. Control groups, select labels, and action items can shrink and wrap long labels instead of forcing horizontal clipping. Native selects retain a bounded share of the row.
3. The mobile bookmark marker is shorter and width-bounded so it remains visible without spanning most of the reading line.
4. Mobile page navigation reserves clearance below itself for the fixed side navigation controls and the bottom safe area.
5. At 360px and below, toolbar gutters, paper gutters, and page margins are slightly reduced while retaining readable text padding and 48px side-navigation targets.

## Intentionally deferred or unchanged

- No parser, pagination, content slicing, page-fit, or spread mechanics changed. Visual content-fit concerns must remain a separate sandbox task.
- No Reader state model, settings persistence, theme option, access, entitlement, or focus behavior changed.
- No global typography scale, broad line-height, color token, shared renderer, public page, i18n, asset, package, DB, environment, or Supabase change was made.
- Device/browser visual sign-off and content-specific overflow checks remain preview tasks; source inspection and automated CSS checks cannot replace physical or browser-device testing.

## Develop preview checklist

- [ ] 320px phone: light / script / dark.
- [ ] 360px phone: light / script / dark.
- [ ] Common mobile width: light / script / dark.
- [ ] Tablet portrait: light / script / dark.
- [ ] Tablet landscape smoke check.
- [ ] Desktop: light / script / dark; confirm no visual regression.
- [ ] Toolbar in default and wrapped states with Czech and English labels.
- [ ] Settings panel open/closed; scroll to every control.
- [ ] Text-size controls and native select controls.
- [ ] Focus mode; confirm the focus toggle and settings/exit path remain reachable.
- [ ] Bookmark absent/present; set, go to, clear, and marker positioning.
- [ ] Preview start/end and full Reader basics.
- [ ] Page navigation at first, middle, and last page.
- [ ] Spread navigation and disabled boundary controls.
- [ ] Scroll layout and bottom navigation clearance.
- [ ] Font scale 85 / 100 / 130.
- [ ] Width narrow / normal / wide.
- [ ] Density comfortable / compact.
- [ ] Global light + Reader dark.
- [ ] Global dark + Reader light.
- [ ] Standalone PWA with top, side, and bottom safe areas.
- [ ] Public work detail unchanged.

## Production-promotion recommendation criteria

Recommend a separate `develop -> main` promotion only after the develop preview confirms that light, script, and dark are comfortable; mobile controls and focus exit/settings paths are reachable; text, side controls, bookmark marker, and navigation do not overlap; the settings panel works at the target widths; preview and full Reader basics work; and public work detail remains unchanged. Promotion still requires explicit user approval and must not be inferred from this document or PR.

## Rollback path

Revert the single mobile final-QA commit (or remove the two `Reader mobile final QA v0.1` media-query blocks and this document). No migration, data repair, environment rollback, or asset cleanup is required. After rollback, smoke-test the Reader at 320px and desktop with settings open, focus mode, bookmark marker, and page navigation.
