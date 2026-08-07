# ARTales homepage brand-card alignment v0.1

## Decision and resolution

PR #97 deferred the homepage brand-card replacement. Although approved lockup
masters and v0.1 SVG exports existed, none had an explicitly approved,
auditable public runtime path for homepage use. The safe audit result was to
leave the existing separately composed legacy WEBP mark and wordmark in place.

This develop-first delivery resolves that blocker. The approved primary-light
and primary-dark SVG exports are copied byte-for-byte into controlled public
runtime paths, recorded in the brand registry, and selected by an opt-in
homepage-only lockup mode. The detailed provenance and validation record is in
`docs/ARTALES_RUNTIME_LOGO_LOCKUP_DELIVERY_V0_1.md`.

## Homepage integration

The public homepage brand card in `app/page.tsx` now renders:

```tsx
<ArtalesBrand href="" variant="adaptive" size="lg" mode="lockup" />
```

The narrow `lockup` mode in `components/brand/ArtalesBrand.tsx` uses:

- `public/brand/artales-logo-primary-light.svg` on the light/surface card;
- `public/brand/artales-logo-primary-dark.svg` on the dark card selected by the
  existing adaptive theme behavior.

The visible logo retains the alternative text `ARTales`. The mode is opt-in, so
the navbar and every other existing `ArtalesBrand` consumer continue to use
their prior treatment. Homepage copy, card structure, palette, and theme
control are unchanged.

## Approved delivery sources

- `brand/artales/exports/v0.1/primary-light/artales-logo-primary-light.svg`
- `brand/artales/exports/v0.1/primary-dark/artales-logo-primary-dark.svg`

The locked masters remain identity sources and are not modified. The runtime
SVGs are exact copies of the approved exports rather than new exports or edited
artwork.

## Excluded assets and surfaces

Legacy public WEBP logo/mark/wordmark files are not treated as the approved
lockup. Review-only boards and rejected, generative, or candidate assets remain
excluded. No favicon, icon, PWA, manifest, service worker, reader, admin,
editor, member, account, database, environment, Supabase, or package change is
part of this alignment.

## Delivery metadata

- **Risk:** `low` — isolated homepage rendering and exact copies of approved
  SVG exports.
- **Target:** `develop first` — preview only; no `main` promotion is implied.
- **DB:** `no`.
- **Env:** `no`.
- **Public asset impact:** `yes`.

## Rollback path

Revert the runtime-lockup delivery commit. This restores the homepage card's
prior adaptive legacy mark/wordmark composition and removes the public copies,
registry delivery record, opt-in component mode, and delivery documentation.
No data, environment, manifest, or cache rollback is required.

## Test checklist

- [x] Deliver exact primary-light and primary-dark export bytes to public paths.
- [x] Record source paths, runtime paths, hashes, scope, and impact flags.
- [x] Verify each source/runtime pair with SHA-256 and byte comparison.
- [x] Limit the new lockup mode to the homepage call site.
- [x] Preserve adaptive light/dark rendering and alternative text `ARTales`.
- [x] Leave excluded assets and out-of-scope surfaces unchanged.
- [ ] Verify light and dark homepage presentations in develop preview.
- [ ] Verify desktop and mobile sizing in develop preview.
