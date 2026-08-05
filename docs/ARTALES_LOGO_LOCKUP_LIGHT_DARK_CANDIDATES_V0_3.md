# ARTales logo lockup light/dark candidates v0.3

## Summary

This package adds adjusted, review-only v0.3 light and dark ARTales horizontal lockup candidates. It increases only the locked symbol's wrapper scale relative to v0.2, keeps the improved v0.2 top alignment, allows a slight downward overhang, and shifts the unchanged wordmark only enough to preserve the exact 144-unit viewport gap. Source geometry remains intact.

## Human feedback addressed

> Trochu jsme zvětšili, ale pořád málo. Zarovnali jsme horní okraj, ale spodní pořád nesedí. Napočítal jsem na výšku zaujetí cca 18 políček, může to být 20, možná i 21 s lehkým přesahem dolů. Každopádně budu chtít ještě zvětšit. Mezera se tím upravila minimálně, to je správně, jen velikost symbolu ještě vyladíme.

V0.3 makes the symbol larger than v0.2, retains its top position, permits its bottom to extend downward, and keeps the established gap unchanged.

## Source masters used

| Source | Locked master | Metadata | SHA-256 (SVG) |
| --- | --- | --- | --- |
| Symbol | `brand/artales/masters/symbol-pen-drop/symbol-pen-drop.master.v1.svg` | `brand/artales/masters/symbol-pen-drop/symbol-pen-drop.master.v1.json` | `d70d53143a6809d0bea61d68238b40d6a7d3a063e8a5f0f5d703f234d9899847` |
| Wordmark | `brand/artales/masters/wordmark-artales/artales-wordmark.master.v1.svg` | `brand/artales/masters/wordmark-artales/artales-wordmark.master.v1.json` | `74ed72373b89a0818628469d5a6ff5fdf7080316d9338018f6bf70ae9fec4f91` |

Neither master was modified or regenerated. Their path data is copied inline without coordinate edits; candidate wrapper transforms and presentation fills compose the lockups.

## Comparison with v0.1 and v0.2

| Parameter | v0.1 | v0.2 | v0.3 |
| --- | --- | --- | --- |
| Candidate `viewBox` | `0 0 4700 860` | `0 0 4768 860` | `0 0 4817 900` |
| Symbol wrapper scale | `1.00` | `1.18` | `1.31` |
| Symbol translation | `translate(0 104)` | `translate(0 45.32)` | `translate(0 45.32)` |
| Scaled symbol viewport | `376 × 652` | `443.68 × 769.36` | `492.56 × 854.12` |
| Scaled viewport bottom | `756` | `814.68` | `899.44` |
| Wordmark translation | `translate(520 840)` | `translate(587.68 840)` | `translate(636.56 840)` |
| Wordmark scale | `1.00` | `1.00` | `1.00` |
| Viewport gap | `144` | `144` | `144` |

V0.1 and v0.2 remain historical review candidates and are not overwritten. V0.3 changes only the symbol scale, the compensating wordmark x translation, and the candidate viewBox needed to contain the composition.

## Exact v0.3 composition parameters

- symbol transform: `translate(0 45.32) scale(1.31)`;
- symbol master viewport: `376 × 652` units;
- scaled symbol viewport: `492.56 × 854.12` units;
- scaled symbol viewport bottom: `45.32 + 854.12 = 899.44`;
- wordmark transform: `translate(636.56 840)`, with implicit scale `1.00`;
- numeric viewport gap: `636.56 - 492.56 = 144` units;
- candidate viewBox: `0 0 4817 900`.

### Symbol scale and grid-height interpretation

The total symbol scale is `1.31`. Relative to v0.2, this is `1.31 / 1.18 = 1.11017`, or approximately `11.02%` larger. That closely follows the requested `20 / 18 = 1.111…` adjustment: a v0.2 human-observed height of approximately 18 grid units should read near the v0.3 target of approximately 20. Human review may accept up to approximately 21 grid units, but should reject an unintended larger result.

