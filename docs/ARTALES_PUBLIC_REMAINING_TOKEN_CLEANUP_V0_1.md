# ARTales public remaining token cleanup v0.1

## Status and scope

This final value-preserving audit reviewed the remaining public-facing uses of
the approved legacy variables in `app/globals.css`. The implementation is
deliberately limited to five foreground declarations in the public gallery and
work-detail surfaces. Selector order, specificity, cascade, and every
declaration other than the selected custom-property references remain
unchanged.

## Remaining public-facing candidates found

The audit found candidates in these public-facing groups:

- the adaptive public page and shell foundation (`html`, `body`,
  `.artales-public-shell`, `.artales-public-header`, public links and buttons);
- homepage headings, copy, cards, borders, theme controls, and CTA surfaces;
- public gallery/catalog cards and work-detail facts;
- public access, checkout, resource, community, locale-switcher, and legal
  surfaces.

The audit also found legacy references in reader-adjacent, account, member,
admin, editor, payment, credit, authentication, status, gradient, and dense
internal UI areas. Those are outside this cleanup scope and were not changed.

## Selectors migrated

| Selector | Declaration | Legacy reference | Semantic token |
| --- | --- | --- | --- |
| `.artales-gallery-card h2 a` | `color` | `var(--artales-ink)` | `var(--artales-color-text-primary)` |
| `.artales-gallery-card__author-link` | `color` | `var(--artales-ink)` | `var(--artales-color-text-primary)` |
| `.artales-gallery-card__meta a:not(.artales-gallery-card__author-link)` | `color` | `var(--artales-ink)` | `var(--artales-color-text-primary)` |
| `.artales-work-detail-facts dd` | `color` | `var(--artales-ink)` | `var(--artales-color-text-primary)` |
| `.artales-work-detail-facts a` | `color` | `var(--artales-ink)` | `var(--artales-color-text-primary)` |

These are the only replacements made in this pass.

## Why this is value-preserving

At the default theme layer, `--artales-ink` remains a one-way alias to
`--artales-color-text-primary`, whose literal current value remains `#0d1528`.
Both references therefore resolve to the same value. In the dark theme, the
existing later, more-specific gallery and work-detail rules continue to set the
same explicit foreground with `!important`; those rules were not changed.

The semantic token definitions remain literal/current values and every legacy
root alias remains in place. The replacements do not create a reverse alias or
a circular custom-property reference. No final approved ARTales palette value
was mapped or applied, and rendered visual output is expected to remain
unchanged.

## Intentionally deferred

- Adaptive public shell, header, navigation, button, homepage, theme-toggle,
  and footer candidates remain on legacy references because the legacy values
  are currently redefined by the dark theme. Replacing those references with
  root-only semantic tokens would not be provably equivalent in every theme.
- Public access, checkout, locale, community, resource, and legal candidates
  remain deferred where selectors are shared with internal contexts, lack an
  explicit equivalent theme override, or would broaden this deliberately small
  pass.
- Gradients, shadows, raw colors, alpha recipes, status colors,
  `--artales-ink-soft`, `--artales-gold-soft`, and `--artales-shadow` were not
  changed.
- Reader CSS, reader themes, reader selectors, `--reader-*`, and all account,
  member, admin, editor, payment, credit, authentication, and other dense
  internal selectors were not changed.
- Components, routes, Tailwind configuration, packages, public assets, icons,
  manifests, service workers, database code, environment configuration, and
  Supabase behavior remain unchanged.

## Recommended next step

Prepare a separate public-facing palette-mapping preview. That work should
first define theme-aware semantic token behavior, then preview the public shell,
homepage, gallery, catalog, and work-detail surfaces in both light and dark
themes before any production consideration.
