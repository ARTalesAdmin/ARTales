# ARTales app favicon verification v0.1

## Metadata

- **Related production promotion:** PR #68
- **Related icon-source audit:** PR #70
- **Related service-worker alignment:** PR #71
- **Audit date:** 2026-08-06
- **Branch baseline:** current `develop` after the production-status cleanup
- **Scope:** audit only
- **Runtime behavior:** unchanged
- **Risk:** low
- **Target:** develop first
- **DB:** no
- **Env:** no

## Summary

`app/favicon.ico` and `public/favicon.ico` both exist, but they are **not
identical**. They have different byte sizes, different SHA-256 digests, and
different sets of embedded ICO images. The app file contains six PNG-backed
images from 16x16 through 256x256, while the approved public file contains
three PNG-backed images from 16x16 through 48x48.

Because `app/favicon.ico` uses a supported Next App Router file-based metadata
name at the root of `app`, it can be discovered as favicon metadata in addition
to the explicit icon declarations in `app/layout.tsx`. The favicon surface is
therefore not controlled exclusively by the approved files in `public/`.

This is an audit-only finding. No favicon, public asset, metadata, manifest,
service-worker, registry, code, configuration, package, database, or
environment file was changed.

## What was checked

The audit performed read-only checks for:

1. presence, byte size, and SHA-256 of `app/favicon.ico` and
   `public/favicon.ico`;
2. byte-for-byte equality of the two ICO files;
3. ICO directory headers, embedded image count, dimensions, encoding, and
   payload size;
4. hashes and dimensions of the approved runtime set in `public/`;
5. explicit favicon references in `app/layout.tsx` and cache paths in
   `public/sw.js`;
6. other App Router file-based icon candidates at the requested `app/` and
   `src/app/` paths; and
7. the installed Next version and its local metadata resolver behavior.

The ICO structure was read directly without rewriting or extracting content
into tracked files. Pillow and the system `file` utility were unavailable, but
the standard ICO directory and embedded PNG headers provided the dimensions
and formats needed for this comparison.

## File comparison

| File | Exists | Size | SHA-256 | ICO contents |
| --- | --- | ---: | --- | --- |
| `app/favicon.ico` | yes | 43,131 bytes | `446dcd98dd8914311f5c2cd3d64a9c0956fabd3a656099b0a337be491463793e` | 6 PNG-backed images: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256 |
| `public/favicon.ico` | yes | 3,312 bytes | `c442a5406b99bb683310d28b0b5019759a9f68bb854858dae3b8285df8636bd4` | 3 PNG-backed images: 16x16, 32x32, 48x48 |

`cmp` reports the files as different. Their embedded 16x16, 32x32, and 48x48
PNG payloads also have different byte sizes and SHA-256 values. This is not
merely a difference in the outer ICO directory or the presence of additional
large resolutions: the corresponding embedded payloads differ as binary
content too.

### Embedded image details

| Source | Size | Encoding | Embedded bytes |
| --- | ---: | --- | ---: |
| `app/favicon.ico` | 16x16 | PNG | 826 |
| `app/favicon.ico` | 32x32 | PNG | 1,871 |
| `app/favicon.ico` | 48x48 | PNG | 3,205 |
| `app/favicon.ico` | 64x64 | PNG | 4,622 |
| `app/favicon.ico` | 128x128 | PNG | 11,746 |
| `app/favicon.ico` | 256x256 | PNG | 20,759 |
| `public/favicon.ico` | 16x16 | PNG | 580 |
| `public/favicon.ico` | 32x32 | PNG | 1,373 |
| `public/favicon.ico` | 48x48 | PNG | 1,305 |

The check establishes binary and structural mismatch. It does not claim a
pixel-level or human visual classification because no image decoder was
available in the audit environment. A clean-browser runtime check in a
follow-up can confirm which artwork is actually selected and whether the app
file visually matches the reported old tab icon.

## Approved runtime icon set

The approved files referenced by current metadata, manifest, or service-worker
paths remain present and were not modified:

| File | Dimensions / contents | SHA-256 |
| --- | --- | --- |
| `public/favicon.ico` | 16x16, 32x32, 48x48 | `c442a5406b99bb683310d28b0b5019759a9f68bb854858dae3b8285df8636bd4` |
| `public/favicon-16x16.png` | 16x16 | `18c76d89a4d0a127a3bb608bdf1a7d743ec29aa93e5f4a086024e7137a5e50b7` |
| `public/favicon-32x32.png` | 32x32 | `57ab5314e4ac0c620e8ff50f4bc5dcd976cb9e2b565f21fe62f9fedaf2035cde` |
| `public/favicon-48x48.png` | 48x48 | `8c2f12c0cb0e0dee8a114a4f22ca87ae372985885aa4cda807a0f749bc8fe522` |
| `public/apple-touch-icon-180x180.png` | 180x180 | `9b646801a4b4be85980d39de8414fdda942dda91cc6d9b65f3e9f54d4bb44cad` |
| `public/app-icon-192x192.png` | 192x192 | `07c228cacdd3f69c94bcea5cd3746d07a3e00709708614802f12439a9770d583` |
| `public/app-icon-512x512.png` | 512x512 | `bfcc054b3d0d0afb4d16b45a375461889384bb4dc113975cd3b654e1cd536715` |