### Top alignment and bottom overhang

The v0.2 top translation `y=45.32` is preserved rather than recentering the larger symbol. Growth therefore proceeds downward. The symbol's scaled viewport reaches `y=899.44`, while the wordmark baseline translation remains `y=840`. The `900`-unit viewBox contains this intentional slight downward overhang; the symbol bottom is not forced to match the wordmark baseline.

### Gap and spacing handling

The wordmark moves right by `48.88` units, exactly matching the scaled symbol viewport width increase from `443.68` to `492.56`. The numeric gap stays exactly `144` units, preserving the v0.2 spacing direction and leaving optical confirmation to human review.

## Color choices

### Light candidate

- transparent background;
- symbol: locked symbol gold `#DCA645`, as used by v0.2;
- wordmark: Text Dark `#272827`;
- intended context: Paper `#FDF3E2`.

### Dark candidate

- transparent background;
- symbol: locked symbol gold `#DCA645`, as used by v0.2;
- wordmark: Primary Gold `#E0AA47`;
- intended contexts: Deep Dark `#141414` and Ink Night `#0F1315`.

Context colors are documentation only; neither SVG contains a background rectangle.

## Monochrome/black symbol note

Not part of primary light/dark lockup candidates; can be handled later as a monochrome export profile if needed.

## What was created

- `brand/artales/lockups/candidates/light-dark-v0.3/README.md`
- `brand/artales/lockups/candidates/light-dark-v0.3/artales-lockup-light.candidate.v0.3.svg`
- `brand/artales/lockups/candidates/light-dark-v0.3/artales-lockup-dark.candidate.v0.3.svg`
- `brand/artales/lockups/candidates/light-dark-v0.3/artales-lockup-light-dark.candidate.v0.3.json`
- `docs/ARTALES_LOGO_LOCKUP_LIGHT_DARK_CANDIDATES_V0_3.md`

## Why this is not a master yet

The scale, optical top alignment, downward overhang, and gap require human visual review in both intended contexts and at representative sizes. The files remain `lockup_candidate_review_only`, `awaiting_human_visual_review`, `not_master: true`, and `publicIntegration: false`. No lockup master or approval decision is created here.

## Human visual review checklist

- [ ] The symbol is visibly larger than v0.2.
- [ ] Its occupied visual height reads near 20 grid units and no more than approximately 21.
- [ ] The preserved top alignment feels correct.
- [ ] The slight downward overhang feels intentional and does not look dropped.
- [ ] The exact 144-unit gap remains optically balanced.
- [ ] The light treatment reads clearly on Paper `#FDF3E2`.
- [ ] The dark treatment reads clearly on Deep Dark `#141414` and Ink Night `#0F1315`.
- [ ] Both candidates remain readable at representative horizontal-logo sizes.
- [ ] Reviewers choose either another adjustment or progression to a separate lockup master PR.

## Explicitly out of scope

- a lockup master or approval decision;
- modifications or regeneration of symbol or wordmark masters or geometry;
- black-symbol or monochrome variants;
- export profiles, production assets, raster exports, favicons, or app icons;
- public/runtime assets, React components, CSS, or website integration;
- application, reader, editor, parser, Supabase, payments, credits, memberships, database, or environment changes;
- the withdrawn v0.10.15k patch.

## Risk, target, impact, and rollback

- **Risk:** low — isolated review artifacts and documentation only.
- **Target:** develop first.
- **Runtime impact:** none.
- **DB:** no.
- **Env:** no.
- **Public integration:** no.

Rollback by reverting the v0.3 candidate commit or removing the five newly created files. V0.1, v0.2, source masters, runtime behavior, data, and environment configuration remain unaffected.

## Next step

Conduct human visual review, then prepare either a focused adjustment pass or a separately scoped lockup master PR.
