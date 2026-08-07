# ARTales public header brand + navigation refresh v0.1

## Scope and audit

- **Target:** `develop first`; this is a preview-only public-surface change.
- **Risk:** `low`; the patch changes one public brand call site and public-header CSS only.
- **DB:** `no`.
- **Env:** `no`.
- The public header is defined in `components/public/PublicHeader.tsx`. Its brand call site previously rendered `ArtalesBrand` in the default legacy mode with `variant="adaptive"`, `size="md"`, and `showMark`, composing the mark and wordmark WEBP files.
- `PublicHeader` is the public-site header used by the homepage, gallery/catalog, author, collection, work-detail, and other public routes. Protected account, member, admin, editor, and reader UI use separate components or brand call sites.
- Because `ArtalesBrand` is shared more broadly, its default remains `mode="legacy"`. Only the `PublicHeader` call site opts into `mode="lockup"`.

## Implementation

- The public-header call site now renders the approved adaptive runtime lockup through `ArtalesBrand mode="lockup"`, retaining the `ARTales` accessible label supplied by the component default.
- The homepage brand card remains unchanged and continues to use its existing large lockup call site.
- The public header is integrated with the Paper / Ink / Gold palette through semantic tokens. It uses a warm surface, a restrained gold divider, a bounded lockup width, and no added shadow.
- Updated selectors are limited to `.artales-public-header`, `.artales-public-header .artales-brand-link`, `.artales-public-header .artales-brand__wordmark`, `.artales-public-header__nav`, its direct public links, and the theme, locale, and primary-action controls inside that navigation. Dark-theme and mobile overrides use the same public-header scope.
- Public navigation links keep their current destinations and copy. Hover, keyboard focus, and current-page states use a calm gold underline; compact controls use the existing muted surface and semantic borders.
- Mobile lockup width is constrained with `clamp()` while the existing horizontal navigation scrolling remains intact, preventing cropping and avoiding a late layout-size change.

## Intentionally unchanged

- No brand masters, exports, runtime lockup SVG files, favicon/icon/PWA assets, manifest, or service worker were changed.
- No routes, navigation links, public copy, locale behavior, or theme behavior were changed.
- No reader, parser, account, member, admin, editor, internal UI, database, environment, Supabase, or package files/logic were changed.
- No global `ArtalesBrand` default or other consumer was changed.

## Preview checklist

- [ ] Homepage header at desktop width: approved lockup, balanced navigation, warm surface, subtle gold divider.
- [ ] Homepage header at mobile width: lockup is fully visible; navigation scrolls without page overflow.
- [ ] Gallery/catalog header.
- [ ] Work-detail header.
- [ ] Language switcher, including active and focus states.
- [ ] Theme switcher, including hover and focus states.
- [ ] Signed-out sign-in button; signed-in account/member action where available.
- [ ] Navigation hover, keyboard focus, and current-page underline states.
- [ ] Light theme.
- [ ] Dark theme.
- [ ] Adaptive/system initial theme and hydration: no visible layout shift.
- [ ] Public header requests the approved runtime SVG lockups and does not display the legacy WEBP composition.

## Rollback

Revert the patch commit. This restores the previous legacy public-header brand call and removes only the scoped public-header CSS overrides and this delivery note. No data, environment, asset, or migration rollback is required.
