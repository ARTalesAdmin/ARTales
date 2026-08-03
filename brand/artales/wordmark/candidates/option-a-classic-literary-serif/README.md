# ARTales wordmark Option A candidate v0.1

## Purpose and status

This package records the human-selected **Option A — Classic literary serif** as the ARTales
wordmark direction candidate. It is a review-only checkpoint with status
`selected_direction_candidate` and approval state `awaiting_final_wordmark_approval`.

The candidate is **not** a final wordmark master, a logo lockup, or a runtime/public asset.
Selection confirms the direction to review next; it does not settle the exact typeface,
font provenance or licensing, stable geometry, outlines, or production use.

## Package contents

- `artales-wordmark-option-a.candidate.v0.1.svg` — one accessible, self-contained live-text
  rendering of `ARTales` for review.
- `artales-wordmark-option-a.candidate.v0.1.json` — selection record, constraints,
  limitations, finalization requirements, review checklist, and next steps.
- `docs/ARTALES_WORDMARK_OPTION_A_CANDIDATE_V0_1.md` — decision report and scope record.

## Font strategy

The SVG uses live text with the selected stack:

```text
Georgia, 'Times New Roman', Times, serif
```

No font is embedded, committed, vendored, downloaded, or externally referenced. The first
available family is selected by the viewing environment, so glyphs, dimensions, kerning, and
spacing can vary between systems. This package does not claim that Georgia or a fallback is
licensed or approved for final logo use. No outlines have been created.

## Boundaries

The SVG contains no symbol, lockup, background geometry, raster/image element, base64 data, or
external font reference. This package authorizes no public or runtime integration and creates
no master. The original options board remains the source review record and is unchanged.

## Finalization gate

Before a final master can be considered, reviewers must:

1. decide whether Option A becomes the final wordmark direction;
2. choose and document an exact typeface and license/provenance, or explicitly accept the
   known variability of a live-text/system-font strategy;
3. approve a separate outline-conversion task if outlines are wanted;
4. approve a separate wordmark master-lock PR after final wordmark approval; and
5. only after that master exists, review separately prepared light/dark lockup candidates that
   use the locked symbol unchanged.

## Review checklist

- [ ] Confirm Option A remains the preferred final direction.
- [ ] Review the live-text result in relevant environments and record variation.
- [ ] Resolve exact font strategy, provenance, license, and permitted logo use.
- [ ] Decide whether stable outlines are needed through a separate approved task.
- [ ] Confirm no master, lockup, or runtime/public use is inferred from this package.

## Scope and rollback

- Runtime impact: none.
- Risk: low.
- Target: develop first.
- DB: no.
- Env: no.
- Rollback: revert the commit that adds this candidate package and its documentation. No
  deployed asset, database state, environment configuration, or font installation needs to be
  reversed.
