# ARTales logo lockup light/dark candidates v0.2

## Summary

This package adds adjusted, review-only light and dark ARTales horizontal lockup candidates. It enlarges the locked symbol through a wrapper transform so its 769.36-unit scaled viewport approximately matches the capital A's 770-unit path height. The locked source geometry remains intact, the symbol stays left of the wordmark, and the v0.1 perceived spacing direction is preserved.

## Human feedback addressed

> Za mě v obou variantách, light i dark, bych zvětšil symbol na velikost písmena A ve vertikální ose. Ať je tedy celý znak větší, výraznější. Mezera mezi znakem a wordmarkem se zdá v pořádku.

V0.2 increases the symbol scale in both treatments. It retains the exact 144-unit viewport gap because the feedback found the existing spacing suitable.

## Source masters used

| Source | Locked master | Metadata | SHA-256 (SVG) |
| --- | --- | --- | --- |
| Symbol | `brand/artales/masters/symbol-pen-drop/symbol-pen-drop.master.v1.svg` | `brand/artales/masters/symbol-pen-drop/symbol-pen-drop.master.v1.json` | `d70d53143a6809d0bea61d68238b40d6a7d3a063e8a5f0f5d703f234d9899847` |
| Wordmark | `brand/artales/masters/wordmark-artales/artales-wordmark.master.v1.svg` | `brand/artales/masters/wordmark-artales/artales-wordmark.master.v1.json` | `74ed72373b89a0818628469d5a6ff5fdf7080316d9338018f6bf70ae9fec4f91` |

Neither master was modified or regenerated. Their existing path data is copied inline; only candidate wrapper transforms and presentation fills compose the lockups.

## V0.1 to v0.2 comparison

| Parameter | v0.1 | v0.2 | Change |
| --- | --- | --- | --- |
| Candidate `viewBox` | `0 0 4700 860` | `0 0 4768 860` | Width extended for the shifted wordmark |
| Symbol wrapper scale | `1.00` | `1.18` | 18% larger on both axes |
| Symbol wrapper translation | `translate(0 104)` | `translate(0 45.32) scale(1.18)` | Scaled viewport stays centered at `y=430` |
| Scaled symbol viewport | `376 × 652` | `443.68 × 769.36` | Targets the capital A's 770-unit height |
| Wordmark wrapper | `translate(520 840)` | `translate(587.68 840)` | Shifted right by the symbol width increase |
| Wordmark scale | `1.00` | `1.00` | Unchanged |
| Viewport gap | `144` | `144` | Exactly preserved |

The wordmark x translation increases by `67.68`, exactly matching the symbol viewport width increase (`443.68 - 376`). The numeric gap therefore needs no optical adjustment: it remains 144 units from the scaled symbol viewport's right edge at `x=443.68` to the wordmark viewport's left edge at `x=587.68`. The scaled symbol viewport is vertically centered within the 860-unit viewBox: `(860 - 769.36) / 2 = 45.32`. The wordmark remains at its established baseline translation.

No path coordinates were edited. Human review must confirm the viewport-based target also reads as an optical match.

## Color choices

### Light candidate

- transparent background;
- symbol: locked symbol gold `#DCA645` (the approved gold already used by v0.1);
- wordmark: Text Dark `#272827`;
- intended context: Paper `#FDF3E2`.

### Dark candidate

- transparent background;
- symbol: locked symbol gold `#DCA645`;
- wordmark: Primary Gold `#E0AA47`;
- intended contexts: Deep Dark `#141414` and Ink Night `#0F1315`.

Context colors are documentation only; the lockup SVGs contain no background rectangle.

## Monochrome/black symbol note

Not part of primary light/dark lockup candidates; can be handled later as a monochrome export profile if needed.

## What was created

- `brand/artales/lockups/candidates/light-dark-v0.2/README.md`
- `brand/artales/lockups/candidates/light-dark-v0.2/artales-lockup-light.candidate.v0.2.svg`
- `brand/artales/lockups/candidates/light-dark-v0.2/artales-lockup-dark.candidate.v0.2.svg`
- `brand/artales/lockups/candidates/light-dark-v0.2/artales-lockup-light-dark.candidate.v0.2.json`
- `docs/ARTALES_LOGO_LOCKUP_LIGHT_DARK_CANDIDATES_V0_2.md`

## Why this is not a master yet

The adjusted scale and alignment require human visual review in both intended contexts and at representative sizes. Standalone master approval does not approve this composition. The candidates therefore remain marked `lockup_candidate_review_only`, `awaiting_human_visual_review`, and `not_master: true`, with `publicIntegration: false`.

## Human visual review checklist

- [ ] The enlarged symbol is visibly stronger than v0.1.
- [ ] The symbol's visual height feels approximately equal to the capital A.
- [ ] The preserved 144-unit gap feels balanced rather than cramped or disconnected.
- [ ] Symbol and wordmark appear optically vertically centered.
- [ ] The light treatment reads clearly on Paper `#FDF3E2`.
- [ ] The dark treatment reads clearly on Deep Dark `#141414` and Ink Night `#0F1315`.
- [ ] Both candidates remain readable at representative horizontal-logo sizes.
- [ ] Reviewers choose either another adjustment or progression to a separate master PR.

## Explicitly out of scope

- a lockup master or approval decision;
- any modification or regeneration of symbol or wordmark masters or geometry;
- black-symbol or monochrome variants;
- export profiles, production assets, raster exports, favicons, or app icons;
- public/runtime assets, React components, CSS, or website integration;
- application, reader, editor, parser, Supabase, payments, credits, memberships, database, or environment changes;
- the withdrawn v0.10.15k patch.

## Risk, impact, and rollback

- **Risk:** low — isolated review artifacts and documentation only.
- **Target:** develop first.
- **Runtime impact:** none.
- **DB:** no.
- **Env:** no.
- **Public integration:** no.

Rollback by reverting the v0.2 candidate commit or removing the five newly created files. V0.1, source masters, runtime behavior, data, and environment configuration are unaffected.

## Next step

Conduct human visual review, then prepare either a focused adjustment pass or a separately scoped lockup master PR. No master, export, or integration work should begin without the corresponding approval.
