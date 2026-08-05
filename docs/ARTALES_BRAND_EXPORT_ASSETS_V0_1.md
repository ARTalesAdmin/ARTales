# ARTales brand export assets v0.1

## Summary

This package generates seven self-contained SVG brand-library exports for human review. It creates no binary or public assets and has no runtime, database, or environment impact.

## Sources

The controlling specification is `brand/artales/export-profiles/artales-export-profiles.v0.1.json` (SHA-256 `056d1453a7f95bc1b77812077c85d2be96aa70873e5712ec4cd7c82ea8aab206`). Its companion README and `docs/ARTALES_BRAND_EXPORT_PROFILES_V0_1.md` provide the approved v0.1 context.

Locked masters used:

- `brand/artales/masters/symbol-pen-drop/symbol-pen-drop.master.v1.svg` — `d70d53143a6809d0bea61d68238b40d6a7d3a063e8a5f0f5d703f234d9899847`
- `brand/artales/masters/wordmark-artales/artales-wordmark.master.v1.svg` — `74ed72373b89a0818628469d5a6ff5fdf7080316d9338018f6bf70ae9fec4f91`
- `brand/artales/masters/logo-lockup/artales-lockup-light.master.v1.svg` — `8697d4a0fa29e9c000e45b9c4a920ec2c916ac7940c61a9603fa28e34d6cd75b`
- `brand/artales/masters/logo-lockup/artales-lockup-dark.master.v1.svg` — `ee4844c7d4c96a57ae3a01a1b52731812e342ef9bb9accfc60a8028bbae61fb4`

## Generated SVG profiles and exact colors

1. **primary-light:** approved source gold `#DCA645` and Text Dark `#272827`; main transparent logo for light/paper backgrounds.
2. **primary-dark:** approved source gold `#DCA645` and Primary Gold `#E0AA47`; main transparent logo for dark backgrounds.
3. **symbol-only-gold:** approved locked-master source gold `#DCA645`, preserved as authorized by the master metadata.
4. **wordmark-only-dark:** Text Dark `#272827`.
5. **wordmark-only-gold:** Primary Gold `#E0AA47`.
6. **monochrome-dark:** Text Dark `#272827`; a secondary practical export, not a primary logo.
7. **monochrome-light:** Paper `#FDF3E2`; a secondary practical export, not a primary logo.

The asset paths and SHA-256 checksums are recorded in `brand/artales/exports/v0.1/artales-brand-exports.v0.1.json`.

## Deferred work and scope boundary

`png_generation_status: deferred_binary_export`

- **Reason:** binary files are not supported in the current Codex PR flow.
- **Next step:** generate PNGs in a later manual/tooling step after SVG exports are reviewed.
- Small-size symbol, favicon, and app-icon generation is intentionally deferred to a separate review.
- PNG, ICO, WEBP, other binary formats, `public/` copies, manifest/runtime references, React, CSS, and app or website integration remain out of scope.
- No app, component, style, Supabase, payment, credit, membership, reader, editor, parser, database, or environment behavior changes.

## Next steps

1. Human review of SVG exports.
2. Generate PNG exports later through a manual/tooling workflow.
3. Create and review a small-size/favicon/app-icon candidate.
4. Handle runtime/public integration in a later explicit PR.
5. Promote to `main` only after explicit approval.
