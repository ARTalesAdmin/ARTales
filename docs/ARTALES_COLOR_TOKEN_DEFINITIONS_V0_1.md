# ARTales color token definitions v0.1

## Status and scope

This change introduces the first runtime semantic color token layer in
`app/globals.css`. It is intentionally value-preserving: every token uses the
`fallback_current_value` recorded in
`brand/artales/tokens/artales-color-token-proposal.v0.1.json`.

The definitions make stable semantic names available to later migration work.
They do not replace existing variables or selector values, and no approved
ARTales palette remapping has happened in this phase. Rendered visual output is
therefore expected to remain unchanged.

## Defined roles

The v0.1 runtime layer covers page and surface backgrounds, primary through
muted text, inverse text and backgrounds, brand gold roles, subtle and strong
borders, primary and secondary actions, the focus ring, and success, warning,
error, and information states.

Existing variables such as `--background`, `--foreground`, `--artales-ink`,
`--artales-gold`, and `--artales-paper` remain in place. They are not aliased to
the new tokens in this phase, which avoids changing the existing cascade and
rules out circular references.

## Reader decision

Reader tokens are deferred to a separate reader-specific change. This v0.1
layer neither defines reader aliases nor changes any `--reader-*` variable,
reader theme, or reader selector. That keeps the reader's independent themes
outside this low-risk token-definition phase.

## Migration sequence

1. This change defines semantic tokens with current/fallback values only.
2. The next PR should replace a small, reviewed selection of hardcoded values
   with these tokens while preserving current visuals.
3. A later PR may map selected public-facing tokens to the approved ARTales
   palette, followed by dedicated visual QA and polish.

Palette mapping, broad selector replacement, reader migration, component
changes, and route changes are explicitly outside the scope of v0.1.
