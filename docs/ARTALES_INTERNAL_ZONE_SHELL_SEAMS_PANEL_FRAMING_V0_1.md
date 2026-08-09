# ARTales internal zone: shell seams and panel framing v0.1

## Scope and preview context

This develop-only pass follows the adaptive sidebar fix. Manual preview showed that the adaptive palette and single sidebar brand were working, but the header, rail, page field, and cards still read as separate blocks. Light panels lacked consistent definition, while dark panels and controls carried uneven bright edges and shadows.

The change is CSS-only and limited to the internal account/member/admin shells. It does not alter routes, navigation, permissions, data, or component markup.

## Top-left orphan block diagnosis

The internal wrappers use the shared `PublicHeader`, whose base rule centers it with a `1180px` maximum width. The internal shell background therefore remained visible beside the header at wide viewports. At the upper-left transition into the rail, that exposed field read as a detached square rather than intentional spacing.

No redundant element exists in the account or member layout. The fix scopes a full-width header surface to a direct child of `.artales-app-shell` or `.artales-workspace-shell`; public shells retain the existing centered header behavior. The header now uses the internal elevated surface and shell seam token so its lower edge meets the workspace deliberately.

## Tokens

Two role-based aliases were added:

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--artales-internal-shell-border` | `rgba(142, 98, 31, 0.24)` | `rgba(220, 166, 69, 0.20)` | Header/rail/layout seams |
| `--artales-internal-panel-border` | `rgba(142, 98, 31, 0.28)` | `rgba(220, 166, 69, 0.22)` | Card and panel framing |

Existing internal surface and shadow tokens remain the source for fills and elevation. There are no circular variable references.

## Selectors and surface decisions

- `.artales-app-shell` and `.artales-workspace-shell` direct-child headers become full-width internal surfaces without changing `.artales-public-shell`.
- `.artales-account-shell`, `.artales-member-shell`, and `.artales-member-layout` share the internal background, eliminating overlapping gradients at layout seams.
- `.artales-account-sidebar` and `.artales-member-sidebar` use the shell-border token and no floating shadow. On narrow member layouts the vertical separator becomes a bottom separator.
- Named account/member cards, panels, list items, admin panels, table wrappers, and hero panels use the internal surface, panel-border, and elevation tokens.
- Larger panels keep the panel shadow; smaller cards use the card shadow.
- Dark internal member/admin action elements drop incidental box shadows to reduce icon/button glare while preserving borders, hover rules, and focus-visible outlines.

The final framing rules retain `!important` only for `background` and `border-color`. This is necessary because the existing legacy compatibility selectors already declare those properties with `!important`; placing a normal declaration later cannot override them. No new `!important` is used for shadows or layout.

## Theme rationale

### Light

Warm brown/gold alpha borders define paper-like surfaces without introducing black outlines. The shared warm background lets panels feel inset in one editorial workspace rather than like unrelated white boxes.

### Dark

Muted gold alpha borders separate near-black surfaces without a bright paper-colored rim. Existing low, neutral shadows supply depth, while removing action shadows prevents small controls and icons from appearing luminous.

## Intentionally unchanged

- Public homepage, gallery, work detail, public header behavior inside public shells, and public assets.
- Reader, parser, pagination, editor blocks, media uploads, payments, ledger, memberships, and access/business logic.
- Routes, navigation targets, i18n, database, Supabase, environment, package files, and responsive structure.
- Brand assets and component markup; diagnosis did not justify a TSX change.

## Preview checklist

- [ ] Light member works page: shell field and work-card borders.
- [ ] Dark member works page: restrained borders, shadows, icons, and buttons.
- [ ] Light member overview.
- [ ] Dark member overview.
- [ ] Account shell, where available.
- [ ] Sidebar-to-main seam and aligned header edge.
- [ ] Top-left corner has no orphan field/block.
- [ ] Primary and secondary buttons in both themes.
- [ ] Forms remain readable and focus-visible states remain clear.
- [ ] Tables and statuses remain readable.
- [ ] Desktop layout.
- [ ] Narrow/mobile quick check; rail separator moves below the navigation.
- [ ] Public homepage unchanged.
- [ ] Reader unchanged.

## Rollback

Revert the shell-seams commit. This removes the two new token aliases, the final scoped CSS block, and this document. There are no data, environment, asset, package, or migration steps to reverse.
