# ARTales standalone symbol master lock v1

## Summary

This change locks version 1 of the standalone ARTales pen/drop symbol master. It is a
provenance and approval lock only: it does not integrate the symbol into the application
or create derivative assets.

## Source candidate

The master comes from the already materialized `symbol-pen-drop.smoother` candidate:

- SVG: `brand/artales/candidates/symbol-pen-drop/symbol-pen-drop.smoother.candidate.v0.1.svg`
- Metadata: `brand/artales/candidates/symbol-pen-drop/symbol-pen-drop.smoother.candidate.v0.1.json`
- Matrix variant: `smoother`
- Potrace options: `turdsize: 2`, `alphamax: 1.1`, `opttolerance: 0.4`

The candidate files were used as inputs and remain unchanged.

## Validation performed

Before the lock, the source files were confirmed to exist. The candidate metadata was
checked for the required review-only state: `status: candidate_review_only`,
`approval_state: awaiting_human_visual_review`, `not_master: true`, the `smoother`
matrix selection, and `runtimeImpact`, `dbImpact`, and `envImpact` all set to `false`.

The candidate SVG was parsed and checked for a `viewBox`, the ARTales gold fill
`#DCA645` (case-insensitive in the SVG source), and the absence of `image`, `text`, and
`rect` elements. These checks confirm that it has no embedded raster, font/text
dependency, or background rectangle, and that its background remains transparent.

After copying, the same structural checks were run against the master. A byte comparison
confirmed that candidate and master SVG files are identical; no geometry, markup, or
color value was redrawn, reinterpreted, or regenerated.

## Human approval

The human approval attached to this lock is:

> Za mě je to dobré. Můžeme pokročit.

This approval authorizes proceeding from the reviewed smoother candidate to a locked
standalone symbol master. It does not authorize public or runtime use or any derivative
asset category.

## What was locked

The package adds the byte-identical master SVG, master metadata recording provenance and
approval, and a README describing the package boundary. The locked artifact is only the
standalone ARTales symbol master.

## Explicitly out of scope

- Runtime, website, application, or `public/` integration.
- Favicons, app icons, and other exports.
- Small-size variants; 16 px will likely need a separate simplified treatment.
- Logo lockups and the ARTales wordmark.
- Changes to application code, components, CSS, database, environment, or operational
  configuration.

## Next steps

Any derivative export specification must be handled as a separate controlled change.
A dedicated simplified/small-size treatment should be developed and visually approved
before favicon or 16 px use. Any eventual public or runtime integration likewise requires
its own explicit scope, review, validation, and approval.
