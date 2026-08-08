# ARTales internal-zone sidebar theme tuning v0.1

## Summary

This `develop`-only follow-up tunes the semantic palette introduced by the
sidebar/shell unification in PR #125. The selectors and adaptive architecture
remain unchanged; only existing internal token values are adjusted.

**Risk:** medium, because shared internal text and primary-button tokens affect
multiple internal surfaces. **Target:** develop first. **DB:** no. **Env:** no.

## Manual preview issues

The first unified preview correctly made the sidebar follow the internal theme,
but the light sidebar appeared faded, its brand-adjacent title and supporting
copy lacked definition, and its active item felt muddy. Dark mode was cohesive,
but sidebar labels and main intro/body copy were overly muted, while the strong
light-on-near-black primary action could glare beside dark cards.

## Token changes

### Light/default

| Token | Old | New |
| --- | --- | --- |
| `--artales-internal-nav-bg` | `#f3eadc` | `#eee1cf` |
| `--artales-internal-nav-border` | `rgba(39, 40, 39, 0.16)` | `rgba(73, 55, 37, 0.24)` |
| `--artales-internal-nav-text` | `#272827` | `#1f211f` |
| `--artales-internal-nav-muted` | `#5f5247` | `#594a3e` |
| `--artales-internal-nav-active-bg` | `rgba(224, 170, 71, 0.18)` | `rgba(181, 134, 54, 0.12)` |
| `--artales-internal-nav-active-text` | `#76531b` | `#5f4318` |
| `--artales-internal-nav-hover-bg` | `rgba(181, 134, 54, 0.1)` | `rgba(255, 250, 240, 0.58)` |

The warmer, slightly deeper paper distinguishes the rail from the main
background. Darker ink and a clearer divider restore hierarchy. The active
state uses less gold opacity and stronger text, while hover lifts toward paper;
the two interaction states are visible without becoming large gold fills.

### Dark

| Token | Old | New |
| --- | --- | --- |
| `--artales-internal-text-muted` | `#d8cbb7` | `#e1d3bd` |
| `--artales-internal-text-subtle` | `#b7aa97` | `#c9baa4` |
| `--artales-internal-button-primary-bg` | `#0f1315` | `#191b1b` |
| `--artales-internal-button-primary-text` | `#fdf3e2` | `#f4e6d0` |
| `--artales-internal-button-primary-hover-bg` | `#272827` | `#252623` |
| `--artales-internal-nav-bg` | `#0f1315` | `#111516` |
| `--artales-internal-nav-border` | `rgba(220, 166, 69, 0.34)` | `rgba(224, 195, 142, 0.28)` |
| `--artales-internal-nav-text` | `#fdf3e2` | `#fff6e7` |
| `--artales-internal-nav-muted` | `#d8cbb7` | `#e4d5bf` |
| `--artales-internal-nav-active-bg` | `rgba(224, 170, 71, 0.16)` | `rgba(224, 170, 71, 0.14)` |
| `--artales-internal-nav-active-text` | `#e3aa46` | `#efc775` |
| `--artales-internal-nav-hover-bg` | `rgba(253, 243, 226, 0.08)` | `rgba(253, 243, 226, 0.1)` |

Brighter muted/subtle roles make intro and operational supporting copy easier to
scan. Navigation copy gains the same readability while the softer neutral-gold
divider and reduced active fill keep gold controlled. The primary action moves
closer to the dark card family and uses a softer cream label, reducing glare
without weakening its hierarchy or focus treatment.

## Contrast and expected visible effect

Solid foreground/background pairs retain strong readable separation: light nav
text is dark ink on warm paper, and dark nav text is pale cream on a night
surface. Muted roles remain visibly secondary rather than ghosted. Translucent
active and hover colors are intentionally surface effects; their text colors
carry the state readability. The CSS-controlled adaptive brand variant is not
changed, but its surrounding sidebar gains enough tonal definition for the logo
and adjacent title to read intentionally.

Shared dark `text-muted` and `text-subtle` changes can naturally improve forms,
table headings, empty states, and other internal supporting copy. Shared dark
primary-button changes affect existing internal member/account/admin form and
action selectors. These are expected, limited side effects; their selectors,
states, spacing, and behavior are untouched.

## Intentionally not changed

No layout, responsive geometry, component logic, TSX, routes, copy, i18n,
assets, or brand source changed. Forms, tables, lists, badges, and statuses were
not individually restyled. Public homepage/gallery/work-detail and Reader
styles are outside this pass. DB, env, Supabase, parser, pagination, access,
roles, editor, media, payments, credits, and ledger behavior remain untouched.

## Preview checklist

- [ ] Light/default member sidebar
- [ ] Light/default account sidebar
- [ ] Dark member sidebar
- [ ] Dark account sidebar
- [ ] Sidebar logo/brand visibility
- [ ] Sidebar title and subtitle/supporting text
- [ ] Navigation active state
- [ ] Navigation hover state
- [ ] Hero heading and intro paragraph
- [ ] Cards and buttons in both themes
- [ ] Forms remain readable
- [ ] Tables and statuses remain readable
- [ ] Desktop viewport
- [ ] Narrow/mobile quick check
- [ ] No Reader regression
- [ ] No public homepage regression

## Rollback

Revert the theme-tuning commit to restore the PR #125 token values and remove
this document and the unification follow-up note. No data, migration,
environment, asset, or deployment-order rollback is required.
