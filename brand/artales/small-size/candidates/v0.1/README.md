# ARTales small-size symbol candidates v0.1

This directory contains **review-only SVG candidates** for small-size ARTales symbol use. They are not approved masters, production favicons, app icons, or public assets. No binary files are generated, and no public or runtime integration is approved by this candidate set.

All three candidates preserve the locked pen-drop symbol geometry. Version 0.1 changes only scale, padding, color application, and background treatment.

## Candidates

- **transparent-gold** — Primary Gold (`#E0AA47`) symbol on transparency, intended for inline use on controlled backgrounds. It is not recommended by itself on arbitrary browser or favicon backgrounds because contrast cannot be predicted.
- **dark-square-gold** — Primary Gold symbol on an Ink/Night (`#0F1315`) square. This is likely the strongest favicon/app-icon base and includes comfortable padding for review at 16, 24, 32, and 48 px.
- **dark-round-gold** — Primary Gold symbol on an Ink/Night circle, intended as a social-avatar or app-icon candidate base with padding for review at 32, 48, 64, and 128 px.

The review board places each direction at simulated 16, 24, 32, 48, 64, and 128 px sizes. Its rows are transparent, dark square, and dark round, from top to bottom; sizes increase from left to right. Board-only paper, white, and checker colors are visual-review surfaces, not candidate colors.

## Review boundary

The locked geometry contains fine pen-nib and diamond details that may disappear at 16 px. If visual review confirms insufficient clarity, a separately documented simplified small-size symbol candidate may be needed in v0.2. This set does not simplify the geometry.

PNG, ICO, app-icon, and other binary generation is deferred. Nothing in this directory may be copied into `public/` or connected to runtime metadata or manifests without a later, explicit approval and pull request.
