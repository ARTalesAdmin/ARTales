# ARTales PWA update hygiene v0.1

## Scope and decision

This change audits the repository implementation and adds a small, develop-first update signal. It does not test the live site, change Reader behavior, modify brand files, or touch database, Supabase, environment, payment, access, parser, or editor logic.

The chosen mechanism is a static deployment marker (`public/version.json`) plus a client check in the existing PWA registration component. The check runs when the app opens, when it becomes visible again, and every 30 minutes. It requests a timestamped URL with Fetch `cache: "no-store"`; the service worker explicitly leaves that path to the network. A different marker produces a non-blocking Czech or English banner, and only its button reloads the current page.

`version.json` must be changed whenever a deployment should notify already-running clients. This explicit marker is intentionally independent of an environment variable or a package/build-script change. On a user's first visit after this mechanism is introduced, the current marker becomes the baseline without showing a misleading update banner.

## Release-process requirement

The update banner appears **only when `public/version.json` changes** from the version already recorded by a client. Therefore, every production release that should notify already-running browser or installed-app clients must update the marker as part of its release patch.

This release step is intentionally manual for now. It keeps the update mechanism explicit and avoids package-script or build/deploy changes. Forgetting to update the marker does not break ARTales and does not prevent the new deployment from loading normally, but already-running clients will not receive the update banner for that release.

Changing—or forgetting to change—the marker does not clear or otherwise alter localStorage, Reader progress, bookmarks, settings, or authentication. The runtime implementation continues to use only its dedicated `artales_app_version` key for version comparison. A future improvement may generate or update the marker automatically during build or deployment after that release integration has been designed and reviewed.

Release checklist:

- [ ] If this release should notify stale clients, bump `public/version.json`.

For the required `develop` → `main` promotion decision, marker naming convention, documented exception rule, and pull request checklist, follow [ARTales main release protocol v0.1](ARTALES_MAIN_RELEASE_PROTOCOL_V0_1.md).

## Current repository state and files inspected

| Area | State before this change | Files inspected |
| --- | --- | --- |
| Web app manifest | Present at `/manifest.webmanifest`; standalone display, start URL, scope, theme/background colors, categories and shortcuts are declared. | `public/manifest.webmanifest`, `app/layout.tsx` |
| Service worker | Present and production-only registration exists. Navigations are network-first with an offline fallback. The manifest and runtime icons were previously cache-first. Install already used `skipWaiting()` and activation already used `clients.claim()`. | `public/sw.js`, `components/pwa/PwaRegister.tsx`, `public/offline.html` |
| Install metadata | Root metadata links the manifest, opts into Apple web-app mode, supplies responsive viewport/theme colors, and sets the application name. | `app/layout.tsx` |
| Icons | Manifest uses the approved `app-icon-192x192.png` and `app-icon-512x512.png`; Next metadata uses the approved favicon set and `apple-touch-icon-180x180.png`. These paths match the controlled runtime icon set, so references were not replaced and no asset was generated. | `public/manifest.webmanifest`, `app/layout.tsx`, `brand/artales/brand-registry.v0.1.json`, relevant files under `public/` |
| Apple touch icon | Explicit 180×180 PNG metadata is present. A legacy `public/apple-touch-icon.png` also exists but is not the metadata reference. | `app/layout.tsx`, `public/apple-touch-icon-180x180.png`, `public/apple-touch-icon.png` |
| Cache/version handling | The service worker had a named cache and removed older caches on activation. There was no deployment/build marker or app-level version comparison. Static HTTP response headers are not configured in `next.config.ts`. | `public/sw.js`, `next.config.ts`, `package.json` |
| Update UI | No update banner or app refresh mechanism existed. Service-worker updates could activate immediately, but only when `/sw.js` itself changed. | `components/pwa/PwaRegister.tsx`, `app/layout.tsx` |

## Changes made

