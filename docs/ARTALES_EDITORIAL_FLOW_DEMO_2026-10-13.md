# Editorial workflow preview — October 13, 2026

Route: `/preview/editorial-flow` (Vercel preview / local development only).
PR target: `develop`. No production activation.

## Editorial journey

- Uses the canonical `PublicHeader` and ARTales workspace color/system styles rather than an invented faux application header.
- Candidate: **Alice's Adventures in Wonderland** (Lewis Carroll), **entire chapter I** from the pinned local PG #11 Gutenberg text.
- Candidate processing shows a short working state and an inconclusive component/legal status, never publication clearance.
- A profile-like workspace navigation entry shows notification 1 for the queued or claimed task. The real global user profile and auth are NOT altered.
- One task appears in the local-only editorial inbox.
- Facing panes: untouched pinned Gutenberg source at left, source-anchored ARTales composition at right. Continuous scroll sync **both directions** uses existing `synchronizeSemanticPanes` and DOM region markers.
- Three deliberately poor layout choices exist in the composed pane, distributed across the chapter. **No early visual markers, highlighted warnings, defect names, counts, or canned example hints.** Editors can select any composed text block naturally, write a note, and save. For a prepared defect, the predetermined layout recipe instantly corrects presentation; for a normal block, an anchored note is stored without a fake repair. On completion, return to inbox.
- The original atom/source stays exact and publication remains `release_allowed: false`. All notes, task and corrections live only in versioned browser localStorage `artales:editorial-flow-demo:v2`.

## Governance and honesty

- All data remains non-production / QA only; PG11 concrete edition rights dossier is still HOLD. Do not represent the simulated status check as a definitive legal review.
- No DB migrations, Supabase writes, real AI calls, external source fetches, real editorial inbox tasks, signed revisions, or publications.
- Browser-local notification is inside the editorial preview subnavigation, **not** wired to actual logged-in profile header.
- No genuine AI interpretation: defects resolve via deterministic display-only recipes; saving other block notes does not claim a repair.
- Preview noindex and 404 for production.

## Review

1. Verify preview route and native global header.
2. Complete candidate → notification → inbox → dual comparison → select blocks → notes → instant corrected layout → completion → inbox.
3. Scroll either pane across the whole chapter and verify corresponding source regions track each other.
4. Check no upfront defect indicators or progress counts; check changes persist on refresh and reset via completed inbox.
5. Confirm no production/data write, no false publish readiness, route disabled in production, and no changes to main or actual Reader.

**Rollback:** revert the isolated PR; browser fixtures can be cleared with reset. No database rollback needed.


## Final closure — 2026-10-13 (architect observed successful demonstration)

**Outcome: ACCEPTED AS A DEMONSTRATION / RETAIN AS FIXTURE.** The architect reported that editors liked the demonstration; this is **product-validation evidence**, not evidence of live AI/editorial persistence, rights clearance, or production-readiness.

- Isolated delivery: PR [#239](https://github.com/ARTalesAdmin/ARTales/pull/239), branch `feat/artales-editorial-flow-demo-20261013`.
- Final implementation tested: commit `c7e6a8d29416c5b602c78cb760e714b26481bf89`; GitHub Actions run [38356825605](https://github.com/ARTalesAdmin/ARTales/actions/runs/38356825605) passed and Vercel deployment `dpl_9TDbkKwz8HCEg6SqqjZMi2mRF7ZF` was READY as checked 2026-10-13.
- Visual/user story: ARTales native header; Alice pinned PG11 chapter 1; local-only candidate→task→editorial inbox; two-pane source/composition with anchor scroll sync; paired block selection; subtle damaged-block hints; typed note→fixed predetermined style for prepared defects; locally completed work.
- This branch/PR is closed **without merge** and preserved as a GitHub reference. If further work is requested, deliberately reopen or cherry-pick into a new branch based on up-to-date `develop`. Do not infer a production release from acceptance of a fixture.
- The feature-branch preview address may be subject to Vercel's deployment retention/protection; **the repository commit is durable**, not the preview URL.
- Actual per-editor task persistence, AI interpreting arbitrary descriptions, production write flow, release semantics, versioned semantic revision authorization and edition rights approval were **not demonstrated**.

### Distilled follow-on work (not authorized for implementation)

1. [#240](https://github.com/ARTalesAdmin/ARTales/issues/240) — Connect editor-entered prose requests to a validated semantic/layout transformation. Support **local change to a selected source-anchored block** (font sizes, spacing, line-height, indentation) and **scoped defaults** for a selected class of blocks within a chapter/work/edition. Provide deterministic validation, pre/post visual diff, conflict/precedence behavior, cost/impact visibility, human accept/return, source-hash integrity and undo/version/audit gates. Never let global mean entire platform without separate authorization; do not conflate editor style with Reader profile preferences.
2. [#241](https://github.com/ARTalesAdmin/ARTales/issues/241) — Optional **third read-only panel for original legacy ARTales blocks** during migration: raw pinned source | existing pre-migration ARTales | new semantic ARTales. Use only where real legacy material and trustworthy anchors exist. Time-box and remove as migration completes; otherwise stick to two panes.

**Next authority boundary:** This checkpoint is a design/backlog decision, not authorization to deploy, merge, run AI calls, create a paid ephemeral Supabase branch or change production.
