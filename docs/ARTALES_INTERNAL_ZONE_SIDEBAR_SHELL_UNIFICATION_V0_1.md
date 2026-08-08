# ARTales internal-zone sidebar and shell unification v0.1

## Summary

This `develop`-only preview follows the internal visual audit and staged token,
shell, forms/buttons, and tables/status work from PRs #119–#124. Manual review
after PR #124 found that the header and main area had adopted the warm internal
palette while the member and account sidebars remained permanently dark. This
pass makes the existing internal shell and navigation selectors consume one
adaptive semantic color system without changing their structure or behavior.

**Risk:** medium, because this is a visible adaptive shell-wide palette change.
**Target:** develop first. **DB:** no. **Env:** no.

## Selectors reviewed

The CSS audit covered `.artales-app-shell`, `.artales-workspace-shell`,
`.artales-account-shell`, `.artales-member-shell`, `.artales-account-sidebar`,
`.artales-member-sidebar`, their existing title, eyebrow, subtitle, and hint
selectors, `.artales-account-nav` and `.artales-member-nav` links and groups,
the member active-link class, and the account emphasis-link class. The admin
dashboard was reviewed, but no separate admin sidebar selector exists in
`app/globals.css`; its content already inherits the internal shell palette.

No new route or component selector was invented.

## Old color source

The permanent dark rail came from three layers of legacy CSS: the original
sidebar rules used dark hex fills and white RGBA text, a later compatibility
block reapplied a near-black background, and the explicit light-theme override
still selected a navy background. In addition, the light/default
`--artales-internal-nav-*` mappings themselves described the earlier dark rail.
Those later and more specific rules kept the sidebar dark even after the shell
surface started consuming internal tokens.

## Selectors changed and token usage

- All four existing internal shell wrappers now share the same gradient
  relationship between `--artales-internal-surface-elevated`,
  `--artales-internal-bg`, and the restrained accent glow.
- Member and account sidebars use `--artales-internal-nav-bg`,
  `--artales-internal-nav-border`, `--artales-internal-nav-text`, and the
  internal card shadow.
- Sidebar titles and eyebrow text use the nav text role; subtitles and hints use
  the nav muted role.
- Existing nav group dividers use the nav border role.
- Existing links use nav muted/text roles; hover uses
  `--artales-internal-nav-hover-bg`; member active and account emphasis states
  use the active background/text roles.
- Existing links receive the internal focus-ring token for keyboard focus.

Layout, spacing, radius, sticky positioning, responsive grids, typography, and
link destinations remain unchanged.

## Light/default behavior

The default navigation tokens now map to a warm muted-paper sidebar with dark
ink text. Hover is a restrained brown-gold tint, while the active/emphasis
surface is a slightly stronger soft-gold tint with a contrast-safe brown label.
Gold remains an interaction accent rather than a sidebar fill. The sidebar,
header wrapper, and main surface therefore read as layers of one editorial and
functional internal environment rather than a black admin rail beside paper.

## Dark behavior

The existing explicit dark `--artales-internal-*` mappings are retained. In
dark mode the same selectors resolve to the night navigation surface, pale text,
subtle light hover, and restrained gold active state. The sidebar can therefore
remain comfortably dark while belonging to the same adaptive palette as the
shell and main area instead of relying on unrelated legacy literals.

## Intentionally not changed

No TSX, routes, component structure, copy, i18n, assets, brand sources, package
files, DB, env, or Supabase behavior changed. Reader, editor, parser,
pagination, access/role logic, memberships, media uploads, payments, credits,
and ledgers are untouched. Public homepage, gallery, and work-detail selectors
are not included. Forms/buttons and tables/lists/badges/status semantics from
PRs #123 and #124 are not remapped.

## Preview checklist

- [ ] Member sidebar in light/default mode
- [ ] Account sidebar in light/default mode
- [ ] Admin shell and dashboard, where available
- [ ] Member active item and account emphasis item
- [ ] Member/account nav hover item
- [ ] Sidebar title, eyebrow, subtitle, and hint
- [ ] Top header wrapper and main-area relationship
- [ ] Global dark mode
- [ ] Desktop viewport
- [ ] Narrow/mobile quick check
- [ ] Forms and buttons remain readable
- [ ] Tables and status badges remain readable
- [ ] No Reader regression
- [ ] No public homepage regression

## Rollback

Revert the sidebar/shell unification commit. This restores the previous
light/default nav-token values, removes the final semantic sidebar/shell rules,
and removes this documentation and its tables/status follow-up note. No DB,
environment, migration, asset, deployment-order, or persistent-data recovery
step is required.
