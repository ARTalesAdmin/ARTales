# ARTales internal zone header navigation alignment v0.1

## Summary

The manual `develop` preview after the internal visual refresh and the login light-mode readability follow-up showed that the shared header navigation still began too far to the right in the member and account workspaces. Once sidebar branding was removed or moved, the full-width internal header made the unused space between the ARTales brand and the first navigation link particularly visible.

This patch is a narrowly scoped, CSS-only alignment correction for the internal header. It does not change the shared header component, its content, or any route behavior.

## Selectors inspected

- `.artales-public-header`
- `.artales-public-header__inner` (not present in the current implementation)
- `.artales-public-nav` (not present; the current navigation hook is `.artales-public-header__nav`)
- `.artales-public-brand` (not present; branding uses `.artales-brand-link` and `.artales-brand`)
- `.artales-public-header__nav`
- `.artales-brand-link`, `.artales-brand`, and `.artales-brand__wordmark`
- `.artales-member-shell` and `.artales-member-shell--embedded`
- `.artales-account-shell` and `.artales-account-shell--embedded`
- `.artales-app-shell`
- `.artales-workspace-shell`
- `.artales-auth-shell`
- the internal header overrides introduced by the shell seam and editor/login alignment work

## Selectors changed

Only direct-child headers and navigation inside `.artales-app-shell` or `.artales-workspace-shell` are adjusted, and only above the existing `860px` compact-header breakpoint:

- The internal `.artales-public-header` uses `justify-content: flex-start` and a bounded responsive gap.
- The internal `.artales-public-header__nav` grows into the remaining row, starts its links at the left, and permits safe flex sizing with `min-width: 0`.
- The existing theme toggle receives `margin-inline-start: auto`, keeping the theme, language, and account/member controls grouped toward the right without changing their order.

No `!important` declaration or new color/token was added.

## Why public `/gallery` is unaffected

Public pages render the header as a child of `.artales-public-shell`. The new rules require the header to be a direct child of `.artales-app-shell` or `.artales-workspace-shell`, which are the wrappers used by account and member layouts. Therefore `/gallery`, the homepage, author and collection pages, and work-detail pages retain the existing public header alignment.

## Responsive behavior

### Desktop and medium widths

Above `860px`, the first navigation link follows the unchanged ARTales brand with a `12px` to `20px` responsive gap instead of allowing full-width `space-between` distribution to create a large empty region. The navigation can still flex and wrap if content pressure requires it. The theme toggle's automatic inline-start margin consumes remaining space before the control group, so theme, locale, and account/member controls remain right-aligned.

### Narrow and mobile widths

At `860px` and below, none of the new alignment declarations apply. The existing compact header remains a single-column grid with a horizontally scrollable navigation row. This avoids collisions with the logo and preserves established narrow/mobile behavior.

The login page currently uses `.artales-auth-shell` and an auth card rather than the shared top header. It is therefore intentionally unchanged by this header-only correction; its adaptive theme and authentication behavior remain as they were after the latest readability fix.

## Intentionally unchanged

- ARTales brand dimensions and assets
- navigation order, labels, links, and behavior
- public header alignment and navigation behavior
- language, theme, account, and member controls
- login/authentication UI and behavior
- Reader, parser, pagination, and editor block logic
- media upload, payment, ledger, access, role, and other business logic
- i18n, database, environment, Supabase, package, and asset files
- colors, cards, forms, sidebars, tables, and unrelated visual polish

## Preview checklist

- [ ] `/member` desktop: navigation starts noticeably closer to the brand
- [ ] `/member/works` desktop
- [ ] `/member/authors/new` desktop
- [ ] `/login` desktop: unchanged and readable
- [ ] `/gallery` desktop: unchanged
- [ ] language/theme/account buttons remain aligned
- [ ] ARTales logo remains unchanged
- [ ] medium and narrow viewport quick check
- [ ] dark mode is visually unchanged except for internal desktop alignment
- [ ] no Reader regression

## Risk and release target

- Risk: `low`
- Target: `develop first`
- DB: `no`
- Env: `no`

## Rollback

Revert the commit containing this patch, or remove the `@media (min-width: 861px)` internal header block from `app/globals.css`. No data, environment, component, or route rollback is required.
