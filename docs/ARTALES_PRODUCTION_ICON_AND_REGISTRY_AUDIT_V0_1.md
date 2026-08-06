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

## Post-audit resolution

The runtime-relevant service-worker finding was resolved by PR #71, which aligned the active icon and manifest cache paths and was subsequently promoted to `main`. The registry finding was resolved in the follow-up status-only cleanup: production promotion via PR #68, the service-worker alignment, and their completed production state are now recorded in `brand/artales/brand-registry.v0.1.json`. No runtime behavior was changed by the registry cleanup.

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

### Runtime-relevant stale references found by PR #70 (resolved)

At the time of the audit, `public/sw.js` precached and served old icon paths:

- `/icons/artales-icon-192.png`
- `/icons/artales-icon-512.png`
- `/icons/artales-maskable-192.png`
- `/icons/artales-maskable-512.png`
- `/apple-touch-icon.png`

The same service worker also treated `/icons/` and `/apple-touch-icon.png` as cacheable icon-like resources. PR #71 replaced those active references with the approved icon set and bumped the cache name; that alignment was subsequently promoted to `main`.

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

At the time of the PR #70 audit, the PWA/cache-related sources found in active runtime code were:

- `components/pwa/PwaRegister.tsx` registers `/sw.js` in production only, with scope `/` and `updateViaCache: "none"`.
- `public/sw.js` defined `CACHE_NAME = "artales-pwa-v0108"`, precached icon and manifest URLs, deleted old named caches during activation, and served cached icon/manifest requests before fetching. PR #71 subsequently aligned the icon paths and changed the cache name to `artales-pwa-v0109-brand-icons`.
- `public/manifest.webmanifest` defines the installable PWA metadata and current app icon references.

No `next-pwa` or `workbox` runtime integration was found in active app configuration. Package lock cache-related hits are dependency metadata, not ARTales runtime PWA behavior.

Finding at PR #70: delayed favicon/PWA icon refresh was expected at the browser, OS, installed-PWA, service-worker, and cache layers. The repository-level stale service-worker paths identified by the audit were resolved by PR #71 and promoted to `main`; client-side cache refresh can still be asynchronous.

## Brand registry audit (finding at PR #70)

At the time of the PR #70 audit, `brand/artales/brand-registry.v0.1.json` contained post-production stale status fields after PR #68:

- `deployment_status.main` says `partial_tooling_only_or_not_promoted`.
- Approval notes still say production/main promotion is not approved.
- Next steps still describe production promotion as future work.
- Review history still records `productionApproval: false` and notes that no production/main promotion was approved.
- Current snapshot fields still describe the approval scope as develop-only review state.

Resolution: the status-only registry cleanup has now recorded the completed PR #68 promotion and the subsequent service-worker cache alignment. It preserved the original develop-only visual review record and added separate production-promotion and cache-alignment events. No runtime behavior changed in the cleanup.

## Findings by category

### Expected browser/PWA cache delay

Expected. Browser favicon caches, installed PWA icon caches, OS launcher caches, and active service workers can keep previously fetched icons after a production deployment. PR #71 removed the legacy precache paths, but browser, installed-PWA, and operating-system cache layers may still refresh asynchronously after the aligned worker reaches a client.

### Real stale repository references

Partially resolved. PR #71 removed the runtime-relevant stale icon references from `public/sw.js` and was promoted to `main`. Legacy icon files remain in `public/` pending an optional retirement decision. Historical docs and brand candidate files also mention older or pre-production icon statuses, but most of those are recordkeeping rather than active runtime integration.

### Registry audit-status cleanup (resolved)

Addressed. `brand/artales/brand-registry.v0.1.json` now records production promotion and service-worker icon cache alignment as completed on `main`; tokenization and admin dashboard integration remain unstarted.

### Actual runtime breakage

Not found by repository audit. Current `app/layout.tsx` metadata references and `public/manifest.webmanifest` references are internally consistent with the expected current public icon files. Any visible old browser/PWA icon can be explained by cache/service-worker/installed-app delay or by the separate `app/favicon.ico` file-based metadata source pending deeper verification.

## Follow-up status

1. **Service worker icon cache alignment** — completed in PR #71 and promoted to `main`.
2. **File-based metadata verification PR** — compare or align `app/favicon.ico` with the current approved `public/favicon.ico` source if browser tab favicon inconsistency persists.
3. **Legacy public asset retirement PR** — decide whether to remove or leave `public/favicon.svg`, `public/apple-touch-icon.png`, and `public/icons/artales-*` after confirming no external clients rely on them.
4. **Brand registry status cleanup** — completed in the status-only follow-up after the PR #70 audit.
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
- [x] Post-audit service-worker and registry resolutions are recorded.
