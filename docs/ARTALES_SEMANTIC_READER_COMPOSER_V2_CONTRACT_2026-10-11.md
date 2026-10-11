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

## Deferred editorial title-page follow-up (Ivana; architect 2026-10-11)

Do **not** prioritize or auto-assign a live task while Ivana has not joined the governed workflow. Future assignment owner: **Ivana**, subject to explicit main-thread editorial onboarding and permission checks. First inspect title pages of **currently published ARTales titles** in an authorized read-only comparison; reuse the established composition rather than invent a new brand look. After architecture exposes a safe editor-specific preview, Ivana should review and comment on a side-by-side title-page proposal, including author/work attribution, ARTales and approved colophon subset (no ISBN). This PR's preview is a placeholder only. Do not claim existing covers were inspected or assign production tasks from this isolated fixture.

## Browser-measured pagination corrective (in progress)

The v2 QA preview measures the actual rendered semantic units in an offscreen, layout-real DOM container using the same typography and page width, listens for resize/font changes, and passes measured heights into the pure projection. During initial SSR/hydration it uses the conservative deterministic estimator. This does not alter source, revision, bookmark identities or publish anything. Pending: confirm actual mobile/desktop browser interaction and diagnose long unbreakable semantic units; do not claim full pagination acceptance until confirmed.

## Editorial paired scroll correction — architect QA, 2026-10-11

Removed the synthetic legacy comparison from the Reader v2 QA runtime entirely. Editor comparison now has two matching, independently scrollable height-bounded surfaces (original Gutenberg source / new semantic projection), with visually hidden scrollbars. This intentionally reuses the previously working `lib/fixtures/pairedScroll.ts` anchor interpolation via `lib/semantic/pairedSemanticScroll.ts`; scrolling either pane maps matching block anchors on the other side, prevents scroll feedback, and falls back to bounded interpolation during responsive remount. The original is rendered in complete exact source regions, including separators, rather than a separate scrolling `pre` ignored by document scroll. Source is not rewritten.

Preview Reader-only remains a distinct UI surface over the same semantic renderer/projection, with canonical `pagedFlow`/continuous and `spread` on wide layouts. Three display-density choices in preview: compact, normal, *airy QA-only* (larger line height and paragraph gaps). Account-backed values remain compact/comfortable: no persistent account schema or production Reader change. Existing `IngestFixtureLab` and its live editorial workflow are untouched.

**Outstanding QA:** browser click/touch verification of both scroll directions (source→composition and composition→source) at desktop and tablet, no feedback loops, real alignment under long source spans, and mobile behavior. This is not automatically approved by compile/tests alone.

## Canonical notes, progress and settings compatibility (2026-10-11)

Read-only compatibility adapter: `lib/semantic/readerCompatibility.ts`. Uses **existing** `ReaderNote`, `ReaderBookmark`, `ReaderProgress`, `ReaderSettings` and the same profile defaults; does not define or write a second account schema. Original note id, userId, title, body, color, created/updated times, slug, page index/count, progress %, scrollY, layout and sync provenance are **retained verbatim** as the immutable `legacy` field of the bridge. No calls to `/api/reader/notes`, SQL, localStorage writes, or production `ReaderClient` modifications.

**Confidence:** exact source-anchored start only when verified immutable snapshot/component/byte-start evidence is present, approximate when only old page/percentage is available, blocked when work identity, user scope, or source proof fails. Interior UTF-8 byte offsets are not silently misrepresented as UTF-16 character offsets. `rebindReaderAnchor` preserves an exact anchor across typography/title-page changes only when the original atom source bytes/ID and work/source identity match. `findReaderAnchorPage` resolves the reflowed projection from the stable content anchor rather than fixed page numbers.

**Settings precedence:** canonical local Reader device settings > existing account profile defaults > safe Reader defaults. Normalizer and variants are reused from `lib/reader/readerSettings.ts`: font, width, theme, comfortable/compact density, pagedFlow/spread, page fit, controls. On a physically narrow viewport, effective spread display is suppressed without mutating the stored setting; desktop restores it. Experimental airy QA is *never persisted as a new canonical density*.

**Required main-thread integration before release:** authority-bound, user-scoped sidecar mapping for existing `reader_notes` rows, safe exact legacy-to-source alignment only with real observed evidence, actual note/bookmark/progress UI wiring and cross-device signed-in E2E, reconciling account preferences, user RLS and entitlement-preserving cutover. No automatic reassignment or destructive overwrite of legacy notes, progress or bookmarks. Existing Reader remains authoritative in production until approved end-to-end migration; bookmarks from a different source/edition remain available as original legacy positions with a visible approximate/blocked status.

## Ephemeral customer-note UX QA (2026-10-11)

`lib/semantic/qaNoteSession.ts` and the isolated `/preview/semantic-reader` QA UI demonstrate note creation with the *current* `ReaderNote` title/body/color format and a separate stable source/content `ReaderAnchorV2`. In **Samostatná čtečka**, select a semantic unit, create a temporary note, modify font/density or change continuous/spread reading and follow **Přejít na poznámku**. The resolver searches the current page projection/fragment by original atom and offset rather than a stale page index. The selected location can be inspected through rendered `data-page-unit-id`. Every note remains in React memory only and is deliberately lost on reload; no user note API, localStorage, DB or production writes. The title page cannot receive a literary-source note.

This preview interaction is **not** the full account-facing notes toolbar, nor browser-verified end-to-end persistence. The main-thread release integration must reuse existing Reader note editing/list/marker UX with the bridge, user-scoped persistence, cross-device restore, and real note entitlement/RLS tests. Only the compatible view/model and isolated QA are in this Draft PR.

## Reader QA notes UX parity (2026-10-11)

Compared the actual `ReaderToolbar` and `ReaderClient` in current `develop`. The isolated preview now follows the same interaction sequence: a compact three-dot notes menu, add-note form (same title/body limits and canonical gold/blue/green/rose/violet colors), previous/next selected note navigation, compact selected-note summary, collapsible full notes list, goto/delete controls, and color-coded margin markers. Creation follows the visible reading line rather than asking for a semantic-unit ID. A visible note marker selects the note and opens the list. For stable sequence across font/reflow changes, notes are ordered by their **current projected position / original source identity**, never their frozen old page index. Escape and outside click dismiss the notes menu; controls remain keyboard-accessible. The same source-anchored return-to-content path is used from the note list, arrows and margin markers. No writing to the current Reader, profile, note API or persistent storage.

Still a QA-only *behavioral parity shell*, not a claim that the complete production ReaderToolbar was replaced/reused verbatim. Browser QA and full account-backed E2E remain separate release gates; notes remain ephemeral. No editorial/publishing/legal migrations or production writes.
