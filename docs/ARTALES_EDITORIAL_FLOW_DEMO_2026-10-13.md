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
