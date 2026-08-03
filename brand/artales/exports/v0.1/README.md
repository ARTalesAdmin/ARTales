# ARTales brand exports v0.1

This directory contains **SVG-only brand-library exports** generated from the approved [export profiles v0.1](../../export-profiles/artales-export-profiles.v0.1.json) and the locked ARTales masters. These files remain review artifacts: they are not in `public/`, are not runtime assets, and are not integrated into the app or website.

## Generated profiles

| Profile | SVG | Color(s) | Role |
| --- | --- | --- | --- |
| `primary-light` | `primary-light/artales-logo-primary-light.svg` | approved source gold `#DCA645`; Text Dark `#272827` | Main logo for light/paper backgrounds |
| `primary-dark` | `primary-dark/artales-logo-primary-dark.svg` | approved source gold `#DCA645`; Primary Gold `#E0AA47` | Main logo for dark backgrounds |
| `symbol-only-gold` | `symbol-only-gold/artales-symbol-gold.svg` | approved locked-master source gold `#DCA645` | Standalone symbol |
| `wordmark-only-dark` | `wordmark-only-dark/artales-wordmark-dark.svg` | Text Dark `#272827` | Standalone wordmark on light backgrounds |
| `wordmark-only-gold` | `wordmark-only-gold/artales-wordmark-gold.svg` | Primary Gold `#E0AA47` | Standalone wordmark on dark backgrounds |
| `monochrome-dark` | `monochrome-dark/artales-logo-monochrome-dark.svg` | Text Dark `#272827` | Secondary practical export, not a primary logo |
| `monochrome-light` | `monochrome-light/artales-logo-monochrome-light.svg` | Paper `#FDF3E2` | Secondary practical export, not a primary logo |

Every SVG has a transparent background, outlined vector geometry, accessibility text, and controlled metadata naming its profile and source master. Checksums and provenance are recorded in `artales-brand-exports.v0.1.json`.

## Deliberate deferrals

- `png_generation_status: deferred_binary_export`
- `reason: binary files are not supported in the current Codex PR flow`
- `next_step: generate PNGs in a later manual/tooling step after SVG exports are reviewed`
- The small-size symbol, favicon, and app-icon exports are intentionally deferred until a separate small-size review.
- Any `public/` placement or app/runtime integration requires a later, explicitly scoped PR.
