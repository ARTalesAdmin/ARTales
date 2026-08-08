# ARTales Reader selector consumption v0.1

## Summary

This pass makes a small set of dedicated reader selectors consume the semantic
aliases introduced by the reader token alias layer. Every new reference points
to an alias whose value is the exact legacy custom property previously used by
that declaration. Selector order, specificity, declarations other than the
custom-property reference, theme values and cascade are unchanged.

Delivery metadata: **Risk: high** under the repository policy because the
reader is a critical path, although the CSS-only change is mechanically
value-preserving; **Target: develop first**; **DB: no**; **Env: no**.

## Selectors migrated

The first consumption set is limited to:

- `.artales-reader` viewport background and inherited toolbar text color;
- `.artales-reader-toolbar` background, bottom border and text color;
- `.artales-reader-toolbar__title` and `__author` text;
- `.artales-reader-settings-toggle` basic background, border and text;
- the shared basic control-surface rule for control groups, select labels,
  ghost buttons/links, primary links and exit links;
- the basic control-surface background rule and control-group button text;
- `.artales-reader-progress` text and its track fill; and
- `.artales-reader__paper` background, border, shadow and text.

The grouped control rule includes the primary-link base border and text only.
Its selected/accent-like background declarations and theme overrides remain
untouched.

## Exact variable replacements

| Legacy reference | Semantic reference | Used for |
| --- | --- | --- |
| `var(--reader-outer-bg)` | `var(--reader-color-viewport-bg)` | Reader viewport background |
| `var(--reader-toolbar-bg)` | `var(--reader-color-toolbar-bg)` | Toolbar background |
| `var(--reader-toolbar-border)` | `var(--reader-color-toolbar-border)` | Toolbar border |
| `var(--reader-toolbar-text)` | `var(--reader-color-toolbar-text)` | Reader, toolbar and title text |
| `var(--reader-toolbar-muted)` | `var(--reader-color-toolbar-muted)` | Toolbar author text |
| `var(--reader-control-bg)` | `var(--reader-color-control-bg)` | Basic control backgrounds |
| `var(--reader-control-border)` | `var(--reader-color-control-border)` | Basic control borders |
| `var(--reader-control-text)` | `var(--reader-color-control-text)` | Basic control text |
| `var(--reader-toolbar-muted)` | `var(--reader-color-progress-text)` | Progress text |
| `var(--reader-accent)` | `var(--reader-color-progress-fill)` | Progress fill only |
| `var(--reader-paper)` | `var(--reader-color-paper-bg)` | Paper background |
| `var(--reader-paper-border)` | `var(--reader-color-paper-border)` | Paper border |
| `var(--reader-paper-shadow)` | `var(--reader-shadow-paper)` | Paper shadow |
| `var(--reader-paper-text)` | `var(--reader-color-paper-text)` | Paper text |

## Why output is value-preserving

Each semantic alias is declared on `.artales-reader` as a direct reference to
the legacy property shown in the table. Theme classes continue to override the
legacy source properties exactly as before, so light, script and dark resolve
through the alias to the same theme-specific value. No fallback, literal,
gradient, opacity, `color-mix()` input, shadow value or theme assignment was
changed. The legacy properties were neither removed nor renamed.

No ARTales or global palette value was mapped in this pass. This is selector
consumption only, not reader polish or redesign.

## Intentionally deferred

The following areas remain on their existing references:

- shared renderer adapter declarations and
  `components/work/work-content-renderer.css`;
- preview CTA and global `.artales-button` styling;
- selected or pressed controls and their light/script/dark split;
- focus rings, disabled states, native selects and options;
- bookmark marker gradients and other derived `color-mix()` expressions;
- navigation and panel surfaces or shadows;
- access panels, mobile overrides and pagination/page-fit behavior; and
- remaining reader selectors not needed for this small first pass.

The shared renderer remains untouched so this reader-owned migration cannot
alter public work-detail or other renderer consumers.

## Validation expectations

- Parse `components/reader/reader.css` with the repository PostCSS dependency.
- Confirm the custom-property reference graph contains no cycles.
- Confirm the patch changes only the two reader-token documents and
  `components/reader/reader.css`.
- Confirm the CSS diff changes direct variable references only, without
  selector, ordering or cascade edits.
- Smoke-check light, script and dark reader themes in the develop preview; the
  expected visual result is unchanged.

## Next recommended PR

Depending on the remaining coverage and review preference, either prepare a
reader palette-mapping preview with visual evidence or perform a second small
value-preserving selector-consumption pass. Do not combine palette mapping with
unrelated reader behavior work.

## Rollback

Revert the selector-consumption commit. This restores the affected declarations
to their direct legacy references and removes this document and the follow-up
note from the alias-pass document. No data, environment, package, asset,
renderer or theme-value rollback is required. After reverting, smoke-check the
reader in light, script and dark on the develop preview.
