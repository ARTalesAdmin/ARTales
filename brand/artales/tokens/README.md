# ARTales color token proposals

This directory contains machine-readable **proposals**, not runtime theme files.

- `artales-color-token-proposal.v0.1.json` records candidate semantic color roles, current fallbacks, target surfaces, and migration risk.
- `status: proposal_only` and `runtimeImpact: false` are deliberate: nothing in the application imports this file.
- The approved palette is an input to review, not permission to recolor runtime UI or locked brand assets.

Any implementation must start in a separate PR, preserve current rendered values first, and follow the staged validation in `docs/ARTALES_COLOR_STYLE_TOKENIZATION_AUDIT_V0_1.md`.

The first runtime definitions now live in `app/globals.css`. They use the
proposal's current/fallback values and do not apply the final ARTales palette;
see `docs/ARTALES_COLOR_TOKEN_DEFINITIONS_V0_1.md` for scope and sequencing.
