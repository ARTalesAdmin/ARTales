# ARTales runtime logo lockup delivery v0.1

## Delivery decision

PR #97 audited the homepage brand card but deferred replacement because the
approved lockup masters and SVG exports were controlled identity-library files,
not approved public/runtime homepage assets. This delivery closes that recorded
gap explicitly: it copies the approved v0.1 SVG exports byte-for-byte to public
runtime paths, records their provenance, and uses them only in the public
homepage brand card on the `develop` preview.

PR #96 supplied the approved public palette used by the surrounding homepage
surface. This change does not alter that palette or redesign the card.

## Controlled source and runtime paths

| Surface | Approved source export | Public runtime copy | SHA-256 |
| --- | --- | --- | --- |
| Light background | `brand/artales/exports/v0.1/primary-light/artales-logo-primary-light.svg` | `public/brand/artales-logo-primary-light.svg` | `2622a8df14ce6ba5c84a05e425edc546743bb431c9309cb8b5bc3eb3599d619a` |
| Dark background | `brand/artales/exports/v0.1/primary-dark/artales-logo-primary-dark.svg` | `public/brand/artales-logo-primary-dark.svg` | `8ccc089488a8d00f90ab83075906bb6d23eb382b07f145dde1c3bd4ac110d301` |

The source and runtime file in each row have the same SHA-256 digest and pass a
byte-for-byte `cmp` check. The delivery uses direct file copies; no SVG content
was redrawn, simplified, regenerated, or manually edited. Masters and source
exports remain unchanged.

## Homepage usage

The homepage brand-card call site selects the narrow `lockup` mode on
`ArtalesBrand`. That mode renders the primary-light runtime lockup on the normal
light/surface card and switches to the primary-dark runtime lockup when the
existing adaptive theme selects a dark surface. The visible image retains the
accessible alternative text `ARTales`.

The mode is opt-in at the homepage call site. Existing navbar, reader,
admin/editor/member/account, authentication, cover-placeholder, and all other
`ArtalesBrand` consumers retain their prior rendering. Card copy, structure,
palette, and theme controls are unchanged.

## Explicit exclusions

This delivery does not use or change:

- lockup masters or any brand export source in place;
- legacy WEBP logo, mark, or wordmark files;
- rejected, generative, candidate, review-board, or overview assets;
- favicon, icon, PWA, manifest, or service-worker assets or wiring;
- reader CSS or admin/editor/member/account UI;
- database, environment, Supabase, dependency, or package files.

## Delivery metadata

- **Risk:** `low` — isolated, opt-in homepage logo rendering plus exact public
  copies of approved exports.
- **Target:** `develop first` — preview only; no automatic `main` promotion.
- **DB:** `no`.
- **Env:** `no`.
- **Public asset impact:** `yes`.

## Rollback path

Revert this delivery commit. That restores the homepage call site to its prior
adaptive legacy mark/wordmark composition, removes the opt-in lockup mode and
the two public SVG copies, and removes the registry/delivery documentation.
There is no data, environment, cache-manifest, or irreversible rollback step.

## Preview checklist

- [ ] Confirm the light homepage card shows the primary-light ARTales lockup.
- [ ] Switch to dark theme and confirm the card shows the primary-dark lockup.
- [ ] Confirm the lockup remains aligned and legible on desktop and mobile.
- [ ] Confirm the visible logo has accessible text `ARTales`.
- [ ] Confirm the navbar and other brand presentations are unchanged.
- [ ] Confirm card copy, structure, and theme control are unchanged.
