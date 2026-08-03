# ARTales standalone wordmark master lock v1

## Summary

This change locks version 1 of the standalone ARTales wordmark master. It copies
the approved Option A outline candidate as the controlled master artifact without
regenerating or modifying its SVG geometry. This is a provenance and approval
lock only; it introduces no runtime or public integration.

## Source candidate

- Candidate ID: `artales-wordmark-option-a-outline.v0.1`
- SVG: `brand/artales/wordmark/candidates/option-a-outline-v0.1/artales-wordmark-option-a-outline.candidate.v0.1.svg`
- Metadata: `brand/artales/wordmark/candidates/option-a-outline-v0.1/artales-wordmark-option-a-outline.candidate.v0.1.json`
- Source typeface: Libre Baskerville Regular
- License: SIL Open Font License 1.1

The candidate remains unchanged and retains its review-only metadata as the
historical source artifact.

## Human approval

The human visual approval attached to this lock is:

> Působí to na mě dobře.

This approval locks the reviewed outline geometry as the standalone wordmark
master. It does not approve a logo lockup, derivative assets, or integration.

## SHA-256 comparison

| Artifact | SHA-256 |
| --- | --- |
| Source candidate SVG | `74ed72373b89a0818628469d5a6ff5fdf7080316d9338018f6bf70ae9fec4f91` |
| Wordmark master SVG | `74ed72373b89a0818628469d5a6ff5fdf7080316d9338018f6bf70ae9fec4f91` |

The values match, and a direct byte comparison confirms that the source and
master SVG files are byte-identical. No spacing, width, glyph shape, `viewBox`,
path data, fill, or embedded SVG metadata was changed.

## What was locked

The locked artifact is the standalone `ARTales` wordmark master v1. Its glyphs
are SVG outline paths rather than live text. It has no external font dependency
for display, while its source font, license, and source-package checksums remain
recorded in the master metadata.

## What remains explicitly out of scope

- A logo lockup or any placement of the symbol beside the wordmark.
- Light and dark lockup variants.
- Exports, favicons, app icons, or production asset profiles.
- Runtime, `public/`, website, application, component, or CSS integration.
- Database, Supabase, environment, payment, credit, membership, reader, editor,
  parser, or operational changes.

## Why this is not a logo lockup yet

A wordmark master controls only the approved wordmark geometry. A logo lockup
must combine the independently locked symbol and wordmark, then establish and
receive human approval for their relative spacing, scale, and arrangement. None
of those composition decisions are made by this lock, and no symbol geometry is
included in the master SVG.

## Next steps

1. Prepare light/dark lockup candidates using the locked symbol and locked
   wordmark masters.
2. Conduct human review of spacing and scale between the symbol and wordmark.
3. Define export profiles only after lockup approval.
4. Perform runtime or public integration only in a later, explicitly scoped PR.
