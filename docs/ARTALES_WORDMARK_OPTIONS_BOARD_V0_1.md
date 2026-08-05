# ARTales typographic wordmark options board v0.1

## Status and purpose

This package is a **review-only options board** that lets humans compare six broad typographic
directions for the word “ARTales” before selecting an exact typeface route. Its status is
`review_only`, and its approval state is `awaiting_human_visual_review`.

The board is not a final asset. No option is approved, and no exact font is selected. It creates
no wordmark master, wordmark candidate, light/dark logo lockup candidate, lockup master,
production export, runtime asset, or public integration. It contains no symbol and does not
alter the locked standalone symbol master.

The work follows the source assessment in `docs/ARTALES_WORDMARK_SOURCE_DECISION_V0_1.md` and
expands the broad comparison begun by the review-only mock in
`brand/artales/wordmark/review-mocks/typographic-v0.1/`. Those sources remain unchanged.

## Options included

The board presents these directions at a consistent comparison size:

1. **Option A — Classic literary serif:** `Georgia, 'Times New Roman', Times, serif`
2. **Option B — Refined editorial serif:**
   `'Palatino Linotype', Palatino, 'Book Antiqua', serif`
3. **Option C — Humanist / book serif:**
   `'Iowan Old Style', 'Palatino Linotype', Palatino, serif`
4. **Option D — Transitional serif:** `'Times New Roman', Times, serif`
5. **Option E — Elegant high-contrast serif:** `Cambria, Georgia, serif`
6. **Option F — Neutral fallback serif:** `serif`

Each sample displays exactly “ARTales”, includes its stack in helper text, and is marked as
review-only live text rather than a master. The labels describe intended review character, not
verified properties of whichever local fallback a viewer ultimately renders.

## Font strategy and rendering limitations

All options use live text with generic or system font-family stacks. No font binary is
committed, vendored, embedded, downloaded, or externally referenced, and no proprietary font
binary is included. No listed font is claimed to be approved.

The viewing environment selects the first available family in each stack. Glyph shape,
metrics, apparent contrast, width, kerning, spacing, baseline position, and even the visual
difference between options can therefore vary across operating systems and applications. The
board is useful for directional discussion only; it is not a stable rendering or production
asset. No outlines have been created.

## Artifact boundaries

The review workspace contains one SVG, one metadata JSON file, and a README under
`brand/artales/wordmark/review-mocks/options-v0.1/`. The SVG is self-contained, uses a viewBox,
and contains no image element, raster data, base64 data, external font reference, symbol
geometry, or required background geometry.

The package changes no application, component, public, style, CSS, database, Supabase,
environment, payment, credit, membership, reader, editor, or parser file. Runtime impact,
database impact, environment impact, and public integration are all false.

## Human visual review checklist

- [ ] Choose a preferred option, or reject all options.
- [ ] Assess the literary/editorial feel.
- [ ] Assess readability.
- [ ] Assess distinctiveness while allowing for local font substitution.
- [ ] Assess the uppercase/lowercase balance in “ARTales”.
- [ ] Assess kerning and spacing.
- [ ] Assess conceptual fit next to the locked symbol without treating this board as a lockup.
- [ ] Decide whether to proceed to exact font, provenance, and license selection.
- [ ] Decide whether additional directions are needed.

## Decision and next steps

Humans should record a preferred direction, request revised or additional directions, or reject
all options. Selecting a direction does not approve a font or authorize a production asset.

If a direction proceeds, the next separate step is exact font selection and documentation of
the font name, version, source/provenance, license, and permitted logo use. Only after that
review and explicit approval can a real wordmark candidate or outlines be prepared. Any
light/dark lockup work remains a separate, explicitly authorized task.

## Scope, risk, and rollback

- Runtime impact: none.
- Risk: low; isolated review documentation and a non-runtime live-text SVG only.
- Target: develop first.
- DB: no.
- Env: no.
- Public integration: no.
- Rollback: revert the commit that adds this options-board package. There is no deployed state,
  database change, environment change, installed font, or generated production asset to remove.
