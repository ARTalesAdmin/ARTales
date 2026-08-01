# ARTales Reference Extraction Report v0.1

This package is a practical reference-first extraction step.

It does **not** create, redraw, vectorize, simplify or reinterpret the ARTales logo.

## Source files

| Role | Repository path |
| --- | --- |
| Primary symbol | `brand/artales/references/source/symbol-pen-drop.source.jpg` |
| Light logo lockup | `brand/artales/references/source/logo-lockup-light.source.jpg` |
| Dark logo lockup | `brand/artales/references/source/logo-lockup-dark.source.jpg` |

## Extracted crops

| Role | Crop output | Crop box xyxy |
| --- | --- | --- |
| Primary symbol | `brand/artales/references/extracted/symbol-pen-drop.source-crop.png` | `(439, 293, 815, 945)` |
| Light logo lockup | `brand/artales/references/extracted/logo-lockup-light.source-crop.png` | `(147, 318, 1322, 744)` |
| Dark logo lockup | `brand/artales/references/extracted/logo-lockup-dark.source-crop.png` | `(149, 437, 1103, 822)` |

## Sampled candidate colors

These are evidence samples only, not approved tokens.

| Role | Hex |
| --- | --- |
| dark_background_from_symbol | `#0F1316` |
| dark_background_from_lockup | `#101010` |
| light_paper_background | `#FCF5E3` |
| primary_gold_symbol_median | `#DCA645` |
| gold_light_reference_median | `#E6AF3B` |
| gold_dark_lockup_median | `#D19A3E` |
| gold_highlight_sample | `#EFB94F` |
| gold_shadow_sample | `#D39B3A` |
| dark_wordmark_median | `#272726` |

## Comparison board

`brand/artales/references/extracted/comparison-board-v0.1.png`

The board shows:
- source references;
- extracted crops;
- sampled palette swatches.

## Constraints respected

- No generative fill.
- No retouching.
- No background replacement.
- No shape cleanup.
- No SVG/vector candidate.
- No runtime, CSS, public asset, Supabase, payment, membership, reader, editor or parser change.

## Next step

Human visual approval of the crops and sampled colors.

Only after that should a new SVG/vector candidate be attempted using reference-first tracing and overlay comparison.
