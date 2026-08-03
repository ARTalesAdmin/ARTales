# ARTales wordmark source decision v0.1

## Decision status

This is a decision and audit package, not a logo asset package. Its status is
`decision_required`, its approval state is `awaiting_human_direction`, and **no ARTales
wordmark is approved yet**.

The standalone symbol master v1 is locked and approved at
`brand/artales/masters/symbol-pen-drop/symbol-pen-drop.master.v1.svg`, with its status
recorded in the adjacent JSON metadata. That approval applies only to the standalone symbol.
The symbol must not be redrawn, retraced, or altered as part of wordmark work.

The light/dark lockup candidate remains blocked because wordmark provenance and fidelity are
unresolved. There is no wordmark master and no lockup master in the repository. This package
does not create either one, nor does it create a candidate.

## Available source material

The repository currently provides the following evidence:

| Material | Repository path | Authority and limitation |
| --- | --- | --- |
| Locked symbol SVG | `brand/artales/masters/symbol-pen-drop/symbol-pen-drop.master.v1.svg` | Approved source for standalone symbol geometry only. |
| Locked symbol metadata | `brand/artales/masters/symbol-pen-drop/symbol-pen-drop.master.v1.json` | Records `locked_master`, `approved_locked`, and explicitly says the wordmark and lockup are not approved. |
| Light lockup raster | `brand/artales/references/source/logo-lockup-light.source.jpg` | Visual reference, not an authoritative wordmark master. |
| Dark lockup raster | `brand/artales/references/source/logo-lockup-dark.source.jpg` | Visual reference, not an authoritative wordmark master. |
| Light extracted crop | `brand/artales/references/extracted/logo-lockup-light.source-crop.png` | Derived raster crop for analysis only. |
| Dark extracted crop | `brand/artales/references/extracted/logo-lockup-dark.source-crop.png` | Derived raster crop for analysis only. |
| Light diagnostic config | `tools/brand/vectorize-reference/config/artales-light-lockup.v0.1.json` | Configures whole-lockup raster segmentation/tracing; currently `not_run`. |
| Dark diagnostic config | `tools/brand/vectorize-reference/config/artales-dark-lockup.v0.1.json` | Configures whole-lockup raster segmentation/tracing; currently `not_run`. |

The most directly relevant direction and audit documents are:

- `docs/ARTALES_LOGO_LOCKUP_CANDIDATE_REVIEW_V0_1.md`, which records the fidelity blocker and
  requires an authoritative wordmark source or an explicitly reviewed later extraction basis;
- `docs/ARTALES_SYMBOL_MASTER_LOCK_V1.md`, which limits approval to the standalone symbol;
- `docs/ARTALES_REFERENCE_EXTRACTION_REPORT.md` and
  `docs/ARTALES_REFERENCE_EXTRACTION_NEXT_STEP.md`, which describe the origin and intended
  diagnostic use of the raster references and crops;
- `docs/ARTALES_VISUAL_IDENTITY_ASSESSMENT.md` and
  `docs/ARTALES_VISUAL_MASTER_PREPARATION_BRIEF.md`, which provide broader logo and visual
  identity direction without establishing an approved wordmark source.

None of this material establishes a separately authoritative vector wordmark, a documented
wordmark typeface, or approval to treat a raster extraction as master geometry.

## Why whole-image tracing is unsafe for the wordmark

A raster lockup is evidence of an appearance at one resolution; it is not the authoritative
construction of the letters. Whole-image tracing cannot safely establish wordmark fidelity:

- thresholding and pixel quantization can move letter edges and change letter geometry;
- segmentation can change kerning, inter-letter spacing, baseline relationships, and the
  optical gap between the symbol and wordmark;
- antialiasing thresholds can thicken or thin strokes and open or close counters;
- morphological cleanup and Potrace smoothing can alter terminals, joins, counters, curves,
  and corner character;
- tracing the whole lockup would also recreate the symbol from raster pixels instead of using
  the locked master unchanged;
- agreement with the source raster would only validate a particular raster interpretation,
  not prove the provenance or intended vector construction of the wordmark.

Therefore the existing raster source does not equal an authoritative wordmark master, and a
trace must not be promoted as a final wordmark or approval candidate.

## Safe source options

### Option A — authoritative existing vector wordmark

**Safety:** Highest, if provenance and ownership are verified.

Request the original SVG, PDF, AI, or a trusted vector export from the brand owner or designer.
Record who supplied it, its source history, usage rights, and whether it represents the
approved wordmark. A later task may review its geometry and combine it with the locked symbol
master without retracing the symbol. Merely finding a vector file does not itself confer
approval.

