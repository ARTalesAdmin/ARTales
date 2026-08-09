# ARTales internal zone: login readability and header alignment v0.1

## Scope and context

This develop-only visual follow-up addresses two manual-preview findings after
PR #129: muted login copy was invisible or nearly invisible in light mode, and
the internal account/member header still appeared to retain too much left inset
after removal of the sidebar mark. The public gallery header was already
correct and is intentionally outside this patch.

## Login readability root cause and fix

The semantic login rule grouped `.artales-auth-lede` and
`.artales-auth-note` inside `:where()`. Because `:where()` contributes zero
selector specificity, the earlier legacy class rules with translucent white
text won the cascade even though the token rule appeared later. That white text
had insufficient contrast on the light auth card.

The follow-up replaces that zero-specificity group with the direct
`.artales-auth-lede` and `.artales-auth-note` class selectors. Both now resolve
to `--artales-internal-text-muted`. The more specific muted invitation note
continues to resolve to `--artales-internal-text-subtle`; the heading continues
to use `--artales-internal-heading`; labels use `--artales-internal-text`; and
links and the restrained kicker retain their existing internal semantic
mappings. No `!important` declaration was added.

This makes the intro paragraph, “New reader?” copy, account link context,
invitation note, forgot-password link, and form labels readable without text
selection in light mode. Dark mode is preserved because the same selectors
resolve through the existing explicit dark internal-token mappings.

## Header and navigation alignment

Only the direct `.artales-public-header` child of `.artales-app-shell` or
`.artales-workspace-shell` receives the tighter responsive inline inset. It now
uses `clamp(14px, 1.5vw, 18px)` instead of `clamp(18px, 2vw, 24px)`. This removes
the remaining visual impression of reserved sidebar-mark space while retaining
responsive breathing room and the global ARTales logo.

The selector does not match the public shell, including `/gallery`, so public
header alignment and mobile public navigation remain unchanged. The login page
has no public header; its centered auth card and approved adaptive runtime brand
remain unchanged.

## Intentionally unchanged

- Authentication actions, form submission, redirect behavior, and routes.
- Supabase, database, environment, access, role, payment, and business logic.
- Login copy, i18n dictionaries, package files, public assets, and brand assets.
- Public homepage, gallery, work-detail, and other public layouts or selectors.
- Reader, parser, pagination, editor blocks, and media-upload behavior.
- Existing light/dark semantic token values and adaptive brand selection.

## Preview checklist

- [ ] `/login` in light mode: intro is readable without selection.
- [ ] `/login` in light mode: forgot-password link is readable.
- [ ] `/login` in light mode: “New reader?” and create-account link are readable.
- [ ] `/login` in light mode: invitation note and form labels are readable.
- [ ] `/login` in dark mode: all copy, links, labels, and adaptive brand remain readable.
- [ ] Login submission, validation, redirect, and forgot-password navigation are unchanged.
- [ ] `/member`, `/member/authors/new`, and `/member/works` on desktop.
- [ ] Internal header/nav left alignment no longer suggests reserved logo space.
- [ ] Public `/gallery` header and global ARTales logo are unchanged.
- [ ] Reader is unchanged.
- [ ] Narrow/mobile quick check for login and internal header navigation.

## Risk, target, DB, and environment

- **Risk:** low — two narrowly scoped CSS declaration changes plus documentation.
- **Target:** develop first.
- **DB:** no.
- **Env:** no.

## Rollback

Revert the single follow-up commit. This restores the previous internal header
inset and the zero-specificity grouped login text rule. No database, asset,
environment, authentication, or content rollback is required.
