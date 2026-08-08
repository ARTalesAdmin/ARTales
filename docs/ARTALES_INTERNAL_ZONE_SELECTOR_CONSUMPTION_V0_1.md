# ARTales internal-zone selector consumption v0.1

## Summary

This is the first value-preserving consumption pass for the internal semantic
aliases introduced after the visual audit in PR #119 and the definition-only
alias layer in PR #120. It changes direct custom-property references in a small
set of internal shell and navigation-text declarations. It does not change
selector order, specificity, declaration values, cascade behavior, or token
definitions.

**Risk:** low. **Target:** develop first. **DB:** no. **Env:** no.

## Selectors migrated

| Selector | Declaration role | Replacement |
| --- | --- | --- |
| `.artales-member-sidebar__title` | Member navigation title text | `var(--artales-gold-soft)` → `var(--artales-internal-nav-text)` |
| `.artales-account-shell` | Account shell text | `var(--artales-ink)` → `var(--artales-internal-text)` |
| `.artales-account-sidebar .artales-account-eyebrow` | Account navigation eyebrow text | `var(--artales-gold-soft)` → `var(--artales-internal-nav-text)` |
| `.artales-admin-dashboard` | Admin shell text | `var(--artales-ink)` → `var(--artales-internal-text)` |
| `.artales-app-shell`, `.artales-workspace-shell` | Adaptive shell gradient end surface | `var(--artales-paper)` → `var(--artales-internal-bg)` |
| `.artales-app-shell`, `.artales-workspace-shell` | Adaptive shell gradient start surface | `var(--artales-surface-strong)` → `var(--artales-internal-surface-elevated)` |
| `.artales-app-shell`, `.artales-workspace-shell` | Adaptive shell text | `var(--artales-ink)` → `var(--artales-internal-text)` |

No selectors were added, removed, reordered, split, or combined. Only the custom
property references shown above changed.

## Why the output is value-preserving

Each consumed alias still points directly to the replaced legacy property:

- `--artales-internal-nav-text` resolves to `--artales-gold-soft`;
- `--artales-internal-text` resolves to `--artales-ink`;
- `--artales-internal-bg` resolves to `--artales-paper`;
- `--artales-internal-surface-elevated` resolves to
  `--artales-surface-strong`.

The aliases resolve through the same existing adaptive legacy layer in light and
dark themes. This pass does not change any alias or legacy value, introduce a
fallback, or redirect one internal alias through another. The dependency graph
therefore remains acyclic and computed values remain the same in both themes.

## Intentionally deferred

The member and account sidebars contain gradients, raw colors, and derived
translucent values that do not have exact aliases, so their backgrounds, borders,
muted link text, hover treatments, and active treatments remain unchanged.
Passive cards and panels in the early stylesheet likewise use raw or derived
values rather than exact legacy-variable references and were not forced into an
approximate semantic role.

Forms, inputs, selects, textareas, tables, lists, status badges, destructive
actions, payments, ledgers, credits, membership status, access and role flows,
editor/work blocks, upload workflows, inline styles, and responsive rules are
deferred as higher-risk or separately reviewable areas. Reader, parser, and
pagination behavior are outside this work.

Public homepage, gallery, work-detail, public-shell, and public component styles
were not migrated even where a grouped selector also mentioned an account class.
No route, component, TSX, i18n, asset, brand, database, Supabase, environment, or
package file changed.

## No palette mapping

No ARTales palette mapping happened. This pass only gives selected declarations
semantic indirection through aliases that resolve to their exact former sources.
It introduces no raw color, changes no existing color, and makes no visual design
decision for the internal zone.

## Next recommended PR

After review in `develop` and comparison in preview, audit one additional passive
internal surface family for declarations already backed by exact legacy
variables. Prefer cards and panels only if exact aliases can be consumed without
touching public grouped selectors. Continue to leave forms, tables, statuses,
editor workflows, and palette mapping for dedicated passes.

## Rollback

Revert the selector-consumption commit. This restores the direct legacy custom-
property references. There is no data, environment, migration, or deployment
ordering requirement because the alias definitions remain value-equivalent and
the change has no persistent side effects.

## Validation checklist

- [x] `git diff --check`
- [x] CSS parse validation
- [x] No circular custom-property references
- [x] Only allowed CSS and documentation files changed
- [x] No TSX, route, component, i18n, asset, DB, env, or package changes
- [x] No forms, tables, status, editor, reader, parser, or pagination selectors changed
- [x] Selector order and cascade unchanged apart from direct variable references
- [x] No palette mapping or token-value change
