# ARTales homepage brand-card alignment v0.1

## Decision

The homepage brand-card replacement is **deferred**. The repository contains an
approved ARTales lockup master and approved SVG export profiles, but those files
are explicitly recorded as review/library artifacts rather than runtime assets.
No approved, runtime-ready logo lockup with documented provenance is currently
available for the homepage. Reusing an older public image or copying a controlled
master/export into runtime would exceed this audit's approval boundary.

The homepage implementation is therefore unchanged. This is the safe outcome:
it avoids presenting an older or unregistered image as the approved lockup and
does not silently promote a brand master, export, icon, or candidate into a new
runtime use.

## Current homepage brand-card source

`app/page.tsx` renders the card with:

```tsx
<ArtalesBrand href="" variant="adaptive" size="lg" showMark />
```

`components/brand/ArtalesBrand.tsx` does not use a single approved lockup. For
the adaptive treatment it composes two separate raster images for each theme:

- light-surface treatment: `public/brand/artales-mark-dark.webp` plus
  `public/brand/artales-wordmark-dark.webp`;
- dark-surface treatment: `public/brand/artales-mark-light.webp` plus
  `public/brand/artales-wordmark-light.webp`.

The homepage card is the only audited presentation in this change. The shared
brand component is also used elsewhere, including protected or otherwise
out-of-scope surfaces, so it was not modified.

## Approved asset candidates found

### Approved identity sources, not runtime-ready

- `brand/artales/masters/logo-lockup/artales-lockup-light.master.v1.svg` and
  `brand/artales/masters/logo-lockup/artales-lockup-dark.master.v1.svg` are the
  locked light and dark lockup masters recorded in the brand registry.
- `brand/artales/exports/v0.1/primary-light/artales-logo-primary-light.svg` and
  `brand/artales/exports/v0.1/primary-dark/artales-logo-primary-dark.svg` are
  the corresponding approved-profile SVG library exports.

These are the correct approved identity candidates, but their metadata and
documentation explicitly say that they are not public/runtime integrations.
They cannot be referenced from `public/`, copied, or promoted by implication in
this narrowly scoped homepage audit.

### Approved runtime assets, not suitable lockups

The registry records the ARTales favicon and application-icon set under
`public/` as approved runtime assets. Those are small-size icon artifacts for
browser and PWA contexts, not a homepage logo lockup. Using one in the brand
card would change the approved usage context and would not supply the ARTales
wordmark.

### Existing legacy public images

The repository also contains `public/brand/artales-logo-dark.webp` and
`public/brand/artales-logo-light.webp`. They are not referenced by current app
code, are not included in the registry's approved runtime icon set, and have no
record connecting them to the locked v1 lockup masters or approved v0.1 export
profiles. The separately rendered mark and wordmark WEBP files have the same
provenance gap. Their location under `public/` alone is not sufficient approval,
so none of these images is treated as the safe replacement.

Review-only and generative candidates under `brand/artales/**/candidates/` were
excluded and must not be used for runtime alignment.

## Replacement status

**Deferred; no runtime reference or style was changed.** A future, explicitly
approved runtime asset delivery should export the locked light/dark v1 lockups
to a supported public format, record source/version/checksums and intended
homepage usage in the controlled registry, and only then switch the homepage
brand card in a small preview-first PR.

## Files changed

- `docs/ARTALES_HOMEPAGE_BRAND_CARD_ALIGNMENT_V0_1.md` — records the audit,
  candidates, blocker, decision, expected impact, and rollback.

No component, CSS, brand master/export, generated asset, public asset, icon,
manifest, service worker, reader, admin/editor/member/account, database,
environment, Supabase, or package file is changed.

## Visual impact expected

None. The homepage brand card continues to render its existing adaptive,
separately composed mark and wordmark treatment. This audit makes no claim that
the current treatment is aligned with the approved v1 lockup; it records why a
safe replacement cannot yet be made.

## Delivery metadata

- **Risk:** `low` — documentation-only audit; runtime behavior is unchanged.
- **Target:** `develop first` — audit outcome for review; no production
  promotion or merge is implied.
- **DB:** `no`.
- **Env:** `no`.

## Rollback path

Revert the documentation commit or remove this file. There is no runtime, data,
environment, package, public-asset, cache, or generated-artifact rollback step.

## Test checklist

- [x] Confirm the homepage brand-card call site and adaptive image composition.
- [x] Search runtime references and controlled brand records for approved
  ARTales logo/lockup assets.
- [x] Confirm approved lockup masters and SVG exports are not marked for
  public/runtime integration.
- [x] Confirm approved runtime icons are limited to icon/PWA contexts and are
  not homepage lockups.
- [x] Leave runtime implementation and styling unchanged because no safe
  approved runtime lockup exists.
- [x] Confirm no brand master, export, generated/rejected asset, public asset,
  DB, Env, Supabase, package, manifest, service worker, or out-of-scope UI file
  changed.
- [x] Run `git diff --check`.
- [ ] Browser screenshot — not required because there is no perceptible runtime
  change.