The standalone favicon PNGs are not byte-identical to the PNG payloads inside
either ICO container. That is not by itself an error because image encoding and
container export can differ; the decisive result for this audit is that the two
competing `favicon.ico` sources are not the same file or the same embedded
payload set.

## Next file-based metadata finding

The repository uses Next `16.1.6`. The installed Next metadata resolver collects
static icon modules and gives special treatment to a file-based favicon URL at
`/favicon.ico`. Therefore `app/favicon.ico` is capable of acting as the App
Router's file-based favicon metadata source.

At the same time, `app/layout.tsx` explicitly declares `/favicon.ico`, three
standalone favicon PNGs, the Apple touch icon, and `/favicon.ico` as a shortcut.
Both the file convention and the configured metadata can participate in the
resolved icon metadata. Since the app and public favicon files share the same
public URL name but contain different bytes, path inspection alone is not a
safe guarantee that every generated response or browser selection uses the
approved public binary.

Conclusion: `app/favicon.ico` may **supplement or take precedence within the
resolved file-based icon metadata**, depending on Next's generated metadata and
the browser's icon selection. It is a concrete repository-level mismatch that
should be resolved deliberately rather than treated only as a cache symptom.

## Other file-based metadata icon search

| Requested pattern | Result |
| --- | --- |
| `app/favicon.ico` | found |
| `app/icon.*` | none found |
| `app/apple-icon.*` | none found |
| `src/app/favicon.ico` | not found (`src/app/` has no matching file) |
| `src/app/icon.*` | none found |
| `src/app/apple-icon.*` | none found |

No second file-based icon candidate was found beyond `app/favicon.ico`.

## Likely explanation for an old browser-tab favicon

The causes rank as follows based on repository evidence:

1. **File-based metadata mismatch — strongest concrete repository finding.**
   The app favicon is demonstrably different from the approved public favicon,
   and Next can discover it automatically. A clean client could therefore be
   offered or select a non-approved favicon even without a stale cache.
2. **Browser favicon cache — still plausible and common.** Browsers keep
   favicon-specific caches independently of ordinary page reloads. This remains
   a likely explanation when a clean/private profile receives the approved
   icon but an existing profile does not.
3. **Service-worker cache — plausible but less likely as the primary current
   repository cause.** PR #71 aligned the service worker with the approved icon
   paths and bumped its named cache. An older worker or cache can persist on a
   client until activation/cleanup, and the current worker still caches
   `/favicon.ico`; however, the active source mismatch exists before caching and
   can determine which bytes get cached.

Without capturing the live `/favicon.ico` response, generated `<head>`, active
service-worker state, and the displayed icon in the same affected browser, this
audit cannot assign one universal cause to every environment. The mismatch is
the first issue to isolate because it can affect fresh clients; browser and
service-worker caches explain continued old display after sources are aligned.

## Recommended follow-up

A **separate runtime PR is recommended**, but no runtime change belongs in this
audit PR. The follow-up should:

1. verify in `develop` preview which bytes Next serves for `/favicon.ico` and
   record the generated favicon `<link>` elements in a clean browser profile;
2. visually compare the served app favicon with the approved ARTales icon and
   the reported old icon;
3. choose one authoritative favicon strategy, then either align
   `app/favicon.ico` with the approved source or remove the redundant source if
   Next behavior and fallback requirements support that decision;
4. confirm behavior with no service worker, with the current service worker,
   and after an upgrade from the previous worker/cache; and
5. test normal reload, hard reload, private browsing, and a previously affected
   browser profile before requesting production promotion.

Any binary or runtime adjustment needs explicit scope and review. This report
does not authorize changing either favicon.

## Risk, rollback, and checklist

- **Risk:** low. Documentation only; no runtime or binary output changes.
- **Target:** develop first.
- **DB:** no.
- **Env:** no.
- **Rollback:** revert the single audit-document commit or remove this document;
  there are no runtime, data, binary, or configuration rollback steps.

- [x] Audit-only document added.
- [x] `app/favicon.ico` and `public/favicon.ico` existence confirmed.
- [x] File sizes and SHA-256 digests recorded.
- [x] Byte equality and ICO structure checked.
- [x] Requested file-based metadata icon paths searched.
- [x] No binary changes.
- [x] No runtime code changes.
- [x] No manifest, service-worker, registry, CSS/token, admin, DB, Env, Supabase,
      or package changes.
- [x] No JSON audit file added; JSON parse validation is not applicable.
- [x] `git diff --check` passes.
