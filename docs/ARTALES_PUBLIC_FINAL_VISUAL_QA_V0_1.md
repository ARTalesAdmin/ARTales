# ARTales public final visual QA v0.1

## Scope and release target

This pass is the final, narrowly scoped public visual QA before a separate homepage copy review. It targets the `develop` preview only; it does not authorize promotion or merge to `main`.

- **Risk:** low — one scoped public CSS adjustment plus this audit note.
- **Target:** develop first.
- **DB:** no.
- **Env:** no.

## Manual preview findings

- The Paper / Ink / Gold direction and refreshed public header are working well overall.
- In light mode, the surface-colored header ended too abruptly against the Paper homepage.
- The dark homepage was already readable and did not need redesign.
- On dark work detail, inline light-theme colors made the annotation and the body copy under “About the author” / “O autorovi” and “About the collection” / “O kolekci” too muted.
- The tab icon looks visually small, but the active references and source files do not show a mismatch that warrants an asset change.

## Header-to-hero transition fix

The light-only `.artales-public-header` now grades gently from the approved surface token into the page Paper token, retains a subtle border, and uses a restrained transition shadow. The light-only `.artales-home-shell` adds a short surface-muted-to-page gradient behind the top of the homepage. Together these changes preserve a distinct header without a hard white bar or a heavy sticky-navigation effect.

Dark header styling and layout structure are unchanged.

## Dark public detail contrast fix

The dark-only work-detail rules now establish the approved inverse text color on `.artales-work-detail-main`. Narrow descendant overrides lift:

- hero annotation, subtitle, summary, and collection prose;
- body paragraphs in the detail sections, including author and collection copy;
- edition metadata prose in `details dl`;
- relevant detail headings, labels, and inline links.

The readable secondary value already used on dark public cards (`rgba(247, 236, 210, 0.78)`) is reused for body prose; inverse text is reserved for headings, labels, and links. Light detail styling, reader CSS, state colors, and spacing remain unchanged.

## Selectors changed

- `:root:not([data-artales-theme="dark"]) .artales-public-header`
- `:root:not([data-artales-theme="dark"]) .artales-home-shell`
- `html[data-artales-theme="dark"] .artales-work-detail-main`
- dark descendants of `.artales-work-detail-hero`, direct detail sections, and `details`

## Favicon and app icon verification

`app/layout.tsx` explicitly publishes `/favicon.ico` plus the 16, 32, and 48 pixel PNG variants, uses `/favicon.ico` as the shortcut icon, and links `/manifest.webmanifest`. Next.js also discovers `app/favicon.ico` by file convention.

The repository copies of `app/favicon.ico` and `public/favicon.ico` have identical SHA-256 hashes, so the convention-based icon and the public URL are aligned. The manifest continues to reference `/app-icon-192x192.png` and `/app-icon-512x512.png` for installable-app icons, with the 192 pixel asset reused for shortcuts. These are the expected approved app-icon paths.

No mismatch was proven. No favicon, app icon, manifest, or service-worker file is changed in this pass. The perceived smallness should be checked in real browser tabs at preview time; changing the artwork would require a separately approved brand-asset scope.

## Homepage copy polish deferred

Homepage copy is intentionally unchanged. A separate PR should audit homepage-only keys in:

- `lib/i18n/dictionaries/cs/public.ts`
- `lib/i18n/dictionaries/en/public.ts`

That review should align the Czech and English homepage message with the current ARTales phase and message house, without mixing copy decisions into this visual patch.

## Preview checklist

- [ ] Homepage light desktop: header-to-hero transition is gentle and the header stays distinct.
- [ ] Homepage light mobile: transition remains smooth with wrapped/scrolled navigation.
- [ ] Homepage dark desktop: existing appearance remains unchanged.
- [ ] Public header/navigation in light and dark: logo, links, controls, focus, and active states remain readable.
- [ ] Work detail dark: annotation, subtitle, summary, and metadata prose are readable.
- [ ] Work detail dark: “O autorovi” / “About the author” and “O kolekci” / “About the collection” body text is readable.
- [ ] Work detail light: appearance remains unchanged and readable.
- [ ] Gallery/catalog light and dark: cards and navigation remain unchanged and readable.
- [ ] Favicon/tab icon: visually unchanged and served from the verified references.
- [ ] No layout shift at desktop or mobile widths.

## Intentionally unchanged

No route/page TSX, component, homepage copy, i18n dictionary, brand master/export, runtime logo SVG, favicon/icon, manifest/service worker, reader, admin/editor/member/account/internal UI, database, environment, Supabase, or package file is modified.

## Rollback path

Revert the single PR commit. This removes the final CSS block and this audit note; there are no data, environment, asset, or migration steps to reverse. Recheck the light homepage boundary and dark work-detail prose after rollback.
