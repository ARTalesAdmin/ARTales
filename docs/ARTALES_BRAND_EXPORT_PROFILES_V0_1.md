# ARTales brand export profiles v0.1

## Summary

This report specifies eight controlled profiles for future production asset generation. It records sources, intended contexts, colors, backgrounds, and prospective formats without generating an export or approving public/runtime use. The specification is awaiting human review.

## Locked masters used

| Master | Locked source | SHA-256 |
| --- | --- | --- |
| Standalone symbol v1 | `brand/artales/masters/symbol-pen-drop/symbol-pen-drop.master.v1.svg` | `d70d53143a6809d0bea61d68238b40d6a7d3a063e8a5f0f5d703f234d9899847` |
| Standalone wordmark v1 | `brand/artales/masters/wordmark-artales/artales-wordmark.master.v1.svg` | `74ed72373b89a0818628469d5a6ff5fdf7080316d9338018f6bf70ae9fec4f91` |
| Light logo lockup v1 | `brand/artales/masters/logo-lockup/artales-lockup-light.master.v1.svg` | `8697d4a0fa29e9c000e45b9c4a920ec2c916ac7940c61a9603fa28e34d6cd75b` |
| Dark logo lockup v1 | `brand/artales/masters/logo-lockup/artales-lockup-dark.master.v1.svg` | `ee4844c7d4c96a57ae3a01a1b52731812e342ef9bb9accfc60a8028bbae61fb4` |

The masters remain locked and unchanged. Their checksums bind future generation work to the reviewed source geometry.

## Why profiles come before assets

An export profile separates brand decisions from file generation and application integration. Agreeing on source, color, context, background, and formats first makes later exports reproducible and reviewable. It also prevents a generated file from being mistaken for an approved favicon, app icon, or deployed logo before its intended use has been reviewed.

## Profile list

1. **`primary-light`:** transparent light/paper-background lockup; gold symbol and dark wordmark; future SVG and PNG.
2. **`primary-dark`:** transparent dark-background lockup; gold symbol and wordmark; future SVG and PNG.
3. **`symbol-only-gold`:** transparent gold symbol for decorative brand moments and as a possible icon starting point; future SVG and PNG.
4. **`wordmark-only-dark`:** transparent dark wordmark for light backgrounds; future SVG and PNG.
5. **`wordmark-only-gold`:** transparent gold wordmark for dark backgrounds; future SVG and PNG.
6. **`monochrome-dark`:** transparent one-color lockup in Text Dark or Ink/Night for light backgrounds and practical print, fallback, legal, or simple contexts; future SVG and PNG.
7. **`monochrome-light`:** transparent one-color lockup in Paper, or white only when necessary, for dark backgrounds and practical print, fallback, or simple contexts; future SVG and PNG.
8. **`small-size-symbol`:** locked symbol geometry as the candidate base for favicon, app icon, or social avatar work; prospective SVG, PNG, ICO, and app-icon sizes only after a separate review.

## Color strategy

- **Primary Gold `#E0AA47`** identifies the symbol and gold wordmark treatments in future exports.
- **Text Dark `#272827`** provides the standard wordmark and monochrome treatment on light or paper backgrounds.
- **Ink/Night `#0F1315`** is an allowed darker monochrome alternative where the output context calls for it.
- **Paper `#FDF3E2`** is the preferred light monochrome treatment on dark backgrounds; **white `#FFFFFF`** is reserved for cases where it is necessary.
- All profiles default to transparent backgrounds. Only the later small-size/icon task may evaluate a controlled square background.

The profile colors describe intended derivative exports. They do not modify the locked masters in this change.

## Monochrome and black variant policy

The primary light and primary dark lockups remain the main ARTales logos. `monochrome-dark` and `monochrome-light` are secondary, one-color export profiles for practical constraints. Text Dark or Ink/Night can provide a black-like treatment, but no monochrome or black variant becomes a third primary logo.

## Small-size and favicon note

The locked symbol is the starting geometry, not an approved favicon or app icon. Legibility at small sizes may require a separately designed simplified candidate. A later task must review that geometry, transparent versus controlled square backgrounds, and each required output size before creating production favicon, app-icon, or social-avatar assets.

## Explicitly out of scope

- Generating, approving, or publishing SVG, PNG, ICO, favicon, app-icon, or other production exports.
- Copying files into `public/` or changing web manifests.
- Runtime, application, component, CSS, or website integration.
- Changes to the locked master files or their geometry.
- Database, Supabase, payments, credits, memberships, reader, editor, parser, or environment changes.
- Any use or revival of patch v0.10.15k.

## Next steps

1. Human review of the export profile specification.
2. Generate export assets in a separate pull request.
3. Create small-size, favicon, and app-icon candidates separately.
4. Integrate runtime or public assets only in a later explicit pull request.
