# ARTales wordmark Option A selected candidate v0.1

## Status and purpose

This change promotes **Option A — Classic literary serif** from the human-reviewed wordmark
options board into a **review-only selected direction candidate**. Its status is
`selected_direction_candidate`, and its approval state is
`awaiting_final_wordmark_approval`.

This promotion records a directional decision. It does not create or approve a final wordmark
master, a light/dark logo lockup candidate or master, a production export, or any runtime/public
integration.

## Human selection

The reviewer recorded:

> Za mě jsou kandidáti A a B. A působí měkce, B působí elegantně, jednoduše. Na stránkách je aktuálně A, a v celkovém logu je taky spíš A. Takže volím A.

Option A was selected because its softer, literary character is close to the current site and
to the direction already present in the existing overall logo. That continuity makes it the
stronger direction to carry into focused review.

Option B was a credible alternative: the reviewer found it elegant and simple. It was not
selected because it is less aligned than Option A with the project's current visual continuity.
This is a directional comparison, not a negative judgment about Option B or a claim about an
exact locally rendered typeface.

## Selected direction and font strategy

- Selected option: **Option A — Classic literary serif**.
- Live-text stack: `Georgia, 'Times New Roman', Times, serif`.
- Source board: `artales-wordmark-options-board.v0.1`.

The candidate uses live text only. No font file has been committed, vendored, embedded,
downloaded, or externally referenced, and no outlines have been created. The viewing system
chooses the first locally available font in the stack. Glyphs, metrics, dimensions, kerning,
spacing, and overall appearance may therefore vary between environments.

This report does not claim that Georgia or any fallback is licensed, documented, or approved
for final logo use. Exact font selection, provenance, license terms, and permitted logo use
remain unresolved for a final master.

## What was created

The selected candidate package at
`brand/artales/wordmark/candidates/option-a-classic-literary-serif/` contains:

1. an accessible SVG showing exactly one live-text `ARTales` wordmark;
2. JSON metadata recording the selection, boundaries, limitations, review gates, and next
   steps; and
3. a package README.

The SVG has a viewBox and accessible title/description. It has no symbol geometry, required
background geometry, image element, raster or base64 data, font binary, or external font
reference. Its embedded metadata explicitly marks it review-only, a selected direction
candidate, not a master, and not a lockup.

## Why this is not a final master

Human selection approves Option A to proceed as the preferred direction, but the finalization
prerequisites are not complete. No exact typeface/version has been selected; provenance and
license evidence for final logo use have not been documented; live-text output is
environment-dependent; geometry is not stable; and no outline conversion has been approved.

Accordingly, `wordmark_master_exists` and `lockup_master_exists` remain false. Treating this
candidate as a master or production asset would overstate the review decision.

## Finalization requirements

Before any master is created, reviewers must:

1. decide whether Option A should become the final wordmark direction;
2. select an exact font strategy—either document the exact typeface and its provenance/license,
   or explicitly accept a live-text/system-font strategy with known variability;
3. if outlines are desired, approve a separate outline-conversion task;
4. after explicit final wordmark approval, create a separate wordmark master-lock PR; and
5. only after the wordmark master exists, prepare light/dark lockup candidates in a separate
   task, using the locked symbol unchanged.

## Explicitly out of scope

- A wordmark master or final geometry lock.
- Light/dark lockup candidates or masters.
- Symbol changes or symbol geometry in this candidate.
- Font downloading, binaries, vendoring, embedding, or external references.
- Outline conversion.
- Favicons, app icons, production exports, CSS, application/component/style changes, or
  website/public/runtime integration.
- Database, Supabase, environment, payment, credit, membership, reader, editor, parser, or
  cancelled patch v0.10.15k work.

The existing options board remains unchanged as the source comparison and review record.

## Review checklist

- [ ] Confirm Option A remains the intended final-direction candidate.
- [ ] Review its literary character and continuity with the current ARTales direction.
- [ ] Review readability, uppercase/lowercase balance, kerning, and spacing.
- [ ] Compare live-text rendering in relevant environments and record differences.
- [ ] Resolve exact font strategy, provenance, license, and permitted logo use.
- [ ] Decide separately whether outlines should be requested.
- [ ] Confirm this package is not used as a master, lockup, runtime asset, or public asset.

## Scope, risk, and rollback

- Runtime impact: none.
- Risk: low; isolated documentation and a self-contained review-only live-text candidate.
- Target: develop first.
- DB: no.
- Env: no.
- Public integration: no.
- Rollback: revert the commit that adds the candidate directory and this report. No deployed
  state, database change, environment change, font installation, or production asset needs to
  be reversed.
