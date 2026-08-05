# ARTales Option A outline candidate v0.1

## Summary and reason for the outline

The user selected Option A, **Classic literary serif**, and requested an outline as the first stable,
portable representation of `ARTales`. Outlining removes viewer-dependent live-font resolution while
keeping this stage explicitly reviewable: the geometry can be judged before it is ever proposed as
a wordmark master.

An exact, verified source was required because an outline permanently freezes one font file's glyphs,
metrics, and shaping. A fallback, manual redraw, or reconstruction could look plausible while silently
changing the selected design. This generation therefore uses only the repository-supplied
`LibreBaskerville-Regular.ttf` and stops on a source digest mismatch.

## Verified source

- Font: Libre Baskerville Regular.
- License: SIL Open Font License 1.1.
- Source package metadata:
  `brand/artales/wordmark/font-sources/libre-baskerville/libre-baskerville.font-source.v0.1.json`.
- TTF SHA-256: `b93dfb2ec674ef59fd9a1b47498a8d1db498bb9e64ed22a96f8071082e3d6add`.
- `OFL.txt` SHA-256: `3624eddd4c8f8a908130a417ae7cd089c9da69899c4e0ca1a5217d0a6fae16fd`.
- `README.upstream.txt` SHA-256:
  `94e5892780fe18337251df5ebe4d29d1c30ad530efd9eddb631fe06a6bcd9b9f`.

All three digests were recomputed immediately before generation and matched the package metadata.
No font file, modified font, or generated subset is added by this change.

## Toolchain and exact parameters

Generation command:

```bash
python brand/artales/wordmark/candidates/option-a-outline-v0.1/generate_outline.py
```

Toolchain: Python 3.14.4 standard-library `ctypes`, system HarfBuzz 8.3.0
(`libharfbuzz0b` package `8.3.0-2build2`), and system FreeType 2.13.2
(`libfreetype6` package `2.13.2+dfsg-1ubuntu0.1`). HarfBuzz shapes the exact UTF-8 text with guessed
segment properties and default OpenType features against the exact verified TTF. FreeType loads the
resulting glyphs with `FT_LOAD_NO_HINTING` and decomposes their outlines into SVG path commands.

Parameters:

- text: `ARTales`;
- internal size: 1000-unit em;
- letter spacing: `0` added units;
- width adjustment: none;
- scale transform: none (font units map directly to SVG user units);
- geometry adjustments: none;
- manual or individual-glyph edits: none;
- viewBox: geometry framing plus a small, non-rendering safety margin to avoid clipping.

Source-font advances, kerning, and default shaping are retained. No optical-spacing pass was applied.

## Created output

The candidate directory contains an accessible SVG with one `currentColor` path, a metadata JSON,
a scope README, and the deterministic generator. The SVG has a viewBox and title/description, but no
live `<text>`, raster `<image>`, base64 data, embedded or external font reference, symbol geometry, or
required background.

## Why this is still only a candidate

Outline conversion establishes reproducible geometry; it does not constitute design approval. The
asset remains `outline_candidate_review_only`, `awaiting_human_visual_review`, `not_master`, and
`not_lockup`. It is not a production export and has no runtime/public integration approval.

Human reviewers should inspect:

- the literary character, softness, readability, and distinctiveness;
- uppercase/lowercase balance in `ARTales`;
- spacing and kerning, particularly `AR`, `RT`, `Ta`, `al`, `le`, and `es`;
- outline smoothness and performance at likely display sizes;
- continuity with Option A and the broader ARTales identity; and
- whether width or spacing needs a separately recorded adjustment pass.

## Out of scope and next step

No wordmark master, symbol, lockup candidate/master, light/dark variant, runtime/public asset,
production export, favicon, app icon, CSS, website integration, application code, database, Supabase,
payment, credit, membership, reader, editor, parser, or environment configuration is changed.
Cancelled patch v0.10.15k is neither used nor revived.

The next step is human visual review. Reviewers may request a controlled adjustment pass, or approve
the direction for a **separate** wordmark master-lock pull request. Lockup work remains later and may
start only after a wordmark master exists.

## Delivery classification

- Risk: low; isolated review assets and documentation only.
- Target: develop first.
- Runtime impact: none.
- DB: no.
- Env: no.
- Public integration: no.
- Rollback: revert the candidate-generation commit; there is no deployed, database, or environment
  state to reverse.
