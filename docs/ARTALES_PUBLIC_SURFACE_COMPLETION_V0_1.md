# ARTales public surface completion v0.1

## Scope and target

- **Target:** `develop first` / Vercel preview only. This patch is not approval to promote or merge into `main`.
- **Risk:** `medium` because one scoped CSS pass aligns several public routes and both themes. No business logic is changed.
- **DB:** `no`.
- **Env:** `no`.

## Manual preview findings

The previous public pass established the intended Paper / Ink / Gold direction on the homepage, header, gallery, and work detail. The remaining review found a visually abrupt header-to-home-hero boundary, overly generous vertical gaps between homepage sections, and older white/grey or low-contrast treatments on informational and checkout surfaces. The gallery card typography and approved homepage copy were explicitly left outside this patch.

## Public route audit

| Route | Route/component | Main hooks | Public shell/header | Finding and handling |
| --- | --- | --- | --- | --- |
| `/` | `app/page.tsx` | `.artales-home-shell`, `.artales-home-main`, `.artales-home-hero`, section classes | Yes | Header transition and section rhythm needed refinement; CSS only. |
| `/credits` | `app/credits/page.tsx` | `.artales-legal-main`, `.artales-credits-story`, account-model/panel hooks | Yes | Cards inherited older account surface recipes; public-shell-scoped token overrides added. |
| `/roadmap` | `app/roadmap/page.tsx` | `.artales-legal-main`, `.artales-menu-roadmap`, `.artales-roadmap-wishlist` | Yes | Roadmap cards and wishlist needed explicit light/dark public treatment. This is the current “What’s next / Co se chystá” route. |
| `/hall` | `app/hall/page.tsx` | `.artales-legal-main`, `.artales-hall-article`, account-model/panel hooks | Yes | Hall panels shared older account styling; public-only overrides added. |
| `/legal` | `app/legal/page.tsx` | `.artales-legal-main`, `.artales-legal-hero`, `.artales-legal-grid` | Yes | Info cards used translucent generic white and lacked a complete dark treatment. |
| `/legal/contact` | `app/legal/contact/page.tsx` | `.artales-legal-main`, `.artales-legal-article`, `.artales-legal-contact` | Yes | Article prose and links now follow public theme tokens. |
| `/legal/editions` | `app/legal/editions/page.tsx` | `.artales-legal-main`, `.artales-legal-article` | Yes | Article surface and prose aligned through shared public legal selectors. |
| `/legal/privacy` | `app/legal/privacy/page.tsx` | `.artales-legal-main`, `.artales-legal-article` | Yes | Article surface and prose aligned through shared public legal selectors. |
| `/legal/terms` | `app/legal/terms/page.tsx` | `.artales-legal-main`, `.artales-legal-article` | Yes | Article surface and prose aligned through shared public legal selectors. |
| `/checkout/credits` | `app/checkout/credits/page.tsx` | `.artales-checkout-coming-soon`, `.artales-credit-checkout`, package/panel hooks | Yes; authenticated entry | Credit selection cards, form controls, prose, and status panel aligned without touching purchase logic. |
| `/checkout/support` | `app/checkout/support/page.tsx` | `.artales-checkout-coming-soon`, `.artales-credit-checkout`, package/panel hooks | Yes; authenticated entry | Public support selection receives the same scoped palette treatment. |
| `/checkout/qr` | `app/checkout/qr/page.tsx` | `.artales-checkout-qr`, `.artales-qr-payment-*`, account-panel hooks | Yes; authenticated/order-bound entry | Payment summary, instruction panels, and muted prose aligned in both themes. The QR image retains its intentionally white backing for scan reliability. |
| `/checkout/coming-soon` | `app/checkout/coming-soon/page.tsx` | Redirect only | No rendered shell | Audited; it redirects to `/checkout/credits`, so no visual surface is rendered or changed. |

No separate `/whats-next` or `/info` page exists in the current route tree; their live equivalents are `/roadmap` and `/legal`. Account credit, membership, member, admin, editor, reader, and internal surfaces were audited only to ensure the new selectors do not target them.

