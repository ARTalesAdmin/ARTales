# ARTales light/dark lockup candidate review v0.1

## Outcome: blocker report, no candidates created

This change stops at a deterministic prerequisite check. It does **not** create a light or
dark lockup candidate, locked master, export, or runtime/public asset. The available raster
references do not provide enough evidence to guarantee that automatic whole-image tracing
preserves the ARTales wordmark faithfully. Publishing such a trace as a lockup candidate
would imply confidence that the current evidence does not support.

Status: `candidate_review_only` process preparation; approval state:
`awaiting_human_visual_review`. No candidate SVG or candidate metadata package exists in
this change.

## Verified source material

- Approved standalone symbol source:
  `brand/artales/masters/symbol-pen-drop/symbol-pen-drop.master.v1.svg`.
- Symbol metadata:
  `brand/artales/masters/symbol-pen-drop/symbol-pen-drop.master.v1.json`; preflight requires
  `status: locked_master` and `approval_state: approved_locked`.
- Light source and crop:
  `brand/artales/references/source/logo-lockup-light.source.jpg` and
  `brand/artales/references/extracted/logo-lockup-light.source-crop.png`.
- Dark source and crop:
  `brand/artales/references/source/logo-lockup-dark.source.jpg` and
  `brand/artales/references/extracted/logo-lockup-dark.source-crop.png`.
- Deterministic diagnostic configs:
  `tools/brand/vectorize-reference/config/artales-light-lockup.v0.1.json` and
  `tools/brand/vectorize-reference/config/artales-dark-lockup.v0.1.json`.

Run the non-generating prerequisite check with:

```bash
python tools/brand/vectorize-reference/vectorize_reference.py \
  --validate-lockup-sources
```

## What was prepared

The vectorization helper now has a lockup-specific preflight. It validates the fixed symbol
master paths and approval fields, loads both lockup configs through the existing strict
config validator, and verifies their configured crops. It produces console validation only;
there are no generated files under `tools/brand/vectorize-reference/output/`.

## Wordmark handling and risk

The locked standalone symbol remains the only approved vector source for the symbol. It was
not redrawn, traced, transformed, or modified.

The light/dark configs segment and trace the entire raster lockup as one mask. That method
cannot distinguish the approved symbol geometry from the unapproved wordmark, and its
morphological cleanup and Potrace curve fitting can change letter outlines, spacing,
negative space, and antialiased edges. A thresholded pixel comparison is diagnostic, not
proof of wordmark fidelity. The references also do not include a separately approved vector
wordmark that could be combined deterministically with the locked symbol.

Accordingly:

- `wordmark_source`: existing light/dark raster reference crops;
- `wordmark_confidence`: insufficient for candidate packaging without human review;
- `wordmark_limitations`: raster segmentation cannot guarantee exact letter geometry,
  kerning, spacing, or optical relationship to the locked symbol;
- no system font, manual redraw, invented geometry, or generative reconstruction is used;
- no candidate is presented as ready, approved, or master-quality.

The safe next step is a human brand review of the highest-quality provenance material. The
reviewer should either identify an authoritative vector wordmark source or explicitly approve
a particular deterministic extraction basis for a later, separate review-only candidate PR.
That later packaging must insert the locked symbol master unchanged rather than retracing the
symbol from the lockup raster, and must record placement transforms and wordmark diagnostics.

## Review checklist for a future candidate

- Confirm the locked symbol is used from the master SVG and its geometry is byte-for-byte or
  structurally unchanged after any documented placement transform.
- Establish and record the authoritative source/provenance of the wordmark.
- Compare every letter outline, counter, terminal, join, and curve against both references at
  useful zoom levels.
- Compare kerning, baseline, symbol-to-wordmark spacing, scale, and optical alignment.
- Confirm light and dark candidates preserve their documented fill/background colors without
  treating a background rectangle as required logo geometry.
- Confirm each SVG has a `viewBox` and contains no raster `<image>` or live `<text>` element.
- Confirm metadata remains `candidate_review_only`, `awaiting_human_visual_review`, and
  `not_master: true` until a separate explicit human approval and master-lock step.
- Confirm no file is copied to runtime, `public/`, favicon, application-icon, CSS, or export
  locations.

## Explicitly out of scope

- Approval or locking of any light/dark logo lockup or wordmark.
- Candidate SVG/JSON packages while wordmark provenance and fidelity remain unresolved.
- Runtime/public integration, website or component changes, CSS, favicons, application icons,
  derivative exports, or small-size variants.
- Changes to the standalone symbol master.
- Application, Supabase, database, environment, payments, credits, memberships, reader,
  editor, parser, tables, or pagination changes.
- The cancelled v0.10.15k patch.

## Impact and rollback

- Runtime impact: none.
- DB impact: no.
- Environment impact: no.
- Public integration: no.
- Risk: low; documentation and an isolated non-generating validation mode only.
- Target: develop first.
- Rollback: revert the commit that adds this report and preflight mode. No generated,
  deployed, data, or configuration state requires cleanup.
