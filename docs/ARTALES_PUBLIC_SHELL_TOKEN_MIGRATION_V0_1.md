# ARTales public shell token migration v0.1

## Status and scope

This value-preserving pass migrates a deliberately small group of public shell
selectors in `app/globals.css`. It updates the public shell foreground, public
navigation link, primary button surface and border, and secondary button
foreground. Selector order, specificity, cascade, and every declaration other
than the selected custom-property references remain unchanged.

## Migrated selector group

| Selector | Declaration | Legacy reference | Semantic token |
| --- | --- | --- | --- |
| `.artales-public-shell` | `color` | `var(--artales-ink)` | `var(--artales-color-text-primary)` |
| `.artales-public-link` | `color` | `var(--artales-ink)` | `var(--artales-color-text-primary)` |
| `.artales-button` | `background` | `var(--artales-ink)` | `var(--artales-color-text-primary)` |
| `.artales-button` | `border` | `var(--artales-ink)` | `var(--artales-color-text-primary)` |
| `.artales-button-secondary` | `color` | `var(--artales-ink)` | `var(--artales-color-text-primary)` |

The legacy `--artales-ink` root variable is a one-way alias to
`--artales-color-text-primary`, so both references resolve to the same current
value at this migrated layer. The later adaptive-theme rules for these public
selectors remain unchanged and continue to control their themed rendering.
The semantic token definitions retain their literal current values, and the
legacy aliases remain available for selectors outside this pass. No circular
reference is introduced, and rendered visual output is expected to remain
unchanged.

## Intentionally deferred

This pass does not change gradients, shadows, raw colors, alpha recipes, state
colors, `--artales-ink-soft`, `--artales-gold-soft`, `--artales-shadow`, or any
non-aliased variable. It does not modify components, routes, public assets,
Tailwind configuration, packages, database code, environment configuration, or
Supabase behavior.

Reader CSS, reader themes, reader selectors, and all `--reader-*` variables
remain deferred. Admin, editor, member, account, authentication, and other
dense or private UI selectors also remain deferred. This migration does not
apply the final approved ARTales palette or change any literal palette value.

## Recommended next group

After preview verification, the next small value-preserving pass should review
plain foreground and subtle-border references in the public footer and a
single homepage surface/card group. It should migrate only references with
proven output equality and continue to leave gradients, themed overrides,
state colors, and deferred product areas untouched.
