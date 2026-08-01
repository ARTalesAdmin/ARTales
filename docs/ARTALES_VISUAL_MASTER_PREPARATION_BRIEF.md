# ARTales Visual Pack v0.1 — Master Preparation Brief

This brief defines how the current ARTales generative logo references should be turned into clean, reviewable visual masters.

It does not add production assets, does not lock final masters, and does not change the website. It is a preparation step before SVG/vector work, export profiles, brand sheet generation, design tokens, and runtime visual integration.

## Current status

The current ARTales visual references were created with generative AI in an earlier discussion. They are strong candidate references, not production masters.

Use them as source direction for shape, mood, composition, palette and typography character. Do not treat their pixels, texture, artifacts, spacing or exact raster edges as authoritative.

## Confirmed candidate decisions

The following decisions are confirmed for the v0.1 candidate direction:

1. **Primary symbol:** gold pen / drop symbol.
2. **Primary logo lockup:** symbol on the left, ARTales wordmark on the right.
3. **Dark variant:** gold symbol and gold wordmark on dark / ink background.
4. **Light variant:** gold symbol and dark wordmark on warm paper background.
5. **Monogram:** reserve candidate, not the primary mark.
6. **Texture:** presentation layer only, not the production master.

These are candidate decisions, not final locked masters.

## Goal of master preparation

Create clean, reusable, vector-based candidate masters for:

- primary symbol;
- primary logo lockup;
- primary wordmark if it can be isolated or reconstructed;
- light-background usage variant;
- dark-background usage variant.

The output should preserve the ARTales visual direction while removing generative noise, raster artifacts, texture dependency and accidental distortions.

## Required master types

### 1. Primary symbol master

A clean SVG/vector master of the gold pen / drop symbol.

It should preserve:

- vertical symmetrical silhouette;
- pen / drop double reading;
- central diamond-like detail;
- lower circular drop / dot;
- elegant literary / cultural tone;
- calm premium gold character.

It should not include:

- background;
- raster texture;
- glow;
- shadow;
- paper grain;
- AI artifacts;
- uneven generated edge noise.

### 2. Primary logo lockup master

A clean SVG/vector master of the full ARTales logo lockup.

It should preserve:

- symbol on the left;
- ARTales wordmark on the right;
- horizontal composition;
- balanced spacing between mark and wordmark;
- refined literary serif character;
- calm editorial / gallery feeling.

It should not include:

- background;
- raster texture;
- glow or emboss effects;
- uncontrolled letter artifacts;
- accidental spacing from the source raster.

### 3. Light usage variant

A transparent-background variant intended for warm paper / light surfaces.

Expected direction:

- gold symbol;
- dark wordmark;
- transparent background;
- sufficient contrast on warm paper.

### 4. Dark usage variant

A transparent-background variant intended for dark / ink surfaces.

Expected direction:

- gold symbol;
- gold wordmark;
- transparent background;
- sufficient contrast on deep dark background.

### 5. Presentation renders

Presentation renders may later include texture, paper, subtle material feel or marketing polish.

They must remain derived outputs, not the production master.

## Candidate palette for preparation

Use the current candidate palette as a starting point. These values are not locked final tokens yet.

| Role | Candidate value | Notes |
| --- | --- | --- |
| Ink / Night | `#0F1315` | Primary dark background candidate. |
| Deep Dark | `#141414` | Secondary dark / near-black candidate. |
| Paper | `#FDF3E2` | Warm paper background candidate. |
| Text Dark | `#272827` | Dark wordmark / text candidate for light use. |
| Primary Gold | `#E0AA47` | Main gold direction from references. |
| Warm Gold | `#E3AA46` | Alternative / highlight gold. |
| Darker Gold | `#D19738` | Candidate for shadow/secondary gold. |
| Gold Shade | `#B58636` | Candidate shade, not primary unless later approved. |

For clean masters, prefer simple flat fills first. Gradients or texture effects may be considered only as presentation/export layers after the flat master is accepted.

## Typography / wordmark requirements

The wordmark direction is an elegant, high-contrast literary serif with refined curves.

Before locking a master, clarify one of these paths:

1. **Custom lettering path:** the ARTales wordmark is reconstructed as custom vector lettering and does not depend on a font file.
2. **Font-based path:** the source font is identified, license-safe, and the final wordmark is converted to curves/outlines for master use.
3. **Hybrid path:** a font-like base is used only as construction reference and the final wordmark is cleaned as custom outlines.

Until this is resolved, the wordmark can be a strong candidate but should not be marked as locked.

## Acceptance checklist for candidate masters

A candidate master can be accepted for review when:

- it is vector-based, preferably SVG;
- it has no raster background;
- it has no embedded generative texture as the only source of shape;
- symbol geometry is visually consistent with the approved references;
- wordmark character remains literary, elegant and calm;
- dark and light usage variants preserve the same geometry;
- exported viewBox and sizing are clean;
- file names are stable and predictable;
- the asset is marked as candidate, not locked;
- it can be visually tested on both dark and light backgrounds.

## Not acceptable as locked master

Do not lock assets that are only:

- AI-generated raster images;
- manually cropped JPG/PNG images;
- auto-traced SVGs with noisy or excessive paths;
- textured mockups without clean flat vector source;
- logo images with baked-in background;
- variants with different geometry between light and dark versions;
- files with unknown provenance or unclear intended use.

## Recommended first output names

When actual candidate masters are created later, use names similar to:

```text
brand/artales/masters/candidates/artales-symbol-v0.1-candidate.svg
brand/artales/masters/candidates/artales-logo-lockup-v0.1-light-candidate.svg
brand/artales/masters/candidates/artales-logo-lockup-v0.1-dark-candidate.svg
brand/artales/masters/candidates/artales-wordmark-v0.1-candidate.svg
```

Final locked names should be introduced only after human approval.

## Next steps after this brief

1. Create or commission the first clean SVG candidate for the primary symbol.
2. Create or commission the first clean SVG candidate for the logo lockup.
3. Compare both against the current references on dark and light backgrounds.
4. Decide whether the wordmark is custom lettering, font-based, or hybrid.
5. Define export profiles.
6. Generate a review brand sheet.
7. Only after review, consider moving approved assets from candidate to locked master state.
