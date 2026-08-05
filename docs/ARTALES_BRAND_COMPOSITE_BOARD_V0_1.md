# ARTales Brand Composite Board v0.1

## Summary

This change adds a single large, static overview for human review of the current ARTales brand assets and palette. It is documentation only: there is no runtime, public integration, CSS, token, database, environment, or production impact.

- **Board:** `brand/artales/overview/artales-brand-composite-board.v0.1.svg`
- **Status:** review-only / not runtime / not token source
- **Risk:** low — additive documentation assets only
- **Target:** develop first
- **DB:** no
- **Env:** no

## Included assets

- Standard symbol master v1.
- Wordmark master v1.
- Light and dark logo lockup masters v1.
- Micro symbol master v1 (selected Micro B treatment).
- Existing runtime/public favicon and app-icon assets at 16, 32, 48, 180, 192, and 512 pixels.

The SVG sources and public PNGs are referenced from their existing paths. The metadata JSON records SHA-256 values for provenance. No existing source or binary asset was modified or copied.

## Included colors

| Name | Hex |
| --- | --- |
| Ink / Night | `#0F1315` |
| Deep Dark | `#141414` |
| Paper | `#FDF3E2` |
| Text Dark | `#272827` |
| Primary Gold | `#E0AA47` |
| Secondary Gold | `#E3AA46` |
| Darker Gold | `#D19738` |
| Gold Shade | `#B58636` |
| Locked Symbol Gold | `#DCA645` |

The board also demonstrates Primary Gold on Ink / Night, Text Dark on Paper, and Paper on Deep Dark for visual contrast review. These examples are descriptive, not token definitions.

## What changed

- Added a 2400 × 1600 composite SVG with labeled palette, symbol, wordmark, lockup, micro/icon ladder, and status-legend sections.
- Added JSON metadata containing review status, impact flags, source checksums, palette, limitations, and suggested next steps.
- Added a local review README and this implementation report.

## Out of scope

- No tokenization or design-token proposal.
- No runtime styling or app UI changes.
- No CSS variables or CSS changes.
- No public icon or manifest changes.
- No master or export changes.
- No new logo variants or brand colors.
- No production promotion.
- No database, environment, Supabase, reader, editor, parser, payment, credit, or membership changes.

## Rollback notes

Revert the single documentation commit or remove the four newly added files. There are no data, configuration, binary, or runtime dependencies to unwind.

## Testing notes

- Validate metadata with `python -m json.tool brand/artales/overview/artales-brand-composite-board.v0.1.json`.
- Parse the board as XML with Python's standard-library `xml.etree.ElementTree`.
- Verify all SVG relative asset references resolve.
- Compare changed paths with the allowed overview directory and this report.
- Confirm no existing master, public, app, CSS, runtime, token, DB, environment, or Supabase file changed.
- Run `git diff --check`.
- Human visual review remains the next step; the board is not a final brand manual.
