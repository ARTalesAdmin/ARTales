# ARTales micro symbol master lock v1

## Summary

This change locks Candidate B as the ARTales micro symbol master v1. The package records
the approved source, provenance, checksums, intended micro-size role, and strict scope
boundary. It does not create production exports or integrate the symbol into the site or
application.

## Human decision

The human approval attached to this lock is:

> Lock B.

This decision approves Candidate B as the micro/small-size direction and source master.
It does not approve production favicon, app-icon, or runtime integration work.

## Source candidate set

- Selected candidate: `artales-symbol-micro-b.candidate.v0.1`
- Candidate SVG: `brand/artales/small-size/micro-candidates/v0.1/artales-symbol-micro-b.candidate.v0.1.svg`
- Candidate-set metadata: `brand/artales/small-size/micro-candidates/v0.1/artales-symbol-micro-candidates.v0.1.json`

The candidate SVG and candidate-set metadata remain unchanged.

## Why Candidate B was selected

Candidate B is the most practical candidate for very small contexts, particularly at
16px–20px. It preserves the locked outer silhouette while consolidating the standard
symbol's small interior subdivisions into one enlarged central diamond. That reduction
provides the strongest single interior signal in the candidate set at micro sizes.

## Relationship to the normal symbol master

The micro symbol is derived from the locked standard symbol master at
`brand/artales/masters/symbol-pen-drop/symbol-pen-drop.master.v1.svg`. It is a
micro-size-specific variant, not a replacement for the normal ARTales symbol master.
The standard master remains unchanged and continues to be authoritative for normal-size
symbol use.

## What was locked

The lock creates the micro master directory, a byte-identical copy of Candidate B as
`artales-micro-symbol.master.v1.svg`, master metadata, and a package README. Because the
SVG is preserved byte for byte, its candidate-era embedded accessibility and metadata
text is retained; the adjacent master JSON and this report record the authoritative
approved lock state.

## SHA-256 comparison

| Artifact | SHA-256 |
| --- | --- |
| Candidate B SVG | `964e61bbb64b8a68d1b5784d6eb3cb001bd7a0bb6404779ad476e21dbd5217be` |
| Micro master SVG | `964e61bbb64b8a68d1b5784d6eb3cb001bd7a0bb6404779ad476e21dbd5217be` |
| Locked standard symbol master SVG | `d70d53143a6809d0bea61d68238b40d6a7d3a063e8a5f0f5d703f234d9899847` |

The Candidate B and micro master hashes match. A direct byte comparison also passes, so
the source and master SVG files are byte-identical. Geometry, padding, colors, `viewBox`,
path data, and SVG structure were not altered.

## Explicitly out of scope

- No PNG files.
- No ICO files.
- No favicon files.
- No app icons.
- No other binary exports.
- No `public/`, runtime, application, metadata, or manifest integration.
- No changes to app code, components, styles, CSS, database, environment, Supabase,
  payments, credits, memberships, reader, editor, or parser logic.

## Next steps

1. Generate favicon/app-icon export assets in a separate step.
2. Decide the manual/tooling approach for binary files.
3. Integrate into `public/` or runtime only in a later explicit pull request.
4. Promote to `main` only after explicit production approval.

## Change controls

- Risk: `low`
- Target: `develop first`
- DB: `no`
- Env: `no`
- Runtime impact: `none`
- Rollback: revert the lock commit to remove only this micro master package and report;
  no runtime or data rollback is required.
