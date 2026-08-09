# ARTales internal zone: editor, login, alignment, and field clarity v0.1

## Scope and context

This develop-only follow-up responds to the manual preview after PR #128. The
internal direction and shell seams were working well, but the sidebar retained
top spacing from its removed logo, the login surface still used a static dark
presentation and legacy wordmark treatment, editor introductions did not read
as panels, and light form fields were too close to their surrounding surfaces.

The patch is visual only. It does not change authentication, login submission,
routes, navigation targets, editor workflows, uploads, payments, data, roles,
Supabase, environment variables, packages, public assets, or brand masters.

## Decisions

### Internal header and navigation alignment

- The internal-only public header inset now uses a small responsive clamp. The
  public header outside `.artales-app-shell` and `.artales-workspace-shell` is
  untouched.
- The member sidebar starts slightly closer to the shell edge and its title no
  longer keeps the former logo's top margin. Existing responsive grid and
  mobile navigation behavior remain unchanged.

### Adaptive login theme and brand

- `/login` now consumes the internal background, surface, border, elevation,
  text, form, focus, button, and state tokens instead of fixed dark colors.
- The login brand uses the existing `ArtalesBrand` adaptive approved lockup.
  Its built-in light/dark variants follow `data-artales-theme`; no logo was
  recreated and no asset was added or edited.
- Form action, hidden redirect value, labels, copy, links, validation attributes,
  and authentication actions are unchanged.

### Editor hero framing and field clarity

- In member content, an editor introduction with the direct-child structure
  `p + h1` receives a warm surface, semantic panel border, responsive padding,
  and panel shadow. This matches the existing `ARTales · Editor` headers without
  adding route-specific classes or changing their copy.
- The light internal form border token is a little warmer and stronger so
  inputs, textareas, and selects remain distinct from paper panels without a
  harsh black edge.
- The dark form border shifts to a restrained gold alpha. The dark panel border
  is slightly calmer, while focus borders and rings remain intentionally clear.

## Changed selectors and components

- `app/login/page.tsx`: `ArtalesBrand` now uses `variant="adaptive"` and
  `mode="lockup"`.
- `app/globals.css`:
  - internal/auth-scoped `.artales-auth-*` selectors;
  - internal shell header selector scoped through `.artales-app-shell` and
    `.artales-workspace-shell`;
  - `.artales-member-sidebar` and `.artales-member-sidebar__title`;
  - `.artales-member-content section:has(> p:first-child + h1)`;
  - narrow/mobile auth sizing.

No public gallery or Reader selector was changed.

## Changed tokens

- Light `--artales-internal-form-border`: stronger warm/brown alpha.
- Dark `--artales-internal-form-border`: restrained gold/paper alpha.
- Dark `--artales-internal-panel-border`: reduced alpha to calm panel and icon
  edge glare.

There are no new token aliases and no circular variable references.

## Preview checklist

- [ ] `/login` in light mode.
- [ ] `/login` in dark mode.
- [ ] Adaptive login lockup in both themes.
- [ ] Login fields, focus states, alerts, success state, and links in both themes.
- [ ] Login submission and redirect behavior unchanged.
- [ ] `/member`, `/member/works`, and `/member/tags`.
- [ ] `/member/authors/new` in light and dark mode.
- [ ] `/member/works/new`, if accessible, in light and dark mode.
- [ ] Editor introduction panel in both themes.
- [ ] Input, select, and textarea boundaries in both themes.
- [ ] Internal header/sidebar alignment on desktop.
- [ ] Internal header/sidebar and login at narrow/mobile width.
- [ ] Public `/gallery` header unchanged.
- [ ] Reader unchanged.

## Risk, target, DB, and environment

- **Risk:** medium — scoped runtime visual-system changes require light/dark,
  desktop/mobile, and authenticated preview checks.
- **Target:** develop first.
- **DB:** no.
- **Env:** no.

## Rollback

Revert the single commit for this patch. That restores the previous login brand
props, static login styling, sidebar/header spacing, form and panel token values,
and unframed editor introductions. No data, asset, configuration, or schema
rollback is required.

## Follow-up after PR #129

Manual light-mode preview exposed a cascade-specificity issue in the login
intro and note text: the semantic token rule used `:where()`, so the earlier
legacy class rules could remain authoritative. The focused follow-up maps those
classes directly to the internal muted-text token and slightly tightens the
existing internal-only header inset. Dark-mode token mappings, the adaptive
login brand, public headers, authentication behavior, and all editor behavior
remain unchanged. See
`ARTALES_INTERNAL_ZONE_LOGIN_READABILITY_HEADER_ALIGNMENT_V0_1.md` for the
preview and rollback checklist.
