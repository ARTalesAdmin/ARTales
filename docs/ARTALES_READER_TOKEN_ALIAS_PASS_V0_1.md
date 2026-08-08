# ARTales Reader semantic token alias pass v0.1

## Summary

This phase adds a value-preserving semantic alias layer to the dedicated
reader. The aliases expose reader-owned semantic names while continuing to
resolve to the existing `--reader-*` variables and expressions. No selector
consumes the aliases in this pass, so no computed visual output is expected to
change.

Delivery metadata: **Risk: low** (declarations only, with no consumers);
**Target: develop first**; **DB: no**; **Env: no**.

## Aliases added

The reader root now provides semantic aliases for:

- viewport, toolbar, paper, control and native-option colors;
- the paper shadow;
- progress fill, track and text colors;
- bookmark and bookmark-text colors; and
- selected-control background and text colors.

The paper-soft and progress-track aliases retain their current `color-mix()`
expressions. The selected-control aliases retain the current split explicitly:
light and the root fallback use the soft accent and strong accent text, while
script and dark use the accent background and existing `#0d1528` ink value.
The legacy variables remain unchanged and remain the source of all aliases.

## Deferred aliases and consumption

Navigation and panel shadow aliases are deferred because their raw shadows
belong to multiple local contexts and should be introduced alongside a small,
reviewable selector-consumption pass. Access CTA aliases, shared-renderer
special-block tokens, a global theme bridge, focus-ring behavior and disabled
state work are also deferred. Existing selectors intentionally continue to
consume their current variables and literals.

## Why this does not map a palette

This pass names existing runtime values; it does not replace them. No color,
gradient, opacity, shadow or `color-mix()` input was remapped to a brand or
global palette. Palette preparation or mapping requires a separate review with
visual evidence.

## Theme and renderer boundaries

Reader light, script and dark themes remain independent of the global theme.
Their existing variable blocks remain explicit, and script/dark selected-state
aliases are scoped to those reader themes to preserve their current behavior.
No adaptive or system-driven reader behavior was introduced.

The shared work renderer was not touched. This keeps the alias layer owned by
the dedicated reader and prevents changes from leaking into public work-detail
or other renderer consumers.

## Validation

- `git diff --check` passes.
- The CSS was parsed with the repository's PostCSS dependency.
- A variable-reference check found no circular custom-property references.
- The diff is restricted to `components/reader/reader.css` and reader token
  documentation; components, routes, i18n, globals, shared renderer, assets,
  DB, environment, Supabase and package files are unchanged.
- Light, script and dark legacy values remain explicit and no selector was
  changed to consume the aliases.

Browser screenshot comparison is deferred to preview because declaration-only,
unconsumed custom properties cannot change painted output.

## Next recommended PR

Use a small selector-consumption pass for a few direct aliases, with computed
value comparison across light, script and dark. Alternatively, prepare the
palette-mapping evidence without applying a palette remap in the same change.

The first value-preserving selector-consumption pass started after this alias
layer was established. Its scope and exact replacements are recorded in
`ARTALES_READER_SELECTOR_CONSUMPTION_V0_1.md`; the legacy variables remain the
source values, and no palette mapping is part of that pass.

## Rollback

Revert the alias-pass commit. This removes only unused custom-property aliases
and this documentation; no data, environment, asset, package or renderer
rollback is required. After rollback, smoke-check all three reader themes in
the develop preview.
