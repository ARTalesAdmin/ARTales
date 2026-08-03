# ARTales logo lockup light/dark candidates v0.1

## Summary

This package creates one light and one dark, review-only horizontal ARTales lockup candidate. Each candidate combines the locked standalone symbol and wordmark without changing either source geometry. The symbol is on the left and the wordmark is on the right in a conservative first-pass composition.

The candidates are self-contained SVGs with transparent backgrounds. They introduce no runtime or public integration.

## Source masters used

| Source | Locked master | Metadata | SHA-256 (SVG) |
| --- | --- | --- | --- |
| Symbol | `brand/artales/masters/symbol-pen-drop/symbol-pen-drop.master.v1.svg` | `brand/artales/masters/symbol-pen-drop/symbol-pen-drop.master.v1.json` | `d70d53143a6809d0bea61d68238b40d6a7d3a063e8a5f0f5d703f234d9899847` |
| Wordmark | `brand/artales/masters/wordmark-artales/artales-wordmark.master.v1.svg` | `brand/artales/masters/wordmark-artales/artales-wordmark.master.v1.json` | `74ed72373b89a0818628469d5a6ff5fdf7080316d9338018f6bf70ae9fec4f91` |

The masters remain unchanged. Their path data and nested symbol transform are copied into the candidates. The locked symbol color is preserved as `#DCA645` (case-normalized from the SVG serialization); this is a presentation attribute change only, not a geometry change.

## Exact composition parameters

| Parameter | Value |
| --- | --- |
| Layout | `horizontal_symbol_left_wordmark_right` |
| Candidate `viewBox` | `0 0 4700 860` |
| Symbol scale | `1.0` |
| Symbol translation | `translate(0 104)` |
| Wordmark scale | `1.0` |
| Wordmark translation | `translate(520 840)` |
| Recorded gap | `144` units, from the symbol master viewport right edge (`x=376`) to wordmark master viewport left edge (`x=520`) |
| Vertical alignment | Optical centering: the symbol's 652-unit viewport is inset by 104 units above and below in the 860-unit candidate; the wordmark baseline translates to `y=840`, preserving its master coordinate range of `-840..20` |

No path coordinates were edited. Composition is implemented only with wrapper-group translations and presentation fills.

## Color choices

### Light candidate

- transparent background;
- symbol: locked symbol gold `#DCA645`;
- wordmark: Text Dark `#272827`;
- intended review context: Paper `#FDF3E2`.

### Dark candidate

- transparent background;
- symbol: locked symbol gold `#DCA645`;
- wordmark: Primary Gold `#E0AA47`;
- intended review contexts: Deep Dark `#141414` and Ink Night `#0F1315`.

The intended context colors are documentation only. Neither individual lockup contains a background rectangle.

## What was created

- `brand/artales/lockups/candidates/light-dark-v0.1/README.md`
- `brand/artales/lockups/candidates/light-dark-v0.1/artales-lockup-light.candidate.v0.1.svg`
- `brand/artales/lockups/candidates/light-dark-v0.1/artales-lockup-dark.candidate.v0.1.svg`
- `brand/artales/lockups/candidates/light-dark-v0.1/artales-lockup-light-dark.candidate.v0.1.json`
- `docs/ARTALES_LOGO_LOCKUP_LIGHT_DARK_CANDIDATES_V0_1.md`

## Why these are not masters yet

The relative scale, spacing, optical alignment, colors, and practical readability have not received human visual approval. Metadata therefore marks the files as `lockup_candidate_review_only`, `awaiting_human_visual_review`, and `not_master: true`. Approval of either standalone source master does not automatically approve this new composition.

## Human visual review checklist

- [ ] The symbol feels balanced with the wordmark and does not overpower it.
- [ ] The 144-unit viewport gap feels calm, literary, and neither cramped nor disconnected.
- [ ] Symbol and wordmark appear optically centered, not merely mathematically aligned.
- [ ] The light treatment reads clearly on Paper `#FDF3E2`.
- [ ] The dark treatment reads clearly on Deep Dark `#141414` and Ink Night `#0F1315`.
- [ ] The gold relationship in the dark treatment feels intentional despite the locked symbol gold and Primary Gold wordmark using distinct values.
- [ ] Both candidates remain readable at representative horizontal-logo sizes.
- [ ] Reviewers agree whether v0.1 can progress or needs a focused adjustment pass.

## Explicitly out of scope

- creation or approval of a lockup master;
- modification or regeneration of symbol or wordmark geometry;
- alternate composition variants;
- raster exports or PNG files;
- export profiles;
- favicons, app icons, or small-size treatments;
- public or runtime assets;
- React components, CSS, or website integration;
- application, reader, editor, parser, Supabase, payments, credits, membership, database, or environment changes;
- any use of the withdrawn v0.10.15k patch.

## Risk and impact

- **Risk:** low — isolated review artifacts and documentation only.
- **Target:** develop first.
- **Runtime impact:** none.
- **DB:** no.
- **Env:** no.
- **Public integration:** no.

## Rollback

Revert the candidate-package commit or remove the five files listed above. There are no runtime, data, environment, or public-asset steps to reverse, and the locked source masters are unaffected.

## Next step

Conduct human visual review. Based on that review, prepare either a focused candidate adjustment pass or a separate lockup-master pull request. Export profiles, favicons, app icons, and integration remain later, separately approved work.