- Added `public/version.json` as the lightweight deployment marker.
- Extended `PwaRegister` to fetch the marker without cache, establish a first-visit baseline, compare later results, and show a small locale-aware refresh banner only on a mismatch.
- Added token-based banner styling to the shared stylesheet; no one-off colors or new assets were introduced.
- Changed manifest/icon handling in the service worker from cache-first to network-first with cached fallback, bumped the cache name, and excluded the version marker from Cache Storage.
- Kept the existing service-worker lifecycle policy. This patch does not add more aggressive unregister, `skipWaiting()`, or `clients.claim()` behavior; the latter two already existed.

## Risks and mitigations

### Stale JS, CSS, or app shell

A browser tab or installed app can remain open across a deployment and continue executing the already-loaded bundle. A normal navigation is network-first in this service worker, but it cannot replace JavaScript already running in an open document. The marker check now offers a deliberate reload when a new marker is observed. It never forces a reload during reading.

### Stale service-worker cache

The worker does not cache Next.js JavaScript/CSS or page responses; it only precaches the offline page, manifest, and icon/favicon assets. Previously, cached brand assets were returned indefinitely until the cache name changed. They are now requested from the network first and fall back to cache only when offline. The new cache name removes the former cache during activation.

### Stale manifest and home-screen icon

The manifest now receives network-first treatment, but browsers and mobile operating systems may separately cache install metadata and launcher icons. Web code cannot reliably force every platform to replace an installed home-screen icon immediately. If it remains stale, remove ARTales from the home screen and add it again after reopening the site in the browser.

### Browser reload versus installed launch

A browser refresh requests the current document and assets. A standalone/home-screen launch can resume an existing process or apply platform-specific manifest/icon caches, so its visible result may differ. The visibility and interval checks cover resumed app sessions, while the user remains in control of refresh.

### Local state versus cached application code

Reader progress, bookmarks, preferences, and authentication state are logically separate from the app shell and Cache Storage. This implementation does **not** clear localStorage, Cache Storage wholesale, cookies, IndexedDB, or service-worker registrations. It reads and writes only its own `artales_app_version` localStorage key. The refresh action calls `window.location.reload()` and does not force logout.

## Known limitations

- Updating the marker is a release responsibility; an unchanged `version.json` intentionally produces no banner even if other files deploy.
- The first marker seen is stored as a baseline, so deployment of this mechanism itself does not claim that an update is available.
- Offline clients cannot discover a deployment until network access returns.
- CDN, browser, installed-app, and operating-system icon behavior cannot be fully controlled by application code.
- Installed/PWA launch behavior needs device testing in the develop preview; it is not fully reproducible in the repository checks.

## Support steps for a stale app or icon

1. Close ARTales tabs and standalone ARTales windows.
2. Reopen `artales.net` in the browser.
3. Refresh the page.
4. If only the home-screen icon is still stale, remove ARTales from the home screen and add it again.

Do not advise clearing all site data as a routine step. That can remove local Reader progress, bookmarks, and settings. Escalate before suggesting destructive storage cleanup.

## Develop preview checklist

- [ ] Normal public page load works.
- [ ] Signed-in/internal/member pages remain unchanged and usable.
- [ ] Installed/home-screen launch remains usable on at least one supported mobile device, if available.
- [ ] `/version.json` returns the current JSON marker and its timestamped request is not satisfied by the service-worker cache.
- [ ] With `artales_app_version` absent, the marker is stored and no banner appears.
- [ ] With `artales_app_version` set to a different value, the update banner appears in the selected Czech or English locale.
- [ ] Selecting **Aktualizovat** / **Refresh** stores the new marker and safely reloads the current URL.
- [ ] No code clears localStorage; Reader progress, bookmarks, and settings remain untouched.
- [ ] Manifest and app metadata still reference the approved runtime icons.
- [ ] Offline navigation still falls back to `offline.html` after the service worker has installed.
- [ ] Public and internal/member pages have no layout regression from the fixed banner (the banner is absent during normal same-version use).

## Rollback

Revert the single implementation commit. That removes the marker and banner logic and restores the previous service-worker asset strategy/cache name. No database, environment, brand binary, user content, or Reader state migration needs reversal. Browsers with the newer worker may retain its cache until a subsequent worker activates, but normal navigation remains network-first throughout.

**Risk:** medium — a small global client component and service worker behavior change require preview/device regression checks.

**Target:** develop first.

**DB:** no.

**Env:** no.
