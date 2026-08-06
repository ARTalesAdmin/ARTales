# ARTales service worker icon cache alignment v0.1

## Change record

- **Context:** PR #68 promoted the approved ARTales brand and icon package to production; the audit added by PR #70 identified legacy icon paths in the service worker cache.
- **Scope:** service worker cache behavior for current icon and manifest assets.
- **Risk:** medium — this is an isolated runtime cache change, but installed service workers and PWA assets update asynchronously.
- **Target:** develop first
- **Production status:** promoted to `main`
- **DB:** no
- **Env:** no

## Alignment completed

`public/sw.js` now precaches the current approved icon and manifest paths used by the application metadata and web app manifest. The legacy `/icons/artales-*` paths and `/apple-touch-icon.png` were removed from the active precache list, and the icon-like request rule now matches the current explicit asset set rather than the legacy `/icons/` directory.

The cache name was bumped from `artales-pwa-v0108` to `artales-pwa-v0109-brand-icons`. The existing activation cleanup remains in place, so activation of the new service worker removes older named caches.

## Intentionally unchanged

- Legacy public icon files were not removed.
- `app/favicon.ico` was not touched.
- `app/layout.tsx` and `public/manifest.webmanifest` were not changed.
- Brand masters, exports, and registry production status were not changed. Registry status cleanup remains a separate follow-up.
- Navigation caching and the offline fallback behavior were not changed.
- No DB, environment, or Supabase changes were made.

## Deployment note

The alignment was promoted to `main`. The service worker cache-name bump gives installed clients a path away from the previous named cache after the new worker activates. Browser favicon caches, installed PWA metadata, and operating-system launcher caches are separate layers, however, and may still take time to refresh after deployment.

## Rollback

Revert the alignment commit to restore the previous service worker asset list and cache name. After a rollback deployment, clients must install and activate the restored service worker version; browser, PWA, and operating-system caches may again refresh asynchronously.

## Test checklist

- [x] Current manifest, favicon, Apple touch icon, and app icon paths are present in `public/sw.js`.
- [x] Legacy icon paths have no active references in `public/sw.js`.
- [x] The cache name changed from `artales-pwa-v0108`.
- [x] Existing activate-time deletion of older named caches remains.
- [x] Navigation and offline fallback logic remain unchanged.
- [x] No public icon binary, application metadata, manifest, DB, environment, Supabase, CSS/token, or admin-dashboard files changed.
- [x] `git diff --check` passes.
