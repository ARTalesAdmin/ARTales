# ARTales internal-zone token alias pass v0.1

## Summary

This pass adds a semantic `--artales-internal-*` custom-property namespace for
future account, member, admin, and other internal surfaces. It is a definition-only
foundation following the audit in PR #119. No selector consumes the namespace, so
the browser's computed styles and rendered output remain unchanged.

**Risk:** low. **Target:** develop first. **DB:** no. **Env:** no.

## Token groups and source mappings

The new groups are core shell/surface, text, accent/action, forms, tables/lists,
navigation, status, badges/chips, and elevation.

| Internal group | Existing value sources |
| --- | --- |
| Shell and surfaces | `--artales-paper`, `--artales-paper-warm`, `--artales-surface`, `--artales-surface-strong` |
| Borders | `--artales-border`, `--artales-border-strong` |
| Text and headings | `--artales-ink`, `--artales-muted` |
| Accent, links, focus | `--artales-gold`, `--artales-gold-soft`, `--artales-link`, `--artales-hero-glow`, `--artales-color-focus-ring` |
| Forms, tables, and lists | Existing adaptive surface, paper, border, ink, and muted aliases |
| Navigation | Existing adaptive black, surface, border, gold-soft, and muted aliases |
| Status | Existing generic state colors plus the adaptive surface alias |
| Badges and chips | Existing adaptive black, paper, border, gold-soft, and muted aliases |
| Elevation | `--artales-soft-shadow`, `--artales-shadow` |

The aliases intentionally resolve through the existing light/dark legacy layer.
They neither replace nor modify that layer. Generic root state and focus variables
are used only where an equivalent adaptive legacy alias does not exist. No token
depends on a Reader-specific variable or a public component-specific token.

## Why this is value-preserving

- Only custom-property definitions and documentation were added.
- No existing custom-property value was changed or removed.
- No selector, component, route, markup, or inline style was changed to consume a
  new token.
- Unreferenced custom properties do not participate in a rendered declaration, so
  this pass cannot change computed visual output.
- The aliases contain no dependency cycles: every internal token points outward to
  an existing legacy or root semantic value, never to another internal token.

## Intentionally deferred

Exact per-component choices remain deferred for shells, cards, forms, tables,
lists, navigation states, workflow statuses, badges, disabled states, and any
future modal. The repository has multiple current values for several of these
roles, so this pass establishes safe semantic names without pretending that a
single selector migration has already been approved.

No selector consumption happened because combining definitions with migration
would make visual equivalence harder to review and would cross the audit's smallest
safe implementation boundary. No ARTales palette mapping happened because that is
a visual design change: gold remains available only as accent/navigation text, not
as a default large surface, and existing visuals remain authoritative.

Reader styling and behavior, parser and pagination behavior, editor internals,
payments, credits, membership, access and role logic, Supabase, database and
environment configuration, public pages, assets, i18n, and package files are all
outside this pass.

## Rollback

Revert the token-pass commit. Because no selector consumes these definitions and
there are no data or configuration changes, rollback has no runtime ordering or
data-recovery requirement.

## Next recommended PR

After review in `develop`, take one small selector family—preferably the internal
shell background, passive panel/card, border, and text declarations—and replace
only value-equivalent declarations with these aliases. Record computed styles for
representative account, member, and admin routes in both themes before and after.
Keep forms, tables, badges, workflow status styling, editor surfaces, and palette
changes in later independently reviewable passes.

The first selector-consumption pass subsequently started with the smallest safe
shell and navigation-text subset. Its exact replacements, deferrals, and rollback
are recorded in
`ARTALES_INTERNAL_ZONE_SELECTOR_CONSUMPTION_V0_1.md`; the alias definitions in
this document remain unchanged.

## Validation checklist

- [x] `git diff --check`
- [x] CSS parse validation
- [x] No circular custom-property references
- [x] Only the three allowed files changed
- [x] No selector consumes `--artales-internal-*`
- [x] No visual palette mapping or runtime behavior changed
