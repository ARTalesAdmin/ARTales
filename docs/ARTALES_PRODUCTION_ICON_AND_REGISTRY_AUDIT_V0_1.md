# ARTales production icon and brand registry audit v0.1

## Metadata

- **Production promotion PR:** #68
- **Audit date:** 2026-08-05
- **Branch baseline:** `develop_synced_with_main_after_pr_68`
- **Scope:** audit only
- **Runtime behavior:** unchanged
- **DB:** no
- **Env:** no
- **Risk:** low
- **Target:** develop first

## Why this audit exists

PR #68 promoted the approved ARTales brand identity package to `main`. The production deployment is visible on Vercel and the Vercel UI already shows the new ARTales icon. The live site is not known to be broken. This audit records the post-production baseline before any further runtime changes, especially because browser tab favicons and installed PWA icons may keep old cached assets after deployment.

## What was checked

Repository files were searched for icon, manifest, PWA, service worker, cache, shortcut, and theme-color references, including:

- `favicon`, `favicon.svg`, `apple-touch-icon`, `app-icon`, `artales-icon`, `maskable`
- `manifest.webmanifest`, `/icons/`, `metadata.icons`, `shortcut`, `theme-color`
- `PwaRegister`, `service worker`, `sw.js`, `workbox`, `next-pwa`, `cache`

The audit also checked expected runtime icon asset presence, `app/layout.tsx` metadata icon references, `public/manifest.webmanifest` PWA icon references, possible Next file-based metadata overrides, service-worker/cache sources, and stale production-status wording in `brand/artales/brand-registry.v0.1.json`.

## Runtime icon assets

All expected current runtime icon assets exist in `public/`.

| Expected asset | Found | Notes |
| --- | --- | --- |
| `public/favicon.ico` | yes | Expected browser fallback and shortcut icon. |
| `public/favicon-16x16.png` | yes | Referenced by metadata icons. |
| `public/favicon-32x32.png` | yes | Referenced by metadata icons. |
| `public/favicon-48x48.png` | yes | Referenced by metadata icons. |
| `public/apple-touch-icon-180x180.png` | yes | Referenced by metadata apple icons. |
| `public/app-icon-192x192.png` | yes | Referenced by web app manifest icons and shortcut icons. |
| `public/app-icon-512x512.png` | yes | Referenced by web app manifest icons. |

## Metadata references

`app/layout.tsx` is internally consistent with the expected runtime favicon and Apple touch icon set:

- `metadata.manifest` points to `/manifest.webmanifest`.
- `metadata.icons.icon` points to `/favicon.ico`, `/favicon-16x16.png`, `/favicon-32x32.png`, and `/favicon-48x48.png`.
- `metadata.icons.apple` points to `/apple-touch-icon-180x180.png`.
- `metadata.icons.shortcut` points to `/favicon.ico`.
- `viewport.themeColor` is declared in `app/layout.tsx` for light and dark color schemes.

## Manifest references

`public/manifest.webmanifest` is internally consistent with the expected current PWA app icon files:

- Main manifest icons reference `/app-icon-192x192.png` and `/app-icon-512x512.png`.
- Manifest shortcuts reference `/app-icon-192x192.png` for both shortcut entries.
- No manifest icon entry references the old `/icons/artales-*` files.
- No manifest icon entry currently declares `purpose: "maskable"`; both main icons use `purpose: "any"`.

## Stale icon references found

Stale icon paths still exist in the repository, but they are not all equivalent in runtime impact.

### Runtime-relevant stale references

`public/sw.js` still precaches and serves old icon paths:

- `/icons/artales-icon-192.png`
- `/icons/artales-icon-512.png`
- `/icons/artales-maskable-192.png`
- `/icons/artales-maskable-512.png`
- `/apple-touch-icon.png`

The same service worker also treats `/icons/` and `/apple-touch-icon.png` as cacheable icon-like resources. This can plausibly contribute to expected browser/PWA cache delay or installed-PWA icon staleness, even though the metadata and manifest references have moved to the current icon paths.

### Legacy public assets still present

The old files still exist in `public/`:

- `public/favicon.svg`
- `public/apple-touch-icon.png`
- `public/icons/artales-icon-192.png`
- `public/icons/artales-icon-512.png`
- `public/icons/artales-maskable-192.png`
- `public/icons/artales-maskable-512.png`

Their presence is a real stale repository condition, but this audit does not remove or replace them.

### Non-runtime historical or tooling references

Additional matches appear in docs, brand manifests, workflow/tooling files, examples, and historical candidate records. Those references are mostly review history, export workflow documentation, or candidate context. They should not be treated as active runtime references without a separate file-by-file cleanup decision.

