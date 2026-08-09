# ARTales internal-zone tables and status polish v0.1

## Summary

This `develop`-only preview follows the internal audit and semantic-token work
from PRs #119–#122 and the forms/buttons pass in PR #123. It aligns existing,
classed account, member, and admin data-display surfaces with the internal
shell palette. No markup, copy, filtering, sorting, selection, action, or
workflow behavior changes.

**Risk:** low. **Target:** develop first. **DB:** no. **Env:** no.

## Selectors reviewed

The review covered `.artales-admin-table` headers, body rows, cells, borders,
and links; `.artales-account-list-item` and `.artales-member-list-item`;
`.artales-account-badge`, `.artales-status-chip`, and account library badges;
account/member success and error notices; and the classed account empty state.
Legacy dark-theme compatibility selectors were also reviewed so the final
semantic rules remain authoritative in both themes.

Credit payment and ledger statuses were reviewed only to confirm that they are
outside this pass. Generic utility classes and unclassed loading/error markup
were not broadened into the selector set.

## Selectors changed

- Admin table background, header background/text, cell borders, body rows, and
  body-row hover.
- Account and member list-row borders and hover backgrounds.
- Account badges, general status chips, private/warning chips, and muted
  library badges.
- Existing account/member success notices and danger/error alerts.
- The existing account empty-state surface and border.

Spacing, table sizing, nowrap behavior, responsive layout, typography,
filtering, sorting, selection, links, and actions are preserved.

## Token usage and value mapping

Previously value-preserving table/list/status/badge aliases now map explicitly
to the softened internal palette:

| Role | Previous mapping | Light/default | Dark |
| --- | --- | --- | --- |
| Table header | `var(--artales-paper-warm)` | `#eee5d8` | `#272722` |
| Table row | `var(--artales-surface)` | `#fffaf4` | `#1f1e1a` |
| Row/list hover | `var(--artales-paper-warm)` | `#f8eddb` | `#292720` |
| Table border | `var(--artales-border)` | `rgba(39, 40, 39, 0.16)` | `rgba(253, 243, 226, 0.16)` |
| Badge surface | `var(--artales-black)` | `#272827` | `#272722` |
| Muted badge | `var(--artales-paper-warm)` | `#eee5d8` | `#252522` |
| Success surface | generic surface | `#edf6ee` | `#14251a` |
| Warning surface | generic surface | `#fbf2de` | `#2b2415` |
| Danger surface | generic surface | `#faecea` | `#2b1717` |
| Info surface | generic surface | `#edf1f7` | `#18212d` |

Selectors consume `--artales-internal-table-*`,
`--artales-internal-list-hover-bg`, `--artales-internal-badge-*`, and the
`--artales-internal-success/warning/danger-*` families. The info family is
mapped for consistent future use but is not applied broadly because no safe,
dedicated existing info selector was identified.

## Light and dark handling

Light mode uses warm, low-chroma surfaces with a clearly darker table header
and a restrained hover tint. Dark mode uses separate opaque surfaces so table
headers, rows, and hover remain distinguishable without relying on public
palette aliases. A final dark-theme compatibility block ensures earlier
high-specificity rules do not replace these semantic mappings.

## Status color rationale

Success remains green, warning remains amber-brown, danger/error remains red,
and info remains blue. Each family has a coordinated background, border, and
text value for both themes. The darker danger surfaces use pink-red text and a
red border rather than gold, keeping errors immediately distinct from brand
and warning treatments. Badges remain compact meaning carriers: the standard
badge retains restrained brand emphasis, muted badges remain neutral, and the
private chip uses the warning family rather than decorative gold alone.

## Intentionally deferred high-risk areas

- WorkEditorForm, WorkBlocksEditor, generated blocks, save-state controls, and
  all editor internals;
- media upload/dropzones, payment and ledger surfaces, destructive-action
  behavior, roles, access, permissions, and membership logic;
- Reader, parser, generated table headers, and pagination;
- inline-style rewrites, generic utility-class remapping, TSX class hooks, and
  component refactors;
- public homepage, gallery, work-detail styles, assets, brand, copy, i18n, DB,
  env, Supabase, and packages.

## Preview checklist

- [ ] Account/member list surfaces, where present
- [ ] Admin dashboard lists and tables
- [ ] Table header/row separation and restrained row hover
- [ ] Account badges, private chips, and muted library badges
- [ ] Success, warning, danger/error, and existing info states
- [ ] Account empty state
- [ ] Global light mode
- [ ] Global dark mode
- [ ] Desktop viewport
- [ ] Narrow/mobile quick check, including horizontal table overflow
- [ ] No Reader regression
- [ ] No public homepage regression
- [ ] No editor, media, payment, or destructive workflow regression

## Rollback

Revert the tables/status polish commit. This restores the prior token aliases,
removes the narrowly scoped final cascade rules, and removes this follow-up
note. No database, environment, migration, asset, deployment-order, or
persistent-data recovery step is required.

## Follow-up: sidebar and shell unification

Manual `develop` preview after this tables/status pass found the old permanently
dark sidebar visually inconsistent with the newly warm header and main area.
The next scoped preview is documented in
`ARTALES_INTERNAL_ZONE_SIDEBAR_SHELL_UNIFICATION_V0_1.md`; it makes the existing
member/account sidebar and internal shell selectors consume the adaptive
`--artales-internal-nav-*` and surface tokens. It does not change the table,
status, Reader, editor, or workflow behavior covered or deferred here.
