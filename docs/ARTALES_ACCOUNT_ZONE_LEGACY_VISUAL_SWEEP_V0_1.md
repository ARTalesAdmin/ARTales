# ARTales account-zone legacy visual sweep v0.1

## Summary and production smoke findings

This is a post-production, develop-first visual sweep of the reader-facing account zone after the ARTales visual rebrand promotion. Production smoke testing found the public pages healthy, but `/account/membership` retained a duplicate legacy ARTales brand block in the shared account sidebar. The shared account styles also left several nested community and membership surfaces unusually pale in dark mode.

## Account pages inspected

- `/account`
- `/account/library`
- `/account/credits`
- `/account/profile`
- `/account/security`
- `/account/settings`
- `/account/community`
- `/account/membership`
- the shared `AccountNav` and account shell styles

## Changes

### Legacy sidebar logo

`components/account/AccountNav.tsx` rendered `ArtalesBrand` above the existing account eyebrow and hint. That duplicate sidebar brand markup and its import were removed. The global public header remains responsible for the ARTales logo; the sidebar keeps its existing text identity and navigation copy.

### Sidebar and account surfaces

- Removed the obsolete spacing left above the account eyebrow and added a token-based keyboard focus ring to account navigation links.
- Kept sidebar backgrounds, borders, text, hints, hover states, and emphasis states on the existing internal navigation tokens, so light mode remains light and dark mode remains restrained.
- Mapped account-scoped community rows, empty states, model/flow cards, role steps, and membership status cards to internal surface, border, and text tokens.
- Mapped membership price pills, account badges, and roadmap/status pills to internal badge tokens.
- Mapped account and community form fields to internal form tokens, including their focus state.
- Kept the community membrane and membership note on the standard account surface. The two `!important` declarations are narrowly scoped and are required to override earlier legacy account rules that already use `!important`.

## Light and dark handling

No fixed light or dark palette was added. All new visual declarations resolve through the promoted `--artales-internal-*` theme tokens. Light mode therefore uses calm warm paper/brown framing, while dark mode uses muted dark surfaces and restrained gold-alpha borders without glowing or harsh outlines.

## Intentionally unchanged

- Public homepage, gallery, authors, collections, work detail, credits information, top-up, QR payment, and support styles
- Global header logo and all public/brand assets
- Reader, parser, pagination, editor/admin blocks, and member-zone layout
- Media upload, payments, ledger, AT credits, membership, access/role, authentication, i18n, Supabase, DB, environment, and package behavior
- Typography, page layout, responsive structure, routes, and copy

## Preview checklist

- [ ] `/account` — light and dark
- [ ] `/account/library` — light and dark
- [ ] `/account/credits` — light and dark
- [ ] `/account/profile` — light and dark
- [ ] `/account/security` — light and dark
- [ ] `/account/settings` — light and dark
- [ ] `/account/community` — light and dark; submission/status rows are readable and not pale gray
- [ ] `/account/membership` — light and dark; cards, prices, pills, and status cards are readable without glare
- [ ] Account sidebar has no duplicate logo; all links remain readable
- [ ] Global top-header logo is unchanged
- [ ] Desktop and narrow/mobile account navigation
- [ ] Public `/gallery` and one work-detail page are unchanged
- [ ] Reader is unchanged
- [ ] Internal editor/member pages are unchanged

## Risk, target, DB, and environment

- **Risk:** low — narrowly scoped CSS and removal of duplicate presentational markup only
- **Target:** develop first
- **DB:** no
- **Env:** no

## Rollback

Revert the single sweep commit. This restores the `ArtalesBrand` import and sidebar block and removes the account-scoped token overrides. There are no data, environment, asset, or irreversible steps.
