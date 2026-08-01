# ARTales Reference Extraction Next Step

This document intentionally keeps the next step narrow. We have already documented the visual direction enough. The process now moves from describing preferences to preserving exact references.

## Why this exists

The first SVG candidate pass failed because it creatively reconstructed the logo instead of reproducing the selected source images. That is not acceptable for a brand mark.

From now on, the approved raster references are the authority.

## Selected source references

The current working selection is:

| Role | Source | Repository target |
| --- | --- | --- |
| Primary symbol | Dark image with standalone gold pen/drop symbol | `brand/artales/references/source/symbol-pen-drop.source.jpg` |
| Light logo lockup | Warm paper image with gold symbol and dark ARTales wordmark | `brand/artales/references/source/logo-lockup-light.source.jpg` |
| Dark logo lockup | Dark image with gold symbol and gold ARTales wordmark | `brand/artales/references/source/logo-lockup-dark.source.jpg` |

Known local filenames from the current conversation:

```text
3f2978a6-53fd-482e-9974-d0e33e719153.jpg
84512f5c-1e4d-48dd-a2ca-eddb85ab60ad.jpg
f2dec087-5def-40a1-a1d3-14a81d38e348.jpg
```

These names are recorded so the source selection is not lost, but the files still need to be committed or otherwise supplied to the vectorization workflow.

## Next step, not more theory

Before another SVG candidate is created, the exact raster references must be available in the repo or in a reproducible artifact bundle.

Minimum next output:

```text
brand/artales/references/source/symbol-pen-drop.source.jpg
brand/artales/references/source/logo-lockup-light.source.jpg
brand/artales/references/source/logo-lockup-dark.source.jpg
```

Then prepare a comparison board showing:

```text
source image
cropped source
sampled source colors
vector candidate
overlay source vs vector
small-size tests
```

## Hard rule

Do not create another replacement SVG from text description, memory, approximate geometry, or a newly invented interpretation.

The next SVG candidate must be traced or manually vectorized against the chosen source image and visually compared before promotion.

## What is allowed

Allowed:

- source cropping;
- background removal for analysis;
- color sampling from the source;
- manual tracing against the source;
- comparison board generation;
- explicit human review.

Not allowed:

- new decorative interpretation;
- new palette;
- new shape language;
- different proportions;
- font substitution presented as final wordmark;
- SVG master without overlay evidence.

## Practical sequence

1. Add the exact source reference images.
2. Generate crops and sampled colors.
3. Create a visual comparison board.
4. Only then create a new SVG candidate.
5. Promote only after human approval.