### Option B — controlled typographic wordmark

**Safety:** Good for an auditable new candidate, but requires human design approval.

Select a typeface only after documenting its exact name and version, license, provenance and
source, permitted logo use, and fallback status. Prepare live text as a review-only layout mock
first. Do not commit or vendor font files. Convert text to outlines only in a later task after
the typeface and layout are explicitly approved, with that conversion recorded as a distinct
approval boundary. A typographic approximation must never be silently substituted for the
existing raster wordmark.

### Option C — human-designed custom wordmark

**Safety:** Highest potential for distinctiveness and deliberate geometry, but slowest.

Commission or perform a manual design step outside this package. A later PR can add the
reviewed vector source with authorship, rights, provenance, design rationale, and explicit
approval state. It must still use the locked symbol master unchanged when lockups are prepared.

### Option D — temporary layout mock

**Safety:** Acceptable only for non-final spatial review.

A system font or generic placeholder may be used solely when the artifact is conspicuously
marked `non-final`, `placeholder`, and `review-only`. It can test scale, baseline, spacing, and
responsive composition. It cannot be a wordmark master, a fidelity candidate, or an approval
candidate, and cannot enter runtime/public assets. Its placeholder font must be disclosed.

## Recommended route

1. **First request an authoritative vector wordmark** from the brand owner/designer (Option A),
   including provenance and rights. This best preserves any established ARTales lettering.
2. **If no authoritative source is available, prepare a controlled typographic review mock**
   under Option B. Treat it as a proposed new direction—not a reconstruction—and document the
   typeface and license before producing the mock.
3. Do not use automatic raster tracing as the final wordmark source. Do not proceed to a
   light/dark lockup candidate until a human selects and approves a source route and explicitly
   authorizes the next candidate stage.

This sequence preserves the existing symbol approval while making the wordmark decision
auditable. It does not imply that either the raster lettering or a future typographic mock is
approved.

## Human decision checklist

- [ ] Selected route is recorded: A, B, C, or D.
- [ ] Wordmark source, provider, provenance, and date received/created are recorded.
- [ ] License and logo-use rights are documented and accepted.
- [ ] The decision states whether the reviewed artifact remains live text or is approved for a
      later conversion to outlines.
- [ ] Font files committed or vendored: **no**.
- [ ] Any current artifact is explicitly marked review-only and non-final.
- [ ] No wordmark is described as approved before explicit human approval.
- [ ] Locked symbol geometry remains unchanged and sourced from the v1 symbol master.
- [ ] Human direction explicitly states whether preparation of light/dark lockup candidates may
      proceed.

Until this checklist is resolved, `wordmark_master_exists` and `lockup_master_exists` remain
false and lockup candidate generation remains blocked.

## Next safe task proposal

**Preferred next task:** request and audit an authoritative vector wordmark source. If none can
be obtained, open a separate PR for one review-only controlled typographic wordmark mock.

Draft specification for that fallback PR (do not implement in this PR):

1. Propose one documented typeface and, only if needed for comparison, one clearly bounded
   alternative. Record exact family/style/version, foundry or maintainer, canonical source URL,
   license name and URL, logo-use assessment, and fallback status.
2. Commit no font binaries. Use locally available/live text only for mock preparation; if the
   documented font is unavailable, stop rather than silently substitute another typeface.
3. Create documentation and a review-only layout artifact in a diagnostic brand workspace,
   never in `public/` or runtime paths. Label it as a proposed typographic direction,
   `non-final`, `review-only`, `not_master`, and `awaiting_human_visual_review`.
4. Reference the locked standalone symbol master without editing or tracing its geometry.
   Record any placement transform separately so reviewers can assess scale, baseline, clear
   space, and symbol-to-wordmark spacing.
5. Show light and dark presentation contexts only as diagnostic layout views, not as lockup
   candidates. Do not create exports, favicons, icons, CSS, or website integration.
6. Require human review of letter character, kerning, optical spacing, distinctiveness,
   readability, licensing, and whether a later outlined candidate may be prepared.

## Scope, impact, and rollback

- Runtime impact: none.
- Risk: low; documentation and decision metadata only.
- Target: develop first.
- DB: no.
- Env: no.
- Public integration: no.
- Rollback: revert the commit adding this decision package. There are no generated assets,
  runtime changes, deployed state, database changes, or environment changes to clean up.
