# Semantic Reader / Composer v2 — independent integration contract (2026-10-11)

Based on merged #204/#205/#206 and draft design #207. Pure isolated contract. No main, no DB, no release pointer, no production notes copied.

## Semantic revision
`SemanticRevision.schema=artales.semantic-text.v2`, `work_id` and slug are preserved, `source_snapshot_ref`, exact source bytes SHA, `revision_ref=sha256:<digest>`, parent revision and recipe version are pinned. New `SemanticNode` is **not** `WorkBlock`: chapter/section have heading and nested children; paragraph/quote/epigraph/footnote atoms carry typed marks; poem has nested stanza/verse atoms. Source separators are tracked as named gaps, not discarded. All [start,end) offsets are UTF-16 normalized character positions plus original UTF-8 byte offsets, and every source atom binds `source_sha256`. No source rewriting is silently permitted.

The new `projectSemanticReader` is independent of legacy `paginateReaderBlocks`. It arranges entire meaningful units and never reconstructs strings from trimmed fragments. Oversized units are marked `scroll_unit`, not truncated. Viewports validated for desktop/mobile; `verifyReaderProjection` requires exact unit order and cardinality. Actual browser measurements and deployment of new Reader to public routes remain **pending**; this code is a pure projection and is not yet the live reader.

## Legacy and Reader state
`remapLegacyPosition` uses `work_id + source snapshot + original byte span` when exact evidence is available. Page number and percentage have no authority; fallback is explicitly approximate and retains the complete original position. No notes, subscriptions, bookmarks, progress or entitlements are read/written. Full account-scoped remapping is owned by the future integration step.

`compareAliceThreeWays` shows verified Gutenberg #11 original, semantic text, and `legacy_observed` only when a separately verified safe snapshot exists. A generated synthetic legacy comparison cannot be called production evidence, and missing real legacy data results in `legacy_evidence_required`. Actual production Alice content (and personal notes) must not be copied to public test data. `can_cutover=false` unconditionally.

## Main thread handshake / PR207 DB-A
- Main thread supplies immutable external raw snapshot + component rights manifest and separately snapshotted `legacy_observed` content.
- Reader/Composer returns schema, recipe, exact source anchors, text/revision digests, parent ancestry, QA evidence and optional legacy source-drift result. No server trust or human approval inferred from these client-side values.
- DB-A later stores `work_text_revisions.semantic_blocks`, immutable source refs and verification; independently governed DB-B release decisions bind revision hashes and QA.
- No application route, `works.status`, catalogue orchestration, SQL migration, privileged RPC or production release is modified here.

## Blocking work for public cutover
Actual semantic React renderer and browser-measured multi-format pagination; full Editor facing-page and 3-column protected QA preview; safe read-only sanitized production Alice baseline; footnote layout/link handling and richer inlines; real reader notes/entitlements migration with signed account E2E; independent CZ/EU rights and editions evidence; privileged DB publication/hold gates; 1→5 work rollout. No substitute for existing production reader until explicitly gated. Revert this isolated PR to roll back.

**Risk high** by Reader policy although only isolated QA surfaces are added. **Target develop first; DB no; Env no.**

## Reader preferences and responsive layout (architect confirmation, 2026-10-11)

Reader typography belongs to each reader/account, **not** to a published work revision: use the existing `ReaderSettings` contract (`fontScale`, `density: comfortable | compact`, `width`, `layoutMode`, `theme`) and already established profile columns `reader_font_scale`, `reader_density`, `reader_width`, `reader_theme`. Cross-device persistence and precedence are owned by the account/Reader main-thread integration. This pilot **reads** the existing profile preferences to seed the QA preview without saving changes. The local QA controls toggle font scale and normal/compact line/paragraph spacing; projection estimates include density but do not alter immutable text/anchors/revisions. Mobile viewport, available width and reader preferences must all feed live layout measurement and safe reflow. Neither page number nor visual line position is a durable reading-progress identity; preserve source-based anchors across every preference/device change. Avoid another bespoke localStorage/profile schema or restoring the discarded paginator patch. Preview-specific adjustments are not persisted to the user profile by this PR.

Implementation proof: `tests/semanticReaderV2.test.ts` validates compact and comfortable projections retain semantic units and revision hash. Final account sync, true physical viewport browser E2E and production Reader settings wiring remain prerequisites to cutover.

## Editorial block typography and cover/title page (architect addition, 2026-10-11)

Every semantic chapter receives a source-independent default layout directive for generous spacing before/after the heading. Per-block editorial review may supply an allowlisted `presentation` object: `align` (left/center/right/justify), `indent` (none/small/medium/large), `space_before` and `space_after` (none/normal/generous). These are **edition revision properties**, not reader-account preferences, original text, CSS blobs, or publication permissions. The issue `requested_layout=block_presentation` carries `requested_presentation`; applying it creates a new SHA-256 revision with parent ancestry and unchanged original source atoms/byte anchors. Future editor UI must offer explicit flags and rationale rather than unrestricted HTML/CSS. Justification of verse blocks is rejected.

A provisional `SemanticTitlePage` is a separate source-independent element (not Gutenberg literary content): work title, author(s), ARTales brand and optional pre-reviewed edition note; no ISBN. Its v0 typographic format is **pending editorial approval**, not a generally accepted default. `proposeSemanticTitlePage` returns a new immutable draft revision, with `title_page.review_state=awaiting_editor_review` and `release_allowed=false`. The Reader projects it as its own page, not as a progress/annotation anchor. Adoption as the default title-page template, real verified metadata sources, richer colophon/legal evidence, and existing-title backfill require follow-up main-thread authorization/review; no automatic profile/catalog/DB/publication updates.

All existing tests for integrity and source coverage must continue to pass after a title-page or block-format edit. The synthetic Gutenberg #11 preview only demonstrates the data and rendering contract; it is not a published edition or approved cover design.
