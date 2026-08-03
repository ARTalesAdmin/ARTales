# ARTales Option A outline candidate v0.1

This directory contains the **review-only outlined candidate** for the human-selected Option A,
“Classic literary serif.” It was generated deterministically for the exact text `ARTales` from
the repository's verified **Libre Baskerville Regular** source package.

The candidate SVG contains vector path geometry, not live text. It therefore needs no installed or
external font to display. The source TTF is a generation input only; it is not embedded, subsetted,
or referenced by the SVG.

## Status and boundaries

- Status: `outline_candidate_review_only`.
- Approval: `awaiting_human_visual_review`.
- This is **not** a wordmark master and does not authorize master geometry.
- This is **not** a lockup and includes no ARTales symbol geometry.
- No background is required, and no runtime or public integration is approved.
- Human visual review is required before any separate master-lock proposal.

## Deterministic generation

Run from the repository root:

```bash
python brand/artales/wordmark/candidates/option-a-outline-v0.1/generate_outline.py
```

The checked-in generator verifies the TTF SHA-256 before loading it, shapes `ARTales` with
HarfBuzz 8.3.0 using the font's default OpenType behavior, and decomposes unhinted outlines with
FreeType 2.13.2. Generation uses a 1000-unit em, zero added letter spacing, no width adjustment,
no transform, and no manual or individual-glyph edits. The viewBox adds only a small safety margin.

See the JSON record for exact provenance, parameters, toolchain, limitations, review checklist,
and finalization requirements.

## Files

- `artales-wordmark-option-a-outline.candidate.v0.1.svg` — review geometry.
- `artales-wordmark-option-a-outline.candidate.v0.1.json` — candidate and audit metadata.
- `generate_outline.py` — deterministic local regeneration script; it adds no font or runtime asset.
