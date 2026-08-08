# ARTales Reader brand mark alignment v0.1

## Summary

The Reader toolbar now opts into the approved ARTales primary logo lockup instead
of composing the legacy WEBP mark and wordmark. This is a Reader-scoped runtime
alignment required before the Reader visual refresh is considered for promotion
from `develop` to `main`; it is not a production promotion or approval to merge.

## Old reader mark source found

`components/reader/ReaderToolbar.tsx` rendered `ArtalesBrand` with `showMark` and
the component's default `legacy` mode. That path composed these legacy assets:

- `/brand/artales-mark-dark.webp` with `/brand/artales-wordmark-dark.webp` for
  the light and script Reader themes;
- `/brand/artales-mark-light.webp` with `/brand/artales-wordmark-light.webp` for
  the dark Reader theme.

No direct legacy image path was present in `ReaderClient.tsx`, the Reader route,
or Reader CSS. The legacy selection happened indirectly through the shared
component's default mode.

## Approved runtime asset used

The Reader call site now selects `mode="lockup"`. It uses only the controlled
runtime copies already delivered and approved for runtime use:

- `public/brand/artales-logo-primary-light.svg` on light and script Reader
  toolbar surfaces;
- `public/brand/artales-logo-primary-dark.svg` on the dark Reader toolbar
  surface.

These files are byte-for-byte runtime copies of the approved v0.1 primary
exports, with provenance and hashes recorded in
`docs/ARTALES_RUNTIME_LOGO_LOCKUP_DELIVERY_V0_1.md` and the brand registry. This
change neither creates artwork nor edits a runtime SVG, source export, or master.

## Theme handling

Reader theme selection is independent of the site's global theme. The shared
brand component therefore keeps its existing adaptive behavior for the homepage
and public header, while its lockup mode can now honor an explicit non-adaptive
`variant`. The Reader's existing theme mapping supplies the dark-wordmark
primary-light lockup for light/script and the gold-wordmark primary-dark lockup
for dark.

The Reader-scoped CSS constrains the complete lockup to `116px` on wider
toolbars and `104px` at the existing narrow breakpoint. No color, spacing,
control, or typography token was changed.

## Intentionally not changed

- Reader settings, focus mode, progress, bookmark, layout, parser, pagination,
  access, and entitlement behavior.
- Reader palette beyond the logo asset itself.
- Homepage/public header logo calls and their adaptive theme behavior.
- Favicons, app/PWA icons, manifests, service-worker paths, or cached assets.
- Brand masters, source exports, runtime SVG contents, generated outputs, or
  registry status.
- Routes, shared content renderer, global CSS, i18n, DB, environment, Supabase,
  dependencies, or package files.

## Delivery metadata

- **Changed files:** `components/reader/ReaderToolbar.tsx` selects the approved
  lockup; `components/brand/ArtalesBrand.tsx` supports explicit lockup variants;
  `components/reader/reader.css` applies restrained Reader-only sizing; this
  document records provenance, scope, preview, and rollback.
- **Risk:** `high` because the Reader is a critical user path, although this is
  an isolated presentation change with no Reader behavior or data impact.
- **Target:** `develop first` for sandbox preview before any separately approved
  production promotion.
- **DB:** `no`.
- **Env:** `no`.

## Preview checklist

- [ ] Reader light toolbar uses the approved primary-light lockup.
- [ ] Reader script toolbar uses the approved primary-light lockup.
- [ ] Reader dark toolbar uses the approved primary-dark lockup.
- [ ] Desktop Reader lockup is calm, legible, and does not crowd the work title.
- [ ] Narrow/mobile Reader toolbar remains aligned without overflow.
- [ ] Homepage and public header remain visually unchanged in light and dark.
- [ ] Favicon and app/PWA icons remain unchanged.
- [ ] No brand master or source export changes are present in the diff.

## Rollback path

Revert the alignment commit. This restores the Reader call site's legacy
`showMark` composition, removes explicit static lockup selection from the shared
component, and removes the Reader-only lockup sizing and this record. No asset,
cache, database, environment, or irreversible rollback step is required. After
rollback, preview the light, script, and dark Reader toolbars and confirm the
homepage/public header remains unchanged.
