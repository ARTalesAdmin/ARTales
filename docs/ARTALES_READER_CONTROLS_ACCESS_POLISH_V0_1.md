# ARTales Reader controls and access polish v0.1

## Status and target

- **Target:** `develop first`; this is a develop-preview change and is not approved for `main`.
- **Risk:** medium. The runtime change is isolated to Reader CSS, but the Reader remains a critical user path.
- **DB:** no.
- **Env:** no.
- **Behavior:** unchanged.

This pass follows the calmer palette preview from PR #112. It does not remap the Reader palettes again. It uses the semantic aliases introduced in PRs #109–#112 to make controls, access messaging, and interaction states feel like one restrained Reader surface.

## Controls reviewed

- Sticky toolbar, title/author metadata, settings toggle, and settings panel.
- Reading progress track, fill, and text.
- Text-size group and layout, theme, width, and density selects.
- Focus-mode off/on state.
- Bookmark create, go, update, and clear actions, plus the in-paper bookmark marker.
- Preview note and preview-end CTA.
- Page/spread navigation and first/last disabled states.
- Pointer hover and keyboard `:focus-visible` states.

Title and author selectors were reviewed but did not need new overrides: they already consume the Reader toolbar text and muted-text aliases.

## Selectors changed

The final, narrowly scoped polish layer in `components/reader/reader.css` changes:

- `.artales-reader` (derived control hover, disabled, and focus-ring aliases)
- `.artales-reader-toolbar__settings-panel`
- Reader toolbar buttons, links, control groups, and select labels
- `.artales-reader-top-button--focus[aria-pressed="true"]`
- `.artales-reader-progress__track` and its fill
- `.artales-reader-select-label select` and `option`
- `.artales-reader__bookmark-marker`
- `.artales-reader__preview-note`
- `.artales-reader__preview-cta .artales-button`
- `.artales-reader-page-nav button:disabled`
- `.artales-reader-side-nav:disabled`
- Reader-local `button`, `a`, and `select` `:focus-visible` states

No component class hooks were required, so no TSX was changed.

## Light, script, and dark handling

All new values are derived with `color-mix()` from existing Reader semantic aliases: toolbar, paper, control, selected, bookmark, and progress colors. Light, script, and dark therefore retain their established palette mapping without new raw theme colors or circular custom-property references.

Gold remains an accent: it identifies progress, bookmark, selected focus mode, focus rings, and CTA boundaries without becoming a broad toolbar or panel fill. Progress uses a quieter mixture of the existing fill and muted toolbar color.

## Preview and access CTA handling

The preview note now reads as a subtle in-paper notice. The preview-end `.artales-button` is overridden only beneath `.artales-reader__preview-cta`, removing the more assertive shared/public button presentation in favor of the Reader control and bookmark aliases, a restrained border, and no elevated shadow. The toolbar continue-reading link remains within the existing Reader control system.

Access and entitlement logic, CTA destinations, labels, rendering conditions, and preview boundaries are unchanged.

## Focus and disabled states

- Reader buttons, links, and native selects receive a consistent two-pixel `:focus-visible` outline with offset; mouse clicks do not gain the outline.
- The pressed focus-mode button uses existing selected-control aliases in all themes.
- Disabled page and spread controls use explicit background, border, and text aliases instead of near-invisible opacity alone. Their dimensions and disabled behavior remain unchanged.
- Hover changes are limited to Reader chrome and use derived control colors.

## Intentionally not changed

- Prose typography, scale, line height, and paper palette.
- Reader toolbar/settings structure, touch-target sizing, or mobile breakpoints.
- Reader settings behavior or persistence.
- Parser, pagination, page fitting, and page/spread navigation behavior.
- Preview/full-access or entitlement logic.
- Shared renderer, work-detail, homepage, gallery, global, brand, or public asset styles.
- TypeScript, i18n, packages, DB, environment, or Supabase code.

## Develop preview checklist

- [ ] Reader light toolbar.
- [ ] Reader script toolbar.
- [ ] Reader dark toolbar.
- [ ] Progress at start, middle, and end.
- [ ] Settings open and closed.
- [ ] Text-size controls.
- [ ] Theme, layout, width, and density selects (including closed native select state).
- [ ] Focus mode on and off.
- [ ] Bookmark absent and present.
- [ ] Bookmark go, update, and clear.
- [ ] Preview start note and end CTA.
- [ ] Page-layout navigation.
- [ ] Spread-layout navigation.
- [ ] Disabled first and last navigation controls.
- [ ] Keyboard tab order and `:focus-visible` appearance.
- [ ] 320 px and 360 px mobile quick checks.
- [ ] Desktop quick check.

## Rollback path

Revert the single controls/access polish commit (or remove the final `Reader controls/access polish v0.1` layer and this document). Because this change has no data, environment, markup, or behavior dependency, rollback requires no migration or cleanup. After rollback, smoke-test Reader toolbar controls, preview CTA, bookmarks, and page/spread navigation in the develop preview.
