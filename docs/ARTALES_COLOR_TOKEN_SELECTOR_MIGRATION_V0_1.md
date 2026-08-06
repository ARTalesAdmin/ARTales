# ARTales color token selector migration v0.1

## Status and scope

This is the first value-preserving selector migration for the ARTales semantic
color tokens. It migrates only the global page foundation and the basic dark
brand text in `app/globals.css`. The selector order, cascade, and declarations
other than the selected custom-property references remain unchanged.

## Migrated selector group

The following selector-level references now use semantic tokens directly:

| Selector | Declaration | Legacy reference | Semantic token |
| --- | --- | --- | --- |
| `body` | `background` | `var(--background)` | `var(--artales-color-background-page)` |
| `body` | `color` | `var(--foreground)` | `var(--artales-color-text-primary)` |
| `html` | `background` | `var(--artales-paper)` | `var(--artales-color-background-page)` |
| `.artales-brand__text` | `color` | `var(--artales-ink)` | `var(--artales-color-text-primary)` |
| `.artales-brand--dark .artales-brand__text` | `color` | `var(--artales-ink)` | `var(--artales-color-text-primary)` |

PR #85 already established each legacy reference as a one-way alias to the
semantic token shown here. The semantic definitions retain the same literal
current/fallback values introduced in PR #83. Resolving either side therefore
produces the same value, and rendered output is expected to remain unchanged.

## Intentionally deferred

The legacy root aliases remain in place for selectors that still consume them.
This migration does not change gradients, shadows, raw colors, alpha recipes,
soft ink or gold variables, status and form styles, components, or routes. It
also does not apply any final approved ARTales palette mapping.

Reader selectors, reader CSS, reader themes, and all `--reader-*` variables
remain deferred to separate reader-specific work. Admin, editor, member, and
other dense internal UI remain deferred as well.

## Recommended next group

The next value-preserving pass should review a small public shell group, such as
plain foreground declarations in public navigation, header, footer, and page
shell selectors. It should continue to replace only references covered by the
existing aliases and leave gradients, opacity recipes, and unmatched legacy
variables unchanged.