## Next file-based metadata override check

Next file-based metadata can override or supplement configured metadata. This repository contains:

- `app/favicon.ico` — found.

The following checked override paths were not found:

- `app/icon.*`
- `app/apple-icon.*`
- `src/app/favicon.ico`
- `src/app/icon.*`
- `src/app/apple-icon.*`

Finding: `app/favicon.ico` is a real file-based metadata favicon source. This means the runtime favicon surface is not exclusively controlled by `metadata.icons` in `app/layout.tsx`. It should be audited or aligned in a later runtime-focused PR if the browser tab icon remains inconsistent.

## PWA cache and update sources

The PWA/cache-related sources found in active runtime code are:

- `components/pwa/PwaRegister.tsx` registers `/sw.js` in production only, with scope `/` and `updateViaCache: "none"`.
- `public/sw.js` defines `CACHE_NAME = "artales-pwa-v0108"`, precaches icon and manifest URLs, deletes old named caches during activation, and serves cached icon/manifest requests before fetching.
- `public/manifest.webmanifest` defines the installable PWA metadata and current app icon references.

No `next-pwa` or `workbox` runtime integration was found in active app configuration. Package lock cache-related hits are dependency metadata, not ARTales runtime PWA behavior.

Finding: delayed favicon/PWA icon refresh is expected at the browser, OS, installed-PWA, service-worker, and cache layers. The clearest repository-level contributor is `public/sw.js`, which still names old icon URLs and uses a cache-first response for icon/manifest resources.

## Brand registry audit

`brand/artales/brand-registry.v0.1.json` still contains post-production stale status fields after PR #68:

- `deployment_status.main` says `partial_tooling_only_or_not_promoted`.
- Approval notes still say production/main promotion is not approved.
- Next steps still describe production promotion as future work.
- Review history still records `productionApproval: false` and notes that no production/main promotion was approved.
- Current snapshot fields still describe the approval scope as develop-only review state.

Finding: the registry needs a cleanup PR that updates audit/status wording to reflect the post-PR #68 production baseline. That cleanup should be separated from runtime behavior changes unless explicitly approved.

## Findings by category

### Expected browser/PWA cache delay

Expected. Browser favicon caches, installed PWA icon caches, OS launcher caches, and active service workers can keep previously fetched icons after a production deployment. This is especially plausible because `public/sw.js` still cache-first serves icon/manifest resources and still includes legacy icon paths in its precache list.

### Real stale repository references

Found. Runtime-relevant stale icon references remain in `public/sw.js`, and legacy icon files remain in `public/`. Historical docs and brand candidate files also mention older or pre-production icon statuses, but most of those are recordkeeping rather than active runtime integration.

### Registry audit-status cleanup

Needed. `brand/artales/brand-registry.v0.1.json` still represents production promotion as unapproved or future, which is stale after PR #68 and after syncing `develop` with `main`.

### Actual runtime breakage

Not found by repository audit. Current `app/layout.tsx` metadata references and `public/manifest.webmanifest` references are internally consistent with the expected current public icon files. Any visible old browser/PWA icon can be explained by cache/service-worker/installed-app delay or by the separate `app/favicon.ico` file-based metadata source pending deeper verification.

## Recommended follow-up PRs

1. **Service worker icon cache alignment PR** — update `public/sw.js` to stop precaching old `/icons/artales-*` and `/apple-touch-icon.png` paths, consider a cache name bump, and align cacheable icon URLs with current metadata and manifest paths.
2. **File-based metadata verification PR** — compare or align `app/favicon.ico` with the current approved `public/favicon.ico` source if browser tab favicon inconsistency persists.
3. **Legacy public asset retirement PR** — decide whether to remove or leave `public/favicon.svg`, `public/apple-touch-icon.png`, and `public/icons/artales-*` after confirming no external clients rely on them.
4. **Brand registry status cleanup PR** — update `brand/artales/brand-registry.v0.1.json` to reflect PR #68 production promotion and the post-sync `develop` baseline.
5. **Documentation archive cleanup PR** — optionally annotate older review docs and example manifests as historical to prevent confusion, without changing runtime behavior.

## Acceptance checklist

- [x] Audit-only document added.
- [x] No runtime behavior changes.
- [x] No `app/layout.tsx` changes.
- [x] No `public/manifest.webmanifest` changes.
- [x] No public icon binary changes.
- [x] No CSS/token/admin dashboard changes.
- [x] No DB/env/Supabase changes.
- [x] Current repo references are internally consistent for metadata and manifest icon paths.
- [x] Stale icon paths are clearly identified.
- [x] Registry production-status cleanup need is clearly identified.
