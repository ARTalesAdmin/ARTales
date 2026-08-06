# ARTales color token alias pass v0.1

## Status and scope

This is the first value-preserving alias pass for the ARTales semantic color
tokens. It connects a small, reviewed set of legacy root variables in
`app/globals.css` to semantic tokens whose literal values exactly match the
legacy values they replace.

The semantic token definitions remain literal current/fallback values. They do
not depend on legacy variables, so the aliases are one-way and do not create
circular custom-property references. No final approved ARTales palette mapping
has happened yet, and rendered visual output is expected to remain unchanged.

## Aliased legacy variables

The following legacy variables now point to matching semantic tokens:

| Legacy variable | Semantic token |
| --- | --- |
| `--background` | `--artales-color-background-page` |
| `--foreground` | `--artales-color-text-primary` |
| `--artales-ink` | `--artales-color-text-primary` |
| `--artales-black` | `--artales-color-background-inverse-deep` |
| `--artales-gold` | `--artales-color-brand-gold` |
| `--artales-paper` | `--artales-color-background-page` |
| `--artales-paper-warm` | `--artales-color-background-surface-muted` |
| `--artales-muted` | `--artales-color-text-muted` |
| `--artales-border` | `--artales-color-border-subtle` |

Variables without an exact semantic-token value match remain literal. This
includes `--artales-ink-soft`, `--artales-gold-soft`, and `--artales-shadow`.
Shadows, gradients, and derived opacity recipes were not aliased.

## Intentionally deferred

This pass does not migrate selector-level declarations. Existing usages of the
legacy variables remain in place, and no component or route code was changed.
It also does not apply final ARTales palette values.

Reader tokens and themes remain deferred to separate reader-specific work. No
`--reader-*` variable, reader theme block, or reader selector is defined or
changed by this pass.

## Next step

The next PR should migrate one small, reviewed selector group to semantic
tokens while preserving current values and rendered output. Broader selector
migration and palette mapping should remain separate, explicitly reviewed
steps.
