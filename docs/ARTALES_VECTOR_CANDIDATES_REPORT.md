# ARTales Vector Candidates Report v0.1

## Summary

Three first-pass SVG candidates were created for review: the standalone pen-drop symbol, the light logo lockup, and the dark logo lockup. They are isolated brand working files and are not approved masters.

## Method: strict reference-first reconstruction

Only the source images, direct crops, comparison board, extraction metadata, and extraction report already present in the repository were used. The silhouette, negative-space nib channel and diamond, lockup proportions, spacing, and serif wordmark were manually reconstructed as SVG paths while repeatedly referring to those artifacts. No new ornament, alternate symbol interpretation, raster embedding, external logo source, or creative redesign was introduced.

The SVGs contain explicit vector paths and stable `viewBox` dimensions. The lockups use flat fills from the extraction metadata; incidental texture in the raster photographs was intentionally not simulated. There are no `<text>` nodes or font dependencies.

## File-by-file notes

### `symbol-pen-drop.candidate.v0.1.svg`

The standalone symbol uses a transparent background and an even-odd compound path. Its central channel and four-pane diamond are true negative space, making it suitable as a neutral candidate for review over light and dark fields. The sampled neutral symbol gold is `#DCA645`.

### `logo-lockup-light.candidate.v0.1.svg`

This candidate follows the wide light crop: gold symbol at left, dark outlined wordmark at right, on sampled warm paper (`#FCF5E3`). The wordmark uses the sampled dark value `#272726` and the symbol uses `#DCA645`.

### `logo-lockup-dark.candidate.v0.1.svg`

This candidate follows the more compact dark crop: gold symbol and gold outlined wordmark on sampled dark (`#101010`). The lockup wordmark uses the extracted dark-lockup gold candidate `#D19A3E`; the symbol retains the neutral master gold for consistency pending review.

## Known uncertainties

- The original vector masters and original typography are unavailable, so exact control points cannot be recovered from these raster references.
- The wordmark is a manual first-pass outline reconstruction. Serif shapes, stroke contrast, bowls, terminals, kerning, and baseline alignment need matched-size overlay inspection and human correction.
- The symbol contour and inner diamond are stable enough for candidate review but still require an overlay check at the tip, lower drop, and side extrema.
- Raster texture and small tonal variation are source-image characteristics; the candidates deliberately use clean flat fills rather than inventing a vector texture.
- Every hex value remains a sampled candidate, not an approved production token.

## What looks stable already

The core pen/drop concept, pointed top, continuous central nib channel, diamond frame with four panes, lower stem/drop termination, left-to-right lockup order, light/dark color relationships, and broad lockup compositions closely follow the approved reference set.

## Human approval still required

1. Overlay each candidate against its matching extracted crop at identical dimensions.
2. Approve or adjust the symbol outline and negative-space geometry.
3. Approve or adjust every wordmark glyph and the complete kerning rhythm.
4. Confirm the relative symbol size, wordmark size, gap, and vertical alignment independently for both lockups.
5. Confirm the candidate palette and decide whether lockups should retain their baked-in review backgrounds in final master files.
6. Only after approval, prepare a separate explicitly scoped integration task.

## Scope confirmation

No runtime code, CSS, dependency, public asset, manifest, favicon, application icon, Supabase, payment, credit, membership, reader, editor, parser, database, environment, or application behavior change was made. Patch v0.10.15k was neither used nor revived.
