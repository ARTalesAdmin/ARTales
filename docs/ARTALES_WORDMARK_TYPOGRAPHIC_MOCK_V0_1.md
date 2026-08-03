# ARTales typographic wordmark mock v0.1

## Status and purpose

This package provides one controlled, **review-only** live-text mock so humans can evaluate a
possible literary/editorial direction for the word “ARTales”. It has status `review_only` and
approval state `awaiting_human_visual_review`.

No wordmark is approved yet. This package creates no wordmark master, final candidate,
light/dark logo lockup candidate, or lockup master. It includes no production export and no
runtime or public integration. It does not alter, redraw, retrace, reproduce, or combine the
locked standalone symbol master.

The package follows the fallback review route described in
`docs/ARTALES_WORDMARK_SOURCE_DECISION_V0_1.md`. It does not change that document’s finding
that `wordmark_master_exists` and `lockup_master_exists` are both false.

## Chosen font strategy

The SVG uses live text and the placeholder system-font stack
`Georgia, 'Times New Roman', Times, serif`. The stack offers a broad serif direction for visual
conversation only. It does not propose any named font as approved or required, and it must not
be read as a faithful reconstruction of existing raster lettering.

No font binary is committed, vendored, embedded, fetched, or externally referenced. Because
this mock does not select or distribute an exact typeface, it makes no specific font-license
claim. Before a real candidate proceeds, humans must select an exact typeface and document its
name, version, maintainer or foundry, canonical source, license, and permitted logo use. The
repository contains no font file for this mock.

## Live text and rendering limitations

The SVG retains live text (`live_text: true`) and no outlines are created. A viewer chooses the
first locally available font in the stack. Consequently, glyph design, metrics, kerning,
spacing, baseline placement, and overall width may differ across operating systems and review
tools. These variations mean the SVG is neither a stable production asset nor an outline
master.

Any later conversion to outlines requires explicit human approval plus confirmation of the
exact font and its license. Outline creation must be handled as a separately recorded approval
boundary, not as an automatic continuation of this mock.

## Artifact boundaries

The review workspace contains only the live-text SVG, JSON metadata, and local README under
`brand/artales/wordmark/review-mocks/typographic-v0.1/`. The SVG shows only “ARTales”; it has no
image element, raster data, base64 data, external font reference, symbol geometry, or required
background geometry.

The package adds no files under masters or public paths and makes no changes to application,
component, style, CSS, database, Supabase, environment, payment, credit, membership, reader,
editor, or parser code. Runtime impact, database impact, environment impact, and public
integration are all false.

## Human visual review checklist

- [ ] Assess letter character and literary/editorial feel.
- [ ] Assess readability at relevant evaluation sizes.
- [ ] Assess distinctiveness, while recognizing the system-font stack is only a placeholder.
- [ ] Assess potential fit next to the locked symbol without treating this mock as a lockup.
- [ ] Assess the uppercase/lowercase balance in “ARTales”.
- [ ] Assess kerning and spacing, allowing for environment-dependent font substitution.
- [ ] Decide whether the licensing approach is acceptable or an exact documented typeface is
      required before further visual work.
- [ ] Decide whether this direction may proceed to a real wordmark candidate.
- [ ] Decide whether outlines may later be created after exact font and license confirmation.
- [ ] Decide whether light/dark lockup candidate preparation may later proceed.

## Decision needed next

Humans should record whether this broad direction should stop, be revised, or proceed. If it
proceeds, the next separate task must select and audit an exact typeface and must record font
provenance, version, license, and logo-use acceptability. Approval to prepare outlines or
light/dark lockup candidates must be explicit; neither is implied by review of this mock.

## Scope, risk, and rollback

- Runtime impact: none.
- Risk: low; isolated review documentation and a non-runtime live-text SVG only.
- Target: develop first.
- DB: no.
- Env: no.
- Public integration: no.
- Rollback: revert the single commit that adds this review package. There is no deployed state,
  database change, environment change, font installation, or generated production asset to
  clean up.
