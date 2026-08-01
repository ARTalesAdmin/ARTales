# ARTales Reference-First Vectorization Rules

Status: active correction after rejected SVG candidate pass
Target: ARTales visual identity work on `develop`
Runtime impact: none

## Why this exists

The first hand-constructed SVG candidates introduced in PR #6 were rejected because they were too creative and did not respect the approved visual references closely enough.

That result is useful as a process correction: ARTales logo work must not be treated as a generative redesign task. From this point on, any vectorization of the ARTales symbol, logo lockup, wordmark or monogram must be reference-first.

## Core rule

The approved raster reference is the authority.

The task is not to make a similar logo. The task is to reproduce the selected reference faithfully enough that the resulting vector can be compared against the source without meaningful shape, proportion or color drift.

## Non-negotiable constraints

The following are not acceptable for ARTales logo master work:

- creative reinterpretation of the pen/drop symbol;
- changing the silhouette of the symbol by intuition;
- inventing a new internal diamond detail;
- changing the bottom drop/circle detail;
- changing the wordmark proportions by choosing an approximate font and calling it final;
- using a different gold, dark or paper color without sampling/approval;
- treating AI-generated texture, glow or raster noise as a production master;
- publishing a candidate SVG without source comparison.

## Required reference-first workflow

1. Select the exact approved raster reference.
2. Record the source file name and intended role: symbol, light lockup, dark lockup, wordmark or monogram.
3. Crop/export reference images for the exact area being vectorized.
4. Sample candidate colors from the source reference.
5. Vectorize the shape by tracing/overlaying the actual reference, not by reconstructing from memory.
6. Produce a comparison view with at least:
   - source reference;
   - vector candidate;
   - overlay;
   - small-size test;
   - dark and light background test where relevant.
7. Mark the result as `candidate_svg`, not `locked_master`.
8. Promote only after human visual approval.

## Required evidence for a future candidate SVG PR

A future PR that adds SVG logo candidates should include documentation showing:

- source reference used;
- what was traced;
- what colors were sampled;
- which elements are still approximate;
- where the candidate differs from the reference;
- whether wordmark is traced lettering or a temporary text/font approximation;
- a review checklist focused on fidelity, not creativity.

## Candidate status language

Allowed statuses:

- `reference`: source material used as visual authority;
- `candidate_svg`: vector candidate for review;
- `rejected`: candidate failed fidelity review;
- `needs_refinement`: partially useful candidate needing correction;
- `approved_candidate`: human-approved candidate, not yet final;
- `locked_master`: final master, only after explicit approval.

## Current correction

The SVG files added in PR #6 are not to be used as candidate masters. They were removed by the corrective PR that introduced these rules.

The next valid SVG attempt must start from a selected source reference and include a visual comparison board before any candidate is promoted.

## Next recommended step

Before adding another SVG master candidate, prepare a reference extraction pass:

- identify the exact dark symbol source;
- identify the exact light logo lockup source;
- identify the exact dark logo lockup source;
- crop symbol and lockup references;
- sample source colors;
- prepare a comparison-board format.

Only after that should a new SVG vector candidate be created.