## Header-to-hero transition

The homepage header now fades from the theme-appropriate surface into the page rather than ending as a solid bar. Its heavy boundary is removed only inside `.artales-home-shell`; the header remains readable and the global public header structure, navigation, routes, and logo assets remain unchanged. Dark mode uses the same relationship with the inverse semantic surfaces.

## Homepage spacing

The homepage keeps its existing component order and layouts. Desktop and fluid breakpoints now use moderately smaller top padding, hero-to-feature spacing, inter-section gaps, final CTA gap, and bottom padding. The mobile override retains readable 32px section separation and a slightly shorter page opening without making cards or copy denser.

## Light and dark palette completion

The completion rules are scoped below `.artales-public-shell`. In light mode, informational articles, cards, Hall/Credits/Roadmap panels, credit packages, checkout panels, labels, prose, and form controls use the existing page, surface, muted-surface, text, gold, and border tokens. In dark mode, these same surfaces use the inverse/deep inverse backgrounds, inverse text, gold labels/links, and gold-aware borders. This removes the remaining generic translucent white cards and prevents inherited dark text or low-contrast prose on dark public pages.

Shared `.artales-account-*` hooks are changed only when they are descendants of `.artales-public-shell`. Account, member, admin, editor, and other internal shells therefore retain their current styles.

## Sales and credit flow handling

Only presentation selectors are affected. No package definitions, amounts, order actions, QR generation, account requirements, authentication, payment status handling, AT credit behavior, Supabase code, or redirects changed. The checkout route components already exposed adequate hooks, so no TSX edits were required.

## Favicon verification

`app/layout.tsx` still declares `/favicon.ico`, the 16px, 32px, and 48px PNG favicons, `/apple-touch-icon-180x180.png`, and the ICO shortcut. Those files remain present under `public/`, while the root app icon remains available for Next.js. `public/manifest.webmanifest` remains referenced and untouched. No mismatch requiring an asset or metadata change was found.

## Intentionally not changed

- Homepage or public i18n copy, including both public dictionaries.
- Gallery card typography or gallery structure.
- Work-detail behavior and its existing dark contrast correction.
- Reader CSS, variables, parser, or pagination.
- Account/member/admin/editor/internal styling or logic.
- Purchase, payment, credit, membership, authentication, DB, Env, or Supabase logic.
- Package files, brand masters/exports, runtime logo SVGs, favicons/icons/PWA assets, manifest, or service worker.
- The intentionally white QR-code image backing needed for dependable scanning.

## Preview checklist

- [ ] Homepage light: header-to-hero transition is soft but navigation remains distinct.
- [ ] Homepage light: section rhythm is tighter without feeling cramped.
- [ ] Homepage dark: transition, spacing, text, cards, and actions remain legible.
- [ ] Public header/nav in light and dark, including mobile horizontal navigation.
- [ ] AT Credits (`/credits`) in light and dark.
- [ ] Credit selection (`/checkout/credits`) in light and dark with an eligible account.
- [ ] Direct support (`/checkout/support`) in light and dark with an eligible account.
- [ ] QR purchase instruction (`/checkout/qr?order=…`) in light and dark with a valid test order.
- [ ] What’s next / Co se chystá (`/roadmap`) in light and dark.
- [ ] ARTales Hall / Síň ARTales (`/hall`) in light and dark.
- [ ] Info index and all `/legal/*` child pages in light and dark.
- [ ] Gallery/catalog typography is unchanged; cards are unchanged or improved by inherited shell continuity.
- [ ] Work detail retains its corrected dark prose contrast.
- [ ] Mobile homepage and mobile public informational pages preserve readable spacing.
- [ ] No layout shift during theme switching or navigation.
- [ ] No copy changes.

## Rollback path

Revert the single public-surface completion commit (or remove the final `ARTales public surface completion v0.1` block from `app/globals.css` and this audit document). No database, environment, content, payment, or asset rollback is required. After rollback, smoke-test `/`, `/credits`, `/roadmap`, `/hall`, `/legal`, and the three checkout surfaces in the `develop` preview.

